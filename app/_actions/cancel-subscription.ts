"use server"

import { revalidatePath } from "next/cache"
import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"

interface CancelSubscriptionParams {
  subscriptionId: string
  cancelImmediately?: boolean // true = cancelar imediatamente, false = cancelar no final do período
  isAdmin?: boolean
}

export const cancelSubscription = async ({
  subscriptionId,
  cancelImmediately = false,
  isAdmin = false,
}: CancelSubscriptionParams) => {
  try {
    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      return { success: false, error: "Stripe não está configurado" }
    }

    // Importar Stripe dinamicamente
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Buscar subscription no banco de dados
    const subscription = await db.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        client: true,
      },
    })

    if (!subscription) {
      return { success: false, error: "Assinatura não encontrada" }
    }

    // Se não for admin, verificar se o usuário tem permissão
    if (!isAdmin) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return { success: false, error: "Usuário não autenticado" }
      }

      // Verificar se o client pertence ao usuário logado
      const userEmail = (session.user as any).email
      if (subscription.client.email !== userEmail) {
        return { success: false, error: "Você não tem permissão para cancelar esta assinatura" }
      }

      // Usuário só pode cancelar no final do período (não imediatamente)
      cancelImmediately = false
    }

    // Cancelar no Stripe
    if (cancelImmediately) {
      // Cancelar imediatamente
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      
      // Atualizar no banco de dados
      await db.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "canceled",
          cancelAtPeriodEnd: false,
        },
      })
    } else {
      // Cancelar no final do período (cancel_at_period_end = true)
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      
      // Atualizar no banco de dados
      await db.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
        },
      })
    }

    // Revalidar páginas
    revalidatePath("/subscriptions")
    revalidatePath("/admin")
    revalidatePath("/")

    return { success: true }
  } catch (error: any) {
    console.error("Erro ao cancelar assinatura:", error)
    return {
      success: false,
      error: error.message || "Erro ao cancelar assinatura",
    }
  }
}

