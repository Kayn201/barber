"use server"

import { db } from "../_lib/prisma"
import { isSlotAvailable } from "../_lib/check-slot-availability"
import { revalidatePath } from "next/cache"

/**
 * Processa uma subscription manualmente quando o webhook não foi chamado
 * Esta função simula o processamento do webhook para desenvolvimento local
 */
export async function processSubscriptionWebhook(subscriptionId: string) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { success: false, error: "Stripe não está configurado" }
    }

    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Buscar subscription do Stripe
    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'customer'],
    })
    const subscriptionData = subscriptionResponse as any

    console.log("📋 Processando subscription manualmente (webhook não foi chamado):")
    console.log("   - subscriptionId:", subscriptionId)
    console.log("   - current_period_start:", subscriptionData.current_period_start)
    console.log("   - current_period_end:", subscriptionData.current_period_end)
    console.log("   - status:", subscriptionData.status)

    // Validar que as datas existem
    if (!subscriptionData.current_period_start || !subscriptionData.current_period_end) {
      return {
        success: false,
        error: "Datas da subscription não estão disponíveis ainda. Tente novamente em alguns segundos.",
      }
    }

    // Converter timestamps Unix para Date
    const currentPeriodStart = new Date(subscriptionData.current_period_start * 1000)
    const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000)

    // Validar que as datas são válidas
    if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
      return {
        success: false,
        error: "Datas da subscription inválidas",
      }
    }

    // Buscar ou criar cliente
    const customerId = typeof subscriptionData.customer === "string"
      ? subscriptionData.customer
      : subscriptionData.customer?.id || null

    let client = null
    if (customerId) {
      client = await db.client.findFirst({
        where: { stripeId: customerId },
      })
    }

    if (!client && subscriptionData.metadata?.serviceId) {
      // Tentar buscar pelo email se tiver no metadata
      // Mas como não temos email aqui, vamos buscar pela subscription existente
      const existingSubscription = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { client: true },
      })
      
      if (existingSubscription) {
        client = existingSubscription.client
      }
    }

    if (!client) {
      return {
        success: false,
        error: "Cliente não encontrado. O webhook precisa processar primeiro para criar o cliente.",
      }
    }

    // Buscar payment associado através da subscription
    const payment = await db.payment.findFirst({
      where: {
        subscription: {
          clientId: client.id,
        },
        type: "subscription",
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    if (!payment) {
      return {
        success: false,
        error: "Payment não encontrado. O webhook precisa processar primeiro para criar o payment.",
      }
    }

    // Verificar se subscription já existe
    const existingSubscription = await db.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    })

    const subscriptionMetadata = subscriptionData.metadata || {}
    const serviceId = subscriptionMetadata.serviceId

    if (!serviceId) {
      return {
        success: false,
        error: "serviceId não encontrado no metadata da subscription",
      }
    }

    if (existingSubscription) {
      // Atualizar subscription existente
      await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: subscriptionData.status,
          currentPeriodStart: currentPeriodStart,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
        },
      })

      console.log("✅ Subscription atualizada manualmente!")
    } else {
      // Criar subscription
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

      console.log("✅ Subscription criada manualmente!")

      // Criar booking inicial se tiver metadata
      const professionalId = subscriptionMetadata.professionalId
      const date = subscriptionMetadata.date

      if (professionalId && date) {
        const service = await db.barbershopService.findUnique({
          where: { id: serviceId },
        })

        if (service) {
          const bookingDate = new Date(date)
          const slotAvailable = await isSlotAvailable({
            professionalId,
            startDate: bookingDate,
            serviceDuration: service.duration,
          })

          if (slotAvailable) {
            // Buscar userId se estiver no metadata
            let userId = subscriptionMetadata.userId || null
            if (!userId && client.email) {
              const user = await db.user.findUnique({
                where: { email: client.email },
                select: { id: true },
              })
              userId = user?.id || null
            }

            await db.booking.create({
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

            console.log("✅ Booking inicial criado manualmente!")
          }
        }
      }
    }

    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/bookings")
    revalidatePath("/subscriptions")

    return {
      success: true,
      message: "Subscription processada com sucesso!",
    }
  } catch (error: any) {
    console.error("❌ Erro ao processar subscription manualmente:", error)
    return {
      success: false,
      error: error.message || "Erro ao processar subscription",
    }
  }
}

