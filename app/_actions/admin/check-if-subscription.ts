"use server"

import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const checkIfPaymentIsSubscription = async (stripeId: string): Promise<boolean> => {
  try {
    // Se é um checkout session ID (começa com cs_)
    if (stripeId.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(stripeId, {
        expand: ["subscription"],
      })
      return !!session.subscription
    }
    return false
  } catch (error) {
    console.error("Erro ao verificar se é subscription:", error)
    return false
  }
}

