import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"

async function getStripe() {
  const Stripe = (await import("stripe")).default
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-11-20.acacia",
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
  const Stripe = (await import("stripe")).default

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
  async function getOrCreateClient(
    customerId: string | null,
    customerDetails?: Stripe.Checkout.Session.CustomerDetails | null
  ) {
    // Primeiro, tentar buscar por stripeId
    let client = customerId
      ? await db.client.findUnique({
          where: { stripeId: customerId },
        })
      : null

    // Se não encontrou por stripeId, tentar buscar por email
    if (!client && customerDetails?.email) {
      client = await db.client.findFirst({
        where: { email: customerDetails.email },
      })
    }

    // Se ainda não encontrou, criar novo cliente
    if (!client && customerDetails) {
      client = await db.client.create({
        data: {
          name: customerDetails.name || "Cliente",
          email: customerDetails.email || "",
          phone: customerDetails.phone || null,
          stripeId: customerId,
        },
      })
    } else if (client && customerId && !client.stripeId) {
      // Se encontrou cliente por email mas não tem stripeId, atualizar
      client = await db.client.update({
        where: { id: client.id },
        data: { stripeId: customerId },
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
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      // O metadata da subscription está em subscription.metadata, não em session.metadata
      const subscriptionMetadata = subscription.metadata || metadata

      if (subscriptionMetadata?.serviceId || metadata?.serviceId) {
        const serviceId = subscriptionMetadata?.serviceId || metadata?.serviceId
        // Buscar userId se estiver no metadata ou pelo email
        const userId = subscriptionMetadata?.userId || metadata?.userId || await getUserIdByEmail(session.customer_details?.email)
        
        await db.subscription.create({
          data: {
            clientId: client.id,
            serviceId: serviceId,
            stripeSubscriptionId: subscriptionId,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            paymentId: payment.id,
          },
        })

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
          const booking = await db.booking.create({
            data: {
              userId: userId || undefined,
              clientId: client.id,
              serviceId: serviceId,
              professionalId: professionalId,
              date: new Date(date),
              status: "confirmed",
              paymentId: payment.id,
            },
          })
          
          console.log("✅ Booking de assinatura criado:", booking.id, "userId:", booking.userId, "clientId:", booking.clientId)
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
        const userId = metadata?.userId || await getUserIdByEmail(session.customer_details?.email)
        
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
        
        const booking = await db.booking.create({
          data: {
            userId: userId || undefined,
            clientId: client.id,
            serviceId: metadata.serviceId,
            professionalId: metadata.professionalId,
            date: new Date(metadata.date),
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
    const subscription = event.data.object as Stripe.Subscription

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
    }
  }

  // Handle invoice.payment_succeeded - Pagamentos recorrentes de assinatura
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice

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
        
        // Criar booking para o período da assinatura
        await db.booking.create({
          data: {
            userId: userId || undefined,
            clientId: dbSubscription.clientId,
            serviceId: dbSubscription.serviceId,
            professionalId: invoice.metadata.professionalId,
            date: new Date(invoice.metadata.date),
            status: "confirmed",
          },
        })
      }
    }
  }
  return NextResponse.json({ received: true })
}


