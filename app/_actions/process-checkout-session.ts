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

      // Buscar subscription do Stripe - tentar apenas 1 vez
      // Se não conseguir as datas corretas, NÃO criar a subscription aqui
      // O webhook vai criar quando receber o evento com as datas corretas
      let subscriptionData: any = null
      let currentPeriodStart: Date | null = null
      let currentPeriodEnd: Date | null = null
      
      try {
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['latest_invoice', 'customer'],
        })
        subscriptionData = subscriptionResponse as any
        
        console.log("📋 Dados da subscription do Stripe:")
        console.log("   - subscriptionId:", subscriptionId)
        console.log("   - current_period_start:", subscriptionData.current_period_start)
        console.log("   - current_period_end:", subscriptionData.current_period_end)
        console.log("   - status:", subscriptionData.status)
        
        // IMPORTANTE: Só usar as datas se current_period_start e current_period_end estiverem presentes
        // Não usar period_start/period_end do invoice, pois podem ser do período anterior
        if (subscriptionData.current_period_start && subscriptionData.current_period_end) {
          currentPeriodStart = new Date(subscriptionData.current_period_start * 1000)
          currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000)
          
          // Validar que as datas são válidas e diferentes
          if (!isNaN(currentPeriodStart.getTime()) && !isNaN(currentPeriodEnd.getTime()) && currentPeriodStart < currentPeriodEnd) {
            console.log("✅ Datas válidas encontradas na subscription!")
            console.log("   - currentPeriodStart:", currentPeriodStart)
            console.log("   - currentPeriodEnd:", currentPeriodEnd)
          } else {
            console.warn("⚠️ Datas inválidas ou iguais")
            currentPeriodStart = null
            currentPeriodEnd = null
          }
        } else {
          console.log("ℹ️ current_period_start ou current_period_end não disponíveis ainda")
          console.log("   A subscription será criada pelo webhook quando o Stripe enviar as datas corretas")
        }
      } catch (error: any) {
        console.error("❌ Erro ao buscar subscription:", error.message)
        console.log("   A subscription será criada pelo webhook quando o Stripe enviar as datas corretas")
      }
      
      // Se não conseguiu obter as datas corretas, verificar se o webhook já processou
      // Se não processou, aguardar um pouco e tentar novamente (apenas 1 vez)
      if (!currentPeriodStart || !currentPeriodEnd || isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
        console.log("ℹ️ Não foi possível obter datas válidas da subscription na primeira tentativa")
        
        // Verificar se o webhook já processou (subscription já existe no banco)
        const existingSubscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })
        
        if (existingSubscription) {
          console.log("✅ Subscription já foi criada pelo webhook!")
          subscriptionData = { status: existingSubscription.status }
          currentPeriodStart = existingSubscription.currentPeriodStart
          currentPeriodEnd = existingSubscription.currentPeriodEnd
        } else {
          // Aguardar 3 segundos e tentar buscar novamente do Stripe (webhook pode ter processado)
          console.log("   Aguardando 3 segundos para o webhook processar...")
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          try {
            const subscriptionResponseRetry = await stripe.subscriptions.retrieve(subscriptionId)
            const subscriptionDataRetry = subscriptionResponseRetry as any
            
            if (subscriptionDataRetry.current_period_start && subscriptionDataRetry.current_period_end) {
              currentPeriodStart = new Date(subscriptionDataRetry.current_period_start * 1000)
              currentPeriodEnd = new Date(subscriptionDataRetry.current_period_end * 1000)
              
              if (!isNaN(currentPeriodStart.getTime()) && !isNaN(currentPeriodEnd.getTime()) && currentPeriodStart < currentPeriodEnd) {
                subscriptionData = subscriptionDataRetry
                console.log("✅ Datas encontradas na segunda tentativa!")
                console.log("   - currentPeriodStart:", currentPeriodStart)
                console.log("   - currentPeriodEnd:", currentPeriodEnd)
              }
            }
          } catch (error: any) {
            console.log("   Ainda não disponível, deixando webhook processar")
          }
          
          // Se ainda não tem datas, tentar processar manualmente (para desenvolvimento local)
          if (!currentPeriodStart || !currentPeriodEnd || isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
            console.log("ℹ️ Tentando processar subscription manualmente (webhook pode não estar disponível em desenvolvimento)...")
            
            try {
              const { processSubscriptionWebhook } = await import("./process-subscription-webhook")
              const result = await processSubscriptionWebhook(subscriptionId)
              
              if (result.success) {
                console.log("✅ Subscription processada manualmente com sucesso!")
                // Buscar subscription criada para retornar
                const createdSubscription = await db.subscription.findUnique({
                  where: { stripeSubscriptionId: subscriptionId },
                })
                
                if (createdSubscription) {
                  subscriptionData = { status: createdSubscription.status }
                  currentPeriodStart = createdSubscription.currentPeriodStart
                  currentPeriodEnd = createdSubscription.currentPeriodEnd
                } else {
                  return {
                    success: true,
                    clientId: client.id,
                    message: result.message || "Subscription será criada pelo webhook quando o evento for processado.",
                  }
                }
              } else {
                console.log("⚠️ Não foi possível processar manualmente:", result.error)
                console.log("   A subscription será criada pelo webhook quando o Stripe enviar o evento")
                
                return {
                  success: true,
                  clientId: client.id,
                  message: "Subscription será criada pelo webhook com as datas corretas do Stripe quando o evento for processado.",
                }
              }
            } catch (error: any) {
              console.error("❌ Erro ao processar manualmente:", error.message)
              console.log("   A subscription será criada pelo webhook quando o Stripe enviar o evento")
              
              return {
                success: true,
                clientId: client.id,
                message: "Subscription será criada pelo webhook com as datas corretas do Stripe quando o evento for processado.",
              }
            }
          }
        }
      }

      console.log("📋 Dados finais da subscription:")
      console.log("   - subscriptionId:", subscriptionId)
      console.log("   - status:", subscriptionData?.status || "unknown")
      console.log("   - currentPeriodStart:", currentPeriodStart)
      console.log("   - currentPeriodEnd:", currentPeriodEnd)
      console.log("   - cancel_at_period_end:", subscriptionData?.cancel_at_period_end || false)

      const subscriptionMetadata = subscriptionData?.metadata || metadata

      const serviceId = subscriptionMetadata?.serviceId || metadata?.serviceId
      if (serviceId) {
        // Verificar se subscription já existe
        const existingSubscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (!existingSubscription) {
          console.log("💾 Criando subscription no banco de dados (processCheckoutSession):")
          console.log("   - clientId:", client.id)
          console.log("   - serviceId:", serviceId)
          console.log("   - stripeSubscriptionId:", subscriptionId)
          console.log("   - status:", subscriptionData?.status || "active")
          console.log("   - currentPeriodStart:", currentPeriodStart)
          console.log("   - currentPeriodEnd:", currentPeriodEnd)
          
          await db.subscription.create({
            data: {
              clientId: client.id,
              serviceId: serviceId,
              stripeSubscriptionId: subscriptionId,
              status: subscriptionData?.status || "active",
              currentPeriodStart: currentPeriodStart,
              currentPeriodEnd: currentPeriodEnd,
              cancelAtPeriodEnd: subscriptionData?.cancel_at_period_end || false,
              paymentId: payment.id,
            },
          })
          
          console.log("✅ Subscription criada com sucesso (processCheckoutSession)!")
        } else {
          console.log("ℹ️ Subscription já existe no banco de dados")
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

        // Criar booking inicial (primeiro agendamento da assinatura)
        const professionalId = subscriptionMetadata?.professionalId || metadata?.professionalId
        const date = subscriptionMetadata?.date || metadata?.date
        
        console.log("📅 Tentando criar booking inicial da assinatura:")
        console.log("   - professionalId:", professionalId)
        console.log("   - date:", date)
        console.log("   - serviceId:", serviceId)
        
        if (professionalId && date) {
          const service = await db.barbershopService.findUnique({
            where: { id: serviceId },
          })

          if (service) {
            const bookingDate = new Date(date)
            console.log("   - bookingDate:", bookingDate)
            
            const slotAvailable = await isSlotAvailable({
              professionalId,
              startDate: bookingDate,
              serviceDuration: service.duration,
            })

            console.log("   - slotAvailable:", slotAvailable)

            if (slotAvailable) {
              try {
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

                console.log("✅ Booking criado com sucesso:", booking.id)

                revalidatePath("/")
                revalidatePath("/admin")
                revalidatePath("/bookings")

                return {
                  success: true,
                  booking,
                  clientId: client.id,
                }
              } catch (bookingError: any) {
                console.error("❌ Erro ao criar booking:", bookingError.message)
                // Continuar mesmo se o booking falhar - a subscription já foi criada
              }
            } else {
              console.warn("⚠️ Slot não está mais disponível para o booking inicial")
            }
          } else {
            console.error("❌ Serviço não encontrado para criar booking")
          }
        } else {
          console.warn("⚠️ Metadata incompleto para criar booking inicial (professionalId ou date faltando)")
        }
        
        // Se chegou aqui, a subscription foi criada mas o booking não
        // Retornar sucesso mesmo assim, pois a subscription é o mais importante
        console.log("✅ Subscription criada, mas booking não foi criado (será criado pelo usuário depois)")
        return {
          success: true,
          clientId: client.id,
          message: "Subscription criada com sucesso. O primeiro agendamento pode ser feito depois.",
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

