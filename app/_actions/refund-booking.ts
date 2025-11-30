"use server"

import { db } from "../_lib/prisma"
import Stripe from "stripe"
import { revalidatePath } from "next/cache"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

interface RefundBookingParams {
  bookingId: string
  isAdmin?: boolean // Se true, ignora o tempo limite
}

export async function refundBooking({
  bookingId,
  isAdmin = false,
}: RefundBookingParams) {
  try {
    // Buscar o agendamento com todas as informações necessárias
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        payment: true,
      },
    })

    if (!booking) {
      return { success: false, error: "Agendamento não encontrado" }
    }

    if (booking.isRefunded) {
      return { success: false, error: "Este agendamento já foi reembolsado" }
    }

    // Se o booking foi reagendado, buscar o payment do booking original
    let paymentToRefund = booking.payment
    if (!paymentToRefund && (booking as any).originalBookingId) {
      const originalBooking = await db.booking.findUnique({
        where: { id: (booking as any).originalBookingId },
        include: { payment: true },
      })
      if (originalBooking?.payment) {
        paymentToRefund = originalBooking.payment
      }
    }

    if (!paymentToRefund?.stripeId) {
      return {
        success: false,
        error: "Pagamento não encontrado para este agendamento",
      }
    }

    // Verificar regras de reembolso (apenas para clientes, não para admin)
    if (!isAdmin) {
      // Verificar se já reagendou
      // Se o booking atual tem originalBookingId, significa que ele é um reagendamento
      // Se há outros bookings com originalBookingId apontando para este booking, significa que já foi reagendado
      const rootBookingId = (booking as any).originalBookingId || booking.id
      
      // Se o booking atual é um reagendamento (tem originalBookingId), não pode reembolsar
      if ((booking as any).originalBookingId) {
        return {
          success: false,
          error: "Não é possível reembolsar um agendamento que já foi reagendado.",
        }
      }
      
      // Verificar se há outros bookings (reagendamentos) relacionados a este booking
      const relatedBookings = await db.booking.findMany({
        where: {
          originalBookingId: booking.id,
        },
        select: { id: true },
      })
      
      // Se há reagendamentos relacionados, não pode reembolsar
      if (relatedBookings.length > 0) {
        return {
          success: false,
          error: "Não é possível reembolsar um agendamento que já foi reagendado.",
        }
      }

      // Verificar tempo limite de cancelamento configurado pelo ADM
      const now = new Date()
      const bookingDate = new Date(booking.date)
      const timeDifference = bookingDate.getTime() - now.getTime()
      const minutesUntilBooking = timeDifference / (1000 * 60)
      const cancellationTimeMinutes = booking.service.cancellationTimeMinutes || 0

      // Se cancellationTimeMinutes for 0 ou não configurado, permitir reembolso
      if (cancellationTimeMinutes > 0 && minutesUntilBooking < cancellationTimeMinutes) {
        return {
          success: false,
          error: `O tempo limite para cancelamento com reembolso já passou. Você pode cancelar até ${cancellationTimeMinutes} minutos antes do agendamento.`,
        }
      }
    }

    // O stripeId é o checkout_session_id, não o payment_intent
    // Preciso buscar o checkout session primeiro para pegar o payment_intent
    let paymentIntentId: string | null = null
    let subscriptionIdToCancel: string | null = null

    try {
      // Verificar se é um checkout session ID (começa com cs_)
      if (paymentToRefund.stripeId.startsWith("cs_")) {
        // Buscar o checkout session
        const session = await stripe.checkout.sessions.retrieve(
          paymentToRefund.stripeId,
          {
            expand: ["payment_intent", "subscription"],
          }
        )

        console.log("Checkout session encontrado:", {
          id: session.id,
          payment_status: session.payment_status,
          payment_intent: session.payment_intent,
          subscription: session.subscription,
          mode: session.mode,
        })

        // Verificar se é uma subscription
        if (session.subscription) {
          // Para subscriptions, precisamos buscar o invoice mais recente
          const subscriptionId = typeof session.subscription === "string" 
            ? session.subscription 
            : session.subscription.id

          console.log("É uma subscription, buscando invoice:", subscriptionId)

          // Buscar a subscription no banco de dados para cancelar depois
          const subscription = await db.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          })

          // Buscar o invoice mais recente da subscription
          const invoices = await stripe.invoices.list({
            subscription: subscriptionId,
            limit: 1,
          })

          if (invoices.data.length === 0) {
            return {
              success: false,
              error: "Invoice não encontrado para esta assinatura",
            }
          }

          const invoice = invoices.data[0] as any
          console.log("Invoice encontrado:", {
            id: invoice.id,
            payment_intent: invoice.payment_intent,
            charge: invoice.charge,
          })
          
          // Buscar o payment intent do invoice
          if (invoice.payment_intent) {
            paymentIntentId = typeof invoice.payment_intent === "string"
              ? invoice.payment_intent
              : invoice.payment_intent.id
          } else if (invoice.charge) {
            // Se não tem payment_intent, tentar usar o charge diretamente
            const chargeId = typeof invoice.charge === "string"
              ? invoice.charge
              : invoice.charge.id
            
            // Buscar o charge para obter o payment_intent
            const charge = await stripe.charges.retrieve(chargeId)
            if (charge.payment_intent) {
              paymentIntentId = typeof charge.payment_intent === "string"
                ? charge.payment_intent
                : charge.payment_intent.id
            } else {
              return {
                success: false,
                error: "Payment intent não encontrado no charge da assinatura",
              }
            }
          } else {
            return {
              success: false,
              error: "Payment intent não encontrado no invoice da assinatura",
            }
          }

          // Guardar subscriptionId para cancelar depois do reembolso
          subscriptionIdToCancel = subscriptionId
        } else {
          // Obter o payment_intent do checkout session (pagamento único)
          if (typeof session.payment_intent === "string") {
            paymentIntentId = session.payment_intent
          } else if (session.payment_intent) {
            paymentIntentId = session.payment_intent.id
          } else {
            // Se não tem payment_intent, verificar o payment_status
            console.log("Payment intent não encontrado, payment_status:", session.payment_status)
            
            if (session.payment_status === "paid") {
              // Se está pago mas não tem payment_intent, pode ser um pagamento direto
              // Tentar buscar pelos line items para ver se tem mais informações
              try {
                const lineItems = await stripe.checkout.sessions.listLineItems(
                  paymentToRefund.stripeId,
                  { limit: 1, expand: ["data.price.product"] }
                )
                
                console.log("Line items encontrados:", lineItems.data.length)
                
                // Se não encontrou payment_intent mesmo estando pago, retornar erro mais específico
                return {
                  success: false,
                  error: "Payment intent não encontrado no checkout session. O pagamento pode ter sido processado de forma diferente ou o checkout session pode estar incompleto.",
                }
              } catch (error: any) {
                console.error("Erro ao buscar line items:", error)
                return {
                  success: false,
                  error: "Payment intent não encontrado no checkout session e não foi possível buscar informações adicionais.",
                }
              }
            } else {
              return {
                success: false,
                error: `Payment intent não encontrado no checkout session. Status do pagamento: ${session.payment_status}`,
              }
            }
          }
        }
      } else {
        // Se não começa com cs_, assumir que já é um payment_intent
        paymentIntentId = paymentToRefund.stripeId
      }

      if (!paymentIntentId) {
        return {
          success: false,
          error: "Payment intent não encontrado",
        }
      }

      // Buscar o payment intent no Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (!paymentIntent) {
        return { success: false, error: "Pagamento não encontrado no Stripe" }
      }

      // Verificar se já foi reembolsado no Stripe
      if (paymentIntent.status === "canceled") {
        return { success: false, error: "Este pagamento já foi cancelado" }
      }

      // Criar reembolso no Stripe
      let refund
      try {
        // Buscar o charge mais recente
        const charges = await stripe.charges.list({
          payment_intent: paymentIntentId,
          limit: 1,
        })

        if (charges.data.length === 0) {
          return {
            success: false,
            error: "Charge não encontrado para este pagamento",
          }
        }

        const charge = charges.data[0]

        // Criar reembolso
        refund = await stripe.refunds.create({
          charge: charge.id,
          reason: "requested_by_customer",
        })
      } catch (stripeError: any) {
        console.error("Erro ao criar reembolso no Stripe:", stripeError)
        
        // Se o charge já foi reembolsado, apenas atualizar o booking no banco
        if (stripeError.code === "charge_already_refunded") {
          console.log("Charge já foi reembolsado, atualizando booking no banco...")
          // Continuar o fluxo para atualizar o booking
          refund = { id: "already_refunded" } as any
        } else {
          return {
            success: false,
            error:
              stripeError.message ||
              "Erro ao processar reembolso. Tente novamente mais tarde.",
          }
        }
      }

      // Se for uma subscription, cancelar a subscription no Stripe
      if (subscriptionIdToCancel) {
        try {
          await stripe.subscriptions.cancel(subscriptionIdToCancel)
          
          // Atualizar a subscription no banco de dados
          await db.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionIdToCancel },
            data: {
              status: "canceled",
              cancelAtPeriodEnd: false,
            },
          })
          
          console.log("Subscription cancelada:", subscriptionIdToCancel)
        } catch (subscriptionError: any) {
          console.error("Erro ao cancelar subscription:", subscriptionError)
          // Não falhar o reembolso se houver erro ao cancelar a subscription
          // O reembolso já foi processado
        }
      }

      // Atualizar o agendamento no banco de dados
      await db.booking.update({
        where: { id: bookingId },
        data: {
          isRefunded: true,
          status: "cancelled",
        },
      })

      revalidatePath("/bookings")
      revalidatePath("/admin")
      revalidatePath("/")
      
      // Se cancelou uma subscription, também revalidar pode ajudar
      if (subscriptionIdToCancel) {
        revalidatePath("/admin", "layout")
      }

      return {
        success: true,
        refundId: refund.id === "already_refunded" ? undefined : refund.id,
        message: refund.id === "already_refunded" 
          ? "Este pagamento já havia sido reembolsado. Booking atualizado."
          : "Reembolso processado com sucesso",
      }
    } catch (stripeError: any) {
      console.error("Erro ao buscar checkout session ou payment intent:", stripeError)
      return {
        success: false,
        error:
          stripeError.message ||
          "Erro ao processar reembolso. Tente novamente mais tarde.",
      }
    }
  } catch (error) {
    console.error("Erro ao processar reembolso:", error)
    return {
      success: false,
      error: "Erro ao processar reembolso. Tente novamente mais tarde.",
    }
  }
}

