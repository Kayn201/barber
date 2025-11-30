"use server"

import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"

interface CreatePaymentIntentParams {
  professionalId: string
  serviceId: string
  date: Date
  amount: number
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  userId?: string // ID do usuário logado (para assinaturas)
}

export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<{ clientSecret: string; paymentIntentId: string } | null> => {
  try {
    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe não está configurado")
    }

    // Importar Stripe dinamicamente
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    })

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

    // Verificar se é assinatura
    const isSubscription = service.isSubscription && service.subscriptionInterval

    // Se for assinatura, precisamos criar um Customer no Stripe primeiro
    // Mas como ainda não temos os dados do cliente, vamos criar a subscription após o pagamento
    // Por enquanto, apenas marcamos no metadata que é uma assinatura
    let stripeSubscriptionId: string | null = null

    // Criar Payment Intent (cliente será criado após o pagamento)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Converter para centavos
      currency: "brl",
      metadata: {
        professionalId: params.professionalId,
        serviceId: params.serviceId,
        date: params.date.toISOString(),
        clientName: params.clientName || "",
        clientEmail: params.clientEmail || "",
        clientPhone: params.clientPhone || "",
        userId: params.userId || "",
        stripeSubscriptionId: stripeSubscriptionId || "",
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "always", // Permitir PIX via Link
      },
    })

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    console.error("Erro ao criar Payment Intent:", error)
    return null
  }
}

