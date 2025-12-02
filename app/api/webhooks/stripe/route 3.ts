import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"
import { isSlotAvailable } from "@/app/_lib/check-slot-availability"
import { revalidatePath } from "next/cache"
import type Stripe from "stripe"

async function getStripe() {
  const Stripe = (await import("stripe")).default
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
  })
}

export async function POST(request: NextRequest) {
  console.log("🔔 Webhook endpoint chamado!")
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  console.log("📝 Signature recebida:", signature ? "Sim" : "Não")
  console.log("🔑 STRIPE_WEBHOOK_SECRET configurado:", process.env.STRIPE_WEBHOOK_SECRET ? "Sim" : "Não")

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Stripe não está configurado corretamente")
    console.error("   STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "✅" : "❌")
    console.error("   STRIPE_WEBHOOK_SECRET:", process.env.STRIPE_WEBHOOK_SECRET ? "✅" : "❌")
    return NextResponse.json(
      { error: "Stripe não está configurado" },
      { status: 500 }
    )
  }

  if (!signature) {
    console.error("❌ Signature não encontrada no header")
    return NextResponse.json(
      { error: "Signature não encontrada" },
      { status: 400 }
    )
  }

  const stripe = await getStripe()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  // Helper function para buscar ou criar cliente
  // PRIORIZA EMAIL para agrupar agendamentos do mesmo cliente
  async function getOrCreateClient(
    customerId: string | null,
    customerDetails?: Stripe.Checkout.Session.CustomerDetails | null
  ) {
    const email = customerDetails?.email

    // PRIORIDADE 1: Buscar por email (mais confiável para agrupar agendamentos)
    let client = email
      ? await db.client.findFirst({
          where: { email: email },
        })
      : null

    // PRIORIDADE 2: Se não encontrou por email, buscar por stripeId
    if (!client && customerId) {
      client = await db.client.findUnique({
        where: { stripeId: customerId },
      })
    }

    // Se encontrou cliente existente, atualizar dados se necessário
    if (client) {
      const updateData: any = {}
      
      // Atualizar stripeId se não tiver
      if (customerId && !client.stripeId) {
        updateData.stripeId = customerId
      }
      
      // Atualizar nome se o novo for mais completo
      if (customerDetails?.name && (!client.name || client.name === "Cliente")) {
        updateData.name = customerDetails.name
      }
      
      // Atualizar telefone se não tiver
      if (customerDetails?.phone && !client.phone) {
        updateData.phone = customerDetails.phone
      }

      if (Object.keys(updateData).length > 0) {
        client = await db.client.update({
          where: { id: client.id },
          data: updateData,
        })
      }
    } else if (customerDetails && email) {
      // Se não encontrou, criar novo cliente
      client = await db.client.create({
        data: {
          name: customerDetails.name || "Cliente",
          email: email,
          phone: customerDetails.phone || null,
          stripeId: customerId,
        },
      })
    }

    return client
  }

  // Helper function para buscar userId pelo email
  async function getUserIdByEmail(email: string | null | undefined) {
    if (!email) return null
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })
    return user?.id || null
  }

  // Handle checkout.session.completed - Pagamentos únicos e primeira cobrança de assinatura
  if (event.type === "checkout.session.completed") {
    console.log("=".repeat(50))
    console.log("✅ Webhook recebido: checkout.session.completed")
    console.log("=".repeat(50))
    const session = event.data.object as Stripe.Checkout.Session

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || null

    console.log("📧 Email do cliente:", session.customer_details?.email)
    console.log("📦 Metadata da session:", JSON.stringify(session.metadata, null, 2))
    console.log("💳 Modo:", session.mode)
    console.log("💰 Valor:", session.amount_total ? (session.amount_total / 100) : 0)

    const client = await getOrCreateClient(customerId, session.customer_details)

    if (!client) {
      console.error("❌ Não foi possível criar/buscar cliente")
      return NextResponse.json({ received: true })
    }

    console.log("👤 Cliente encontrado/criado:")
    console.log("   - ID:", client.id)
    console.log("   - Email:", client.email)
    console.log("   - Nome:", client.name)

    const metadata = session.metadata

    // Criar pagamento
    const payment = await db.payment.create({
      data: {
        stripeId: session.id,
        amount: (session.amount_total || 0) / 100,
        status: session.payment_status === "paid" ? "paid" : "pending",
        type: session.mode === "subscription" ? "subscription" : "one_time",
      },
    })
    
    console.log("💳 Payment criado:")
    console.log("   - ID:", payment.id)
    console.log("   - Stripe ID:", payment.stripeId)
    console.log("   - Valor:", payment.amount)
    console.log("   - Status:", payment.status)

    // Se for assinatura, criar registro de assinatura
    if (session.mode === "subscription" && session.subscription) {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id

      // Buscar detalhes da assinatura no Stripe
      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
      const subscriptionData = subscriptionResponse as any

      // O metadata da subscription está em subscriptionData.metadata, não em session.metadata
      const subscriptionMetadata = subscriptionData.metadata || metadata

      if (subscriptionMetadata?.serviceId || metadata?.serviceId) {
        const serviceId = subscriptionMetadata?.serviceId || metadata?.serviceId
        // Buscar userId se estiver no metadata ou pelo email
        const userId = subscriptionMetadata?.userId || metadata?.userId || (await getUserIdByEmail(session.customer_details?.email))
        
        if (!serviceId) {
          console.error("❌ serviceId não encontrado para criar subscription")
          return NextResponse.json(
            { error: "serviceId é obrigatório" },
            { status: 400 }
          )
        }
        
        await db.subscription.create({
          data: {
            clientId: client.id,
            serviceId: serviceId,
            stripeSubscriptionId: subscriptionId,
            status: subscriptionData.status,
            currentPeriodStart: new Date(subscriptionData.current_period_start * 1000),
            currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
            cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
            paymentId: payment.id,
          },
        })
        
        // Revalidar páginas para atualizar em tempo real
        revalidatePath("/")
        revalidatePath("/admin")
        revalidatePath("/bookings")

        // Se encontrou userId, migrar bookings antigos do client para o user
        if (userId && client) {
          await db.booking.updateMany({
            where: {
              clientId: client.id,
              userId: null, // Apenas migrar os que não têm userId
            },
            data: {
              userId: userId,
            },
          })
        }

        // Criar booking inicial para a assinatura se tiver data e professionalId
        const professionalId = subscriptionMetadata?.professionalId || metadata?.professionalId
        const date = subscriptionMetadata?.date || metadata?.date
        if (professionalId && date) {
          const service = await db.barbershopService.findUnique({
            where: { id: serviceId },
          })
          if (!service) {
            console.error("❌ Serviço da assinatura não encontrado:", serviceId)
          } else {
            const bookingDate = new Date(date)
            const slotAvailable = await isSlotAvailable({
              professionalId,
              startDate: bookingDate,
              serviceDuration: service.duration,
            })

            if (!slotAvailable) {
              console.error("❌ Slot ocupado para booking de assinatura:", {
                professionalId,
                date: bookingDate.toISOString(),
                serviceId,
              })
            } else {
              const booking = await db.booking.create({
                data: {
                  userId: userId || undefined,
                  clientId: client.id,
                  serviceId: serviceId,
                  professionalId: professionalId,
                  date: bookingDate,
                  status: "confirmed",
                  paymentId: payment.id,
                },
              })
              
              console.log("✅ Booking de assinatura criado:", booking.id, "userId:", booking.userId, "clientId:", booking.clientId)
              
              // Revalidar páginas para atualizar em tempo real
              revalidatePath("/")
              revalidatePath("/admin")
              revalidatePath("/bookings")
            }
          }
        } else {
          console.error("❌ Metadata incompleto para criar booking de assinatura:", {
            professionalId,
            date,
            serviceId,
          })
        }
      }
    } else {
      // Se for pagamento único, criar booking
      if (metadata?.professionalId && metadata?.serviceId && metadata?.date) {
        // Buscar userId se estiver no metadata ou pelo email
        const userId = metadata?.userId || (await getUserIdByEmail(session.customer_details?.email))
        
        // Se encontrou userId, também migrar bookings antigos do client para o user
        if (userId && client) {
          await db.booking.updateMany({
            where: {
              clientId: client.id,
              userId: null, // Apenas migrar os que não têm userId
            },
            data: {
              userId: userId,
            },
          })
        }

        const service = await db.barbershopService.findUnique({
          where: { id: metadata.serviceId },
        })

        if (!service) {
          console.error("❌ Serviço não encontrado para pagamento único:", metadata.serviceId)
        } else {
          const bookingDate = new Date(metadata.date)
          const slotAvailable = await isSlotAvailable({
            professionalId: metadata.professionalId,
            startDate: bookingDate,
            serviceDuration: service.duration,
          })

          if (!slotAvailable) {
            console.error("❌ Slot ocupado para booking único:", {
              professionalId: metadata.professionalId,
              date: bookingDate.toISOString(),
              serviceId: metadata.serviceId,
            })
          } else {
            const booking = await db.booking.create({
              data: {
                userId: userId || undefined,
                clientId: client.id,
                serviceId: metadata.serviceId,
                professionalId: metadata.professionalId,
                date: bookingDate,
                status: "confirmed",
                paymentId: payment.id,
              },
            })
            
            console.log("=".repeat(50))
            console.log("✅ BOOKING CRIADO COM SUCESSO!")
            console.log("=".repeat(50))
            console.log("   - Booking ID:", booking.id)
            console.log("   - User ID:", booking.userId || "null")
            console.log("   - Client ID:", booking.clientId || "null")
            console.log("   - Service ID:", booking.serviceId)
            console.log("   - Professional ID:", booking.professionalId)
            console.log("   - Date:", booking.date.toISOString())
            console.log("   - Status:", booking.status)
            console.log("=".repeat(50))
            
            // Revalidar páginas para atualizar em tempo real
            revalidatePath("/")
            revalidatePath("/admin")
            revalidatePath("/bookings")
          }
        }
      } else {
        console.error("❌ Metadata incompleto para criar booking:", {
          professionalId: metadata?.professionalId,
          serviceId: metadata?.serviceId,
          date: metadata?.date,
        })
      }
    }
  }

  // Handle customer.subscription.updated - Atualizações de assinatura
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as any

    const dbSubscription = await db.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (dbSubscription) {
      await db.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      })
      
      // Revalidar páginas para atualizar em tempo real
      revalidatePath("/")
      revalidatePath("/admin")
      revalidatePath("/bookings")
    }
  }

  // Handle checkout.session.async_payment_failed - Pagamento assíncrono falhou
  if (event.type === "checkout.session.async_payment_failed") {
    console.log("=".repeat(50))
    console.log("❌ Webhook recebido: checkout.session.async_payment_failed")
    console.log("=".repeat(50))
    const session = event.data.object as Stripe.Checkout.Session
    
    // Buscar booking pelo paymentId (stripeId da session)
    const payment = await db.payment.findUnique({
      where: { stripeId: session.id },
      include: { booking: true },
    })
    
    if (payment?.booking) {
      // Cancelar o booking se o pagamento falhou
      await db.booking.update({
        where: { id: payment.booking.id },
        data: {
          status: "cancelled",
        },
      })
      
      console.log("✅ Booking cancelado devido a falha no pagamento:", payment.booking.id)
      
      // Revalidar páginas
      revalidatePath("/")
      revalidatePath("/admin")
      revalidatePath("/bookings")
    }
  }

  // Handle checkout.session.expired - Checkout expirado sem pagamento
  if (event.type === "checkout.session.expired") {
    console.log("=".repeat(50))
    console.log("⏰ Webhook recebido: checkout.session.expired")
    console.log("=".repeat(50))
    const session = event.data.object as Stripe.Checkout.Session
    
    // Buscar booking pelo paymentId (stripeId da session)
    const payment = await db.payment.findUnique({
      where: { stripeId: session.id },
      include: { booking: true },
    })
    
    if (payment?.booking && payment.booking.status === "pending") {
      // Cancelar o booking se o checkout expirou
      await db.booking.update({
        where: { id: payment.booking.id },
        data: {
          status: "cancelled",
        },
      })
      
      // Deletar o payment também já que não foi pago
      await db.payment.delete({
        where: { id: payment.id },
      })
      
      console.log("✅ Booking cancelado devido a checkout expirado:", payment.booking.id)
      
      // Revalidar páginas
      revalidatePath("/")
      revalidatePath("/admin")
      revalidatePath("/bookings")
    }
  }

  // Handle invoice.payment_failed - Falha no pagamento de assinatura
  if (event.type === "invoice.payment_failed") {
    console.log("=".repeat(50))
    console.log("❌ Webhook recebido: invoice.payment_failed")
    console.log("=".repeat(50))
    const invoice = event.data.object as any
    
    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription.id

      const dbSubscription = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
      })

      if (dbSubscription) {
        // Atualizar status da subscription
        await db.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: "past_due",
          },
        })
        
        console.log("✅ Subscription atualizada para past_due:", dbSubscription.id)
        
        // Revalidar páginas
        revalidatePath("/")
        revalidatePath("/admin")
        revalidatePath("/bookings")
      }
    }
  }

  // Handle invoice.payment_succeeded - Pagamentos recorrentes de assinatura
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any

    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription.id

      const dbSubscription = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { service: true },
      })

      if (dbSubscription && invoice.metadata?.professionalId && invoice.metadata?.date) {
        // Buscar userId pelo email do cliente
        const client = await db.client.findUnique({
          where: { id: dbSubscription.clientId },
          select: { email: true },
        })
        const userId = client?.email ? await getUserIdByEmail(client.email) : null
        
        const bookingDate = new Date(invoice.metadata.date)
        const slotAvailable = await isSlotAvailable({
          professionalId: invoice.metadata.professionalId,
          startDate: bookingDate,
          serviceDuration: dbSubscription.service.duration,
        })

        if (!slotAvailable) {
          console.error("❌ Slot ocupado para invoice.subscription.booking:", {
            professionalId: invoice.metadata.professionalId,
            date: bookingDate.toISOString(),
            serviceId: dbSubscription.serviceId,
          })
        } else {
          await db.booking.create({
            data: {
              userId: userId || undefined,
              clientId: dbSubscription.clientId,
              serviceId: dbSubscription.serviceId,
              professionalId: invoice.metadata.professionalId,
              date: bookingDate,
              status: "confirmed",
            },
          })
          
          // Revalidar páginas para atualizar em tempo real
          revalidatePath("/")
          revalidatePath("/admin")
          revalidatePath("/bookings")
        }
      }
    }
  }
  return NextResponse.json({ received: true })
}


