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

      console.log("📋 Dados da subscription do Stripe:")
      console.log("   - current_period_start:", subscriptionData.current_period_start)
      console.log("   - current_period_end:", subscriptionData.current_period_end)
      console.log("   - status:", subscriptionData.status)
      console.log("   - cancel_at_period_end:", subscriptionData.cancel_at_period_end)

      // Validar que as datas existem e são válidas
      if (!subscriptionData.current_period_start || !subscriptionData.current_period_end) {
        console.error("❌ Datas da subscription não encontradas no Stripe")
        console.error("   - current_period_start:", subscriptionData.current_period_start)
        console.error("   - current_period_end:", subscriptionData.current_period_end)
        return NextResponse.json(
          { error: "Dados da subscription incompletos" },
          { status: 400 }
        )
      }

      // Converter timestamps Unix para Date
      const currentPeriodStart = new Date(subscriptionData.current_period_start * 1000)
      const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000)

      // Validar que as datas são válidas
      if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
        console.error("❌ Datas inválidas após conversão:")
        console.error("   - currentPeriodStart:", currentPeriodStart)
        console.error("   - currentPeriodEnd:", currentPeriodEnd)
        return NextResponse.json(
          { error: "Datas da subscription inválidas" },
          { status: 400 }
        )
      }

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
        
        // Verificar se subscription já existe (pode ter sido criada pela página /success)
        const existingSubscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })
        
        if (existingSubscription) {
          console.log("ℹ️ Subscription já existe no banco, atualizando com dados do webhook:")
          console.log("   - Subscription ID:", existingSubscription.id)
          console.log("   - Atualizando datas para:", currentPeriodStart, "até", currentPeriodEnd)
          
          // Atualizar subscription com as datas corretas do webhook
          await db.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              status: subscriptionData.status,
              currentPeriodStart: currentPeriodStart,
              currentPeriodEnd: currentPeriodEnd,
              cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
            },
          })
          
          console.log("✅ Subscription atualizada com sucesso pelo webhook!")
        } else {
          console.log("💾 Criando subscription no banco de dados (webhook):")
          console.log("   - clientId:", client.id)
          console.log("   - serviceId:", serviceId)
          console.log("   - stripeSubscriptionId:", subscriptionId)
          console.log("   - status:", subscriptionData.status)
          console.log("   - currentPeriodStart:", currentPeriodStart)
          console.log("   - currentPeriodEnd:", currentPeriodEnd)
          
          await db.subscription.create({
            data: {
              clientId: client.id,
              serviceId: serviceId,
              stripeSubscriptionId: subscriptionId,
              status: subscriptionData.status,
              currentPeriodStart: currentPeriodStart,
              currentPeriodEnd: currentPeriodEnd,
              cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
              paymentId: payment.id,
            },
          })
          
          console.log("✅ Subscription criada com sucesso pelo webhook!")
        }
        
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
              
              // Gerar wallet pass automaticamente (não bloquear se falhar)
              try {
                const { generateWalletPassForBooking } = await import("@/app/_actions/generate-wallet-pass-for-booking")
                await generateWalletPassForBooking(booking.id)
              } catch (error) {
                console.error("Erro ao gerar wallet pass automaticamente:", error)
                // Não bloquear criação do booking se falhar
              }
              
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
            
            // Gerar wallet pass automaticamente (não bloquear se falhar)
            try {
              const { generateWalletPassForBooking } = await import("@/app/_actions/generate-wallet-pass-for-booking")
              await generateWalletPassForBooking(booking.id)
            } catch (error) {
              console.error("Erro ao gerar wallet pass automaticamente:", error)
              // Não bloquear criação do booking se falhar
            }
            
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
  // Este evento é disparado quando há qualquer mudança na assinatura:
  // - Status mudou (active -> past_due, canceled, etc)
  // - Período renovado
  // - Cancelamento agendado
  // - Reativação após falha de pagamento
  if (event.type === "customer.subscription.updated") {
    console.log("=".repeat(50))
    console.log("🔄 Webhook recebido: customer.subscription.updated")
    console.log("=".repeat(50))
    const subscription = event.data.object as any

    const dbSubscription = await db.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      include: {
        client: true,
      },
    })

    if (dbSubscription) {
      const previousStatus = dbSubscription.status
      const newStatus = subscription.status
      
      await db.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      })
      
      console.log("✅ Subscription atualizada:")
      console.log("   - ID:", dbSubscription.id)
      console.log("   - Status anterior:", previousStatus)
      console.log("   - Status novo:", newStatus)
      console.log("   - Cliente:", dbSubscription.client.email)
      
      // Se a assinatura foi cancelada ou ficou unpaid, cancelar bookings futuros
      if ((newStatus === "canceled" || newStatus === "unpaid") && previousStatus === "active") {
        const now = new Date()
        const canceledBookings = await db.booking.updateMany({
          where: {
            clientId: dbSubscription.clientId,
            serviceId: dbSubscription.serviceId,
            status: "confirmed",
            date: {
              gt: now, // Apenas bookings futuros
            },
          },
          data: {
            status: "cancelled",
          },
        })
        
        console.log(`✅ ${canceledBookings.count} booking(s) futuro(s) cancelado(s) devido a cancelamento da assinatura`)
      }
      
      // Se a assinatura foi reativada (de past_due/unpaid para active), não fazer nada
      // Os bookings futuros já foram criados ou serão criados no próximo invoice.payment_succeeded
      
      // Revalidar páginas para atualizar em tempo real
      revalidatePath("/")
      revalidatePath("/admin")
      revalidatePath("/bookings")
      revalidatePath("/subscriptions")
    }
  }
  
  // Handle customer.subscription.deleted - Assinatura cancelada permanentemente
  // Este evento é disparado quando a assinatura é cancelada definitivamente
  // (após múltiplas tentativas de pagamento falhadas ou cancelamento manual)
  if (event.type === "customer.subscription.deleted") {
    console.log("=".repeat(50))
    console.log("🗑️ Webhook recebido: customer.subscription.deleted")
    console.log("=".repeat(50))
    const subscription = event.data.object as any

    const dbSubscription = await db.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      include: {
        client: true,
      },
    })

    if (dbSubscription) {
      // Atualizar status para canceled
      await db.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: "canceled",
          cancelAtPeriodEnd: false,
        },
      })
      
      console.log("✅ Subscription marcada como cancelada:", dbSubscription.id)
      console.log("   - Cliente:", dbSubscription.client.email)
      
      // Cancelar todos os bookings futuros desta assinatura
      const now = new Date()
      const canceledBookings = await db.booking.updateMany({
        where: {
          clientId: dbSubscription.clientId,
          serviceId: dbSubscription.serviceId,
          status: "confirmed",
          date: {
            gt: now, // Apenas bookings futuros
          },
        },
        data: {
          status: "cancelled",
        },
      })
      
      console.log(`✅ ${canceledBookings.count} booking(s) futuro(s) cancelado(s)`)
      
      // Revalidar páginas
      revalidatePath("/")
      revalidatePath("/admin")
      revalidatePath("/bookings")
      revalidatePath("/subscriptions")
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
  // Este evento é disparado quando o Stripe tenta cobrar uma assinatura e falha
  // (ex: cartão bloqueado, saldo insuficiente, etc)
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

      // Buscar assinatura no Stripe para ver o status atual
      const stripeSubscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
      const stripeSubscription = stripeSubscriptionResponse as any
      
      const dbSubscription = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: {
          client: true,
        },
      })

      if (dbSubscription && stripeSubscription.current_period_start && stripeSubscription.current_period_end) {
        // Atualizar status da subscription baseado no status do Stripe
        // O Stripe pode mudar o status para: past_due, unpaid, ou canceled
        await db.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: stripeSubscription.status,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          },
        })
        
        console.log("✅ Subscription atualizada para:", stripeSubscription.status)
        console.log("   - ID:", dbSubscription.id)
        console.log("   - Cliente:", dbSubscription.client.email)
        
        // Se a assinatura foi cancelada por falha de pagamento, cancelar bookings futuros
        if (stripeSubscription.status === "canceled" || stripeSubscription.status === "unpaid") {
          const now = new Date()
          await db.booking.updateMany({
            where: {
              clientId: dbSubscription.clientId,
              serviceId: dbSubscription.serviceId,
              status: "confirmed",
              date: {
                gt: now, // Apenas bookings futuros
              },
            },
            data: {
              status: "cancelled",
            },
          })
          
          console.log("✅ Bookings futuros cancelados devido a falha no pagamento da assinatura")
        }
        
        // Revalidar páginas
        revalidatePath("/")
        revalidatePath("/admin")
        revalidatePath("/bookings")
        revalidatePath("/subscriptions")
      }
    }
  }

  // Handle invoice.payment_succeeded - Pagamentos recorrentes de assinatura
  // Este evento é disparado quando:
  // 1. Primeira cobrança da assinatura (já tratado em checkout.session.completed)
  // 2. Renovação mensal bem-sucedida
  // 3. Pagamento bem-sucedido após falha (reativação)
  if (event.type === "invoice.payment_succeeded") {
    console.log("=".repeat(50))
    console.log("✅ Webhook recebido: invoice.payment_succeeded")
    console.log("=".repeat(50))
    const invoice = event.data.object as any

    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription.id

      // Buscar assinatura no Stripe para verificar status atual
      const stripeSubscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
      const stripeSubscription = stripeSubscriptionResponse as any

      const dbSubscription = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { 
          service: true,
          client: true,
        },
      })

      if (dbSubscription && stripeSubscription.current_period_start && stripeSubscription.current_period_end) {
        // Atualizar status da assinatura (pode ter sido reativada após falha)
        await db.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: stripeSubscription.status, // Pode ser "active" se foi reativada
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          },
        })
        
        console.log("✅ Subscription atualizada:")
        console.log("   - ID:", dbSubscription.id)
        console.log("   - Status:", stripeSubscription.status)
        console.log("   - Cliente:", dbSubscription.client.email)
        
        // Se tiver metadata com professionalId e date, criar booking
        // (isso acontece em renovações mensais quando o cliente agendou um horário)
        if (invoice.metadata?.professionalId && invoice.metadata?.date) {
          // Buscar userId pelo email do cliente
          const userId = await getUserIdByEmail(dbSubscription.client.email)
          
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
            const booking = await db.booking.create({
              data: {
                userId: userId || undefined,
                clientId: dbSubscription.clientId,
                serviceId: dbSubscription.serviceId,
                professionalId: invoice.metadata.professionalId,
                date: bookingDate,
                status: "confirmed",
              },
            })
            
            console.log("✅ Booking criado para renovação de assinatura")
            
            // Gerar wallet pass automaticamente (não bloquear se falhar)
            try {
              const { generateWalletPassForBooking } = await import("@/app/_actions/generate-wallet-pass-for-booking")
              await generateWalletPassForBooking(booking.id)
            } catch (error) {
              console.error("Erro ao gerar wallet pass automaticamente:", error)
              // Não bloquear criação do booking se falhar
            }
          }
        }
        
        // Revalidar páginas para atualizar em tempo real
        revalidatePath("/")
        revalidatePath("/admin")
        revalidatePath("/bookings")
        revalidatePath("/subscriptions")
      }
    }
  }
  return NextResponse.json({ received: true })
}


