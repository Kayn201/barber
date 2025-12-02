"use server"

import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { getBaseUrl } from "../_lib/get-base-url"

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

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se é assinatura e se já tem assinatura ativa
    // Esta validação DEVE acontecer ANTES de criar qualquer checkout session
    if (service.isSubscription && service.subscriptionInterval) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        console.error("❌ BLOQUEADO: Usuário não autenticado para assinatura")
        throw new Error("Autenticação necessária para assinaturas")
      }
      
      const userEmail = (session.user as any).email
      console.log("🔍 VALIDAÇÃO: Verificando se usuário já tem assinatura ativa")
      console.log("   - Email:", userEmail)
      console.log("   - ServiceId:", params.serviceId)
      
      // Buscar TODAS as assinaturas do cliente para este serviço
      // Uma assinatura é válida se: status === "active" E currentPeriodEnd >= now
      // Mesmo que cancelAtPeriodEnd === true, ainda é válida até o final do período
      const client = await db.client.findFirst({
        where: { email: userEmail },
        include: {
          subscriptions: {
            where: {
              serviceId: params.serviceId,
              status: "active",
              currentPeriodEnd: {
                gte: new Date(), // Ainda não expirou - isso é o que importa
              },
              // Removido cancelAtPeriodEnd: false - mesmo marcada para cancelar, ainda é válida até o final do período
            },
          },
        },
      })
      
      console.log("📋 Resultado da validação:")
      console.log("   - Cliente encontrado:", !!client)
      console.log("   - Total de assinaturas encontradas:", client?.subscriptions.length || 0)
      
      if (client?.subscriptions.length > 0) {
        client.subscriptions.forEach((sub, index) => {
          console.log(`   - Assinatura ${index + 1}:`)
          console.log("     * ID:", sub.id)
          console.log("     * Status:", sub.status)
          console.log("     * currentPeriodEnd:", sub.currentPeriodEnd)
          console.log("     * cancelAtPeriodEnd:", sub.cancelAtPeriodEnd)
          console.log("     * Válida até:", sub.currentPeriodEnd > new Date() ? "SIM" : "NÃO")
        })
        
        // Verificar se alguma assinatura está realmente ativa e válida
        const activeSubscription = client.subscriptions.find(
          (sub) => sub.status === "active" && sub.currentPeriodEnd >= new Date()
        )
        
        if (activeSubscription) {
          console.error("❌ BLOQUEADO: Usuário já possui assinatura ativa e válida para este serviço!")
          console.error("   - Subscription ID:", activeSubscription.id)
          console.error("   - Válida até:", activeSubscription.currentPeriodEnd)
          throw new Error("Você já possui uma assinatura ativa para este serviço. Não é possível criar uma nova assinatura enquanto a atual estiver válida.")
        }
      }
      
      console.log("✅ Validação passou: Nenhuma assinatura ativa encontrada, pode prosseguir com checkout")
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

    // Determinar URL base - usar URL de produção
    const baseUrl = getBaseUrl()

    // Configurar base do checkout com tradução PT-BR
    const baseConfig: any = {
      payment_method_types: paymentMethodTypes,
      locale: "pt-BR",
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/book?professional=${params.professionalId}`,
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

