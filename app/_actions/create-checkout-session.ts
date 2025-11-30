"use server"

import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"

interface CreateCheckoutSessionParams {
  professionalId: string
  serviceId: string
  date: Date
  amount: number
}

export const createCheckoutSession = async (
  params: CreateCheckoutSessionParams
): Promise<string | null> => {
  try {
    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe não está configurado")
    }

    // Importar Stripe dinamicamente
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Buscar dados do serviço e profissional
    const service = await db.barbershopService.findUnique({
      where: { id: params.serviceId },
    })

    const professional = await db.professional.findUnique({
      where: { id: params.professionalId },
    })

    if (!service || !professional) {
      throw new Error("Serviço ou profissional não encontrado")
    }

    // Verificar se é assinatura - se for, exigir autenticação
    // Nota: A verificação de autenticação já é feita no frontend (booking-review-card)
    // Esta verificação é uma camada extra de segurança
    if (service.isSubscription && service.subscriptionInterval) {
      try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
          console.error("Erro: Usuário não autenticado para assinatura")
          throw new Error("Autenticação necessária para assinaturas")
        }
        console.log("Usuário autenticado para assinatura:", session.user.email)
      } catch (authError) {
        console.error("Erro ao verificar autenticação:", authError)
        throw new Error("Autenticação necessária para assinaturas")
      }
    }

    // Métodos de pagamento disponíveis
    // Nota: PIX precisa estar habilitado no dashboard do Stripe
    // Para habilitar: https://dashboard.stripe.com/account/payments/settings
    const paymentMethodTypes: string[] = ["card"]
    
    // PIX temporariamente desabilitado - precisa ser ativado no dashboard do Stripe
    // Para ativar PIX:
    // 1. Acesse: https://dashboard.stripe.com/account/payments/settings
    // 2. Ative o método de pagamento PIX
    // 3. Descomente a linha abaixo
    // if (!service.isSubscription) {
    //   paymentMethodTypes.push("pix")
    // }

    // Configurar base do checkout com tradução PT-BR
    const baseConfig: any = {
      payment_method_types: paymentMethodTypes,
      locale: "pt-BR",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/book?professional=${params.professionalId}`,
      metadata: {
        professionalId: params.professionalId,
        serviceId: params.serviceId,
        date: params.date.toISOString(),
      },
      phone_number_collection: {
        enabled: true,
      },
    }

    // Apple Pay e Google Pay são habilitados automaticamente pelo Stripe
    // quando o método de pagamento "card" está disponível

    // Verificar se é assinatura ou pagamento único
    if (service.isSubscription && service.subscriptionInterval) {
      // Verificar autenticação novamente antes de criar assinatura
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        throw new Error("Autenticação necessária para assinaturas")
      }

      // Criar checkout para assinatura
      baseConfig.mode = "subscription"
      baseConfig.customer_email = session.user.email || undefined
      // Adicionar userId no metadata para associar ao booking
      baseConfig.metadata = {
        ...baseConfig.metadata,
        userId: (session.user as any).id,
      }
      baseConfig.subscription_data = {
        metadata: {
          professionalId: params.professionalId,
          serviceId: params.serviceId,
          userId: (session.user as any).id,
          date: params.date.toISOString(),
        },
      }
      baseConfig.line_items = [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: service.name,
              description: `Plano de assinatura - ${professional.name}`,
            },
            recurring: {
              interval: service.subscriptionInterval as "month" | "week" | "year",
            },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ]
    } else {
      // Criar checkout para pagamento único
      // Se houver usuário logado, adicionar userId no metadata e email
      const session = await getServerSession(authOptions)
      if (session?.user) {
        baseConfig.metadata = {
          ...baseConfig.metadata,
          userId: (session.user as any).id,
        }
        // Preencher email automaticamente quando logado
        baseConfig.customer_email = session.user.email || undefined
      }
      baseConfig.mode = "payment"
      baseConfig.line_items = [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: service.name,
              description: `Agendamento com ${professional.name}`,
            },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ]
    }

    const session = await stripe.checkout.sessions.create(baseConfig)

    if (!session.url) {
      throw new Error("Não foi possível criar a URL de checkout")
    }

    return session.url
  } catch (error: any) {
    // Log detalhado do erro
    console.error("Erro ao criar sessão de checkout:", {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      statusCode: error?.statusCode,
      raw: error?.raw,
      stack: error?.stack,
    })
    
    // Retornar null para que a página possa tratar o erro
    return null
  }
}

