"use server"

import { db } from "../_lib/prisma"
import { isSlotAvailable } from "../_lib/check-slot-availability"
import { revalidatePath } from "next/cache"

interface ProcessCheckoutSessionParams {
  sessionId: string
}

export async function processCheckoutSession({ sessionId }: ProcessCheckoutSessionParams) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe não está configurado")
    }

    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Buscar sessão do Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer_details", "payment_intent", "subscription"],
    })

    if (session.payment_status !== "paid") {
      return { success: false, error: "Pagamento não foi concluído" }
    }

    // Verificar se já foi processado
    const existingPayment = await db.payment.findUnique({
      where: { stripeId: sessionId },
      include: { 
        booking: {
          include: {
            client: true,
          },
        },
      },
    })

    if (existingPayment?.booking) {
      return {
        success: true,
        booking: existingPayment.booking,
        clientId: existingPayment.booking.clientId,
        alreadyProcessed: true,
      }
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || null

    const customerDetails = session.customer_details
    const email = customerDetails?.email

    if (!email) {
      return { success: false, error: "Email não encontrado na sessão" }
    }

    // Buscar ou criar cliente (igual ao webhook)
    let client = await db.client.findFirst({
      where: { email: email },
    })

    if (!client && customerId) {
      client = await db.client.findUnique({
        where: { stripeId: customerId },
      })
    }

    if (!client) {
      client = await db.client.create({
        data: {
          name: customerDetails?.name || "Cliente",
          email: email,
          phone: customerDetails?.phone || null,
          stripeId: customerId,
        },
      })
    } else {
      // Atualizar dados se necessário
      const updateData: any = {}
      if (customerId && !client.stripeId) {
        updateData.stripeId = customerId
      }
      if (customerDetails?.name && (!client.name || client.name === "Cliente")) {
        updateData.name = customerDetails.name
      }
      if (customerDetails?.phone && !client.phone) {
        updateData.phone = customerDetails.phone
      }

      if (Object.keys(updateData).length > 0) {
        client = await db.client.update({
          where: { id: client.id },
          data: updateData,
        })
      }
    }

    // Buscar userId pelo email
    let userId: string | null = null
    if (email) {
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true },
      })
      userId = user?.id || null
    }

    // Criar payment
    let payment = existingPayment
    if (!payment) {
      payment = await db.payment.create({
        data: {
          stripeId: sessionId,
          amount: (session.amount_total || 0) / 100,
          status: session.payment_status === "paid" ? "paid" : "pending",
          type: session.mode === "subscription" ? "subscription" : "one_time",
        },
      })
    }

    const metadata = session.metadata || {}

    // Se for assinatura
    if (session.mode === "subscription" && session.subscription) {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id

      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
      const subscriptionData = subscriptionResponse as any
      const subscriptionMetadata = subscriptionData.metadata || metadata

      const serviceId = subscriptionMetadata?.serviceId || metadata?.serviceId
      if (serviceId) {
        // Verificar se subscription já existe
        const existingSubscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (!existingSubscription) {
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
        }

        // Migrar bookings antigos
        if (userId) {
          await db.booking.updateMany({
            where: {
              clientId: client.id,
              userId: null,
            },
            data: {
              userId: userId,
            },
          })
        }

        // Criar booking inicial
        const professionalId = subscriptionMetadata?.professionalId || metadata?.professionalId
        const date = subscriptionMetadata?.date || metadata?.date
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

              revalidatePath("/")
              revalidatePath("/admin")
              revalidatePath("/bookings")

              return {
                success: true,
                booking,
                clientId: client.id,
              }
            }
          }
        }
      }
    } else {
      // Pagamento único
      if (metadata?.professionalId && metadata?.serviceId && metadata?.date) {
        // Migrar bookings antigos
        if (userId) {
          await db.booking.updateMany({
            where: {
              clientId: client.id,
              userId: null,
            },
            data: {
              userId: userId,
            },
          })
        }

        const service = await db.barbershopService.findUnique({
          where: { id: metadata.serviceId },
        })

        if (service) {
          const bookingDate = new Date(metadata.date)
          const slotAvailable = await isSlotAvailable({
            professionalId: metadata.professionalId,
            startDate: bookingDate,
            serviceDuration: service.duration,
          })

          if (slotAvailable) {
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

            revalidatePath("/")
            revalidatePath("/admin")
            revalidatePath("/bookings")

            return {
              success: true,
              booking,
              clientId: client.id,
            }
          }
        }
      }
    }

    return {
      success: true,
      clientId: client.id,
      message: "Sessão processada, mas booking não criado (metadata incompleto)",
    }
  } catch (error: any) {
    console.error("Erro ao processar checkout session:", error)
    return {
      success: false,
      error: error.message || "Erro ao processar sessão",
    }
  }
}

