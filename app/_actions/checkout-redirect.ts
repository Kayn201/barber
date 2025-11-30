"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createCheckoutSession } from "./create-checkout-session"
import { db } from "../_lib/prisma"

interface CheckoutRedirectParams {
  professional: string
  service: string
  date: string
  returnUrl?: string
}

export async function checkoutRedirect(params: CheckoutRedirectParams) {
  const { professional, service, date, returnUrl } = params
  const cookieStore = cookies()
  
  // Criar uma chave única baseada nos parâmetros da requisição
  const checkoutKey = `checkout_${professional}_${service}_${date?.replace(/[:.]/g, '_')}`

  // Verificar se já foi para o Stripe (cookie existe)
  const hasGoneToStripe = cookieStore.get(checkoutKey)?.value === "true"

  // Se já foi para o Stripe e houver returnUrl, redirecionar para o returnUrl
  if (hasGoneToStripe && returnUrl) {
    redirect(decodeURIComponent(returnUrl))
  }

  // Validar dados
  const professionalData = await db.professional.findUnique({
    where: { id: professional },
  })

  const serviceData = await db.barbershopService.findUnique({
    where: { id: service },
  })

  if (!professionalData || !serviceData) {
    if (returnUrl) {
      redirect(decodeURIComponent(returnUrl))
    }
    redirect("/")
  }

  const bookingDate = new Date(date)

  // Criar sessão de checkout do Stripe
  const checkoutUrl = await createCheckoutSession({
    professionalId: professional,
    serviceId: service,
    date: bookingDate,
    amount: Number(serviceData.price),
  })

  if (checkoutUrl) {
    // Marcar que foi para o Stripe (cookie expira em 1 hora)
    cookieStore.set(checkoutKey, "true", {
      maxAge: 3600, // 1 hora
      httpOnly: true,
      sameSite: "lax",
    })
    redirect(checkoutUrl)
  }

  // Se falhar, redirecionar para returnUrl ou home
  if (returnUrl) {
    redirect(decodeURIComponent(returnUrl))
  }
  redirect("/")
}

