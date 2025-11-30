import Header from "../_components/header"
import { Card, CardContent } from "../_components/ui/card"
import { Button } from "../_components/ui/button"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { headers } from "next/headers"
import { db } from "../_lib/prisma"
import { redirect } from "next/navigation"

interface SuccessPageProps {
  searchParams: {
    session_id?: string
  }
}

// Função para buscar sessão do Stripe diretamente
async function getStripeSession(sessionId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null
  }

  try {
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer_details"],
    })

    return session
  } catch (error) {
    console.error("Erro ao buscar sessão do Stripe:", error)
    return null
  }
}

const SuccessPage = async ({ searchParams }: SuccessPageProps) => {
  const sessionId = searchParams.session_id

  if (!sessionId) {
    redirect("/")
  }

  // Buscar o booking criado após o pagamento
  const payment = await db.payment.findUnique({
    where: {
      stripeId: sessionId,
    },
    include: {
      booking: {
        include: {
          service: true,
          professional: true,
          client: true,
        },
      },
    },
  })

  // Se encontrou payment e booking, processar normalmente
  if (payment?.booking) {
    // Redirecionar para route handler que salva o cookie
    if (payment.booking.client?.email) {
      console.log("📧 Redirecionando para salvar email no cookie:", payment.booking.client.email)
      redirect(`/api/save-client-cookie?email=${encodeURIComponent(payment.booking.client.email)}&clientId=${payment.booking.clientId}`)
    } else {
      redirect(`/api/save-client-cookie?clientId=${payment.booking.clientId}`)
    }
  }

  // Se não encontrou, pode ser que o webhook ainda não processou
  console.log("⚠️ Payment não encontrado ou sem booking. Session ID:", sessionId)
  
  // Tentar buscar payment diretamente
  const paymentDirect = await db.payment.findUnique({
    where: { stripeId: sessionId },
  })
  
  if (paymentDirect) {
    console.log("💳 Payment encontrado:", paymentDirect.id)
    
    // Buscar booking pelo paymentId
    const bookingByPayment = await db.booking.findFirst({
      where: {
        paymentId: paymentDirect.id,
      },
      include: {
        service: true,
        professional: true,
        client: true,
      },
    })

    if (bookingByPayment) {
      console.log("✅ Booking encontrado pelo paymentId:", bookingByPayment.id)
      
      // Redirecionar para route handler que salva o cookie
      if (bookingByPayment.client?.email) {
        redirect(`/api/save-client-cookie?email=${encodeURIComponent(bookingByPayment.client.email)}&clientId=${bookingByPayment.clientId}`)
      } else {
        redirect(`/api/save-client-cookie?clientId=${bookingByPayment.clientId}`)
      }
    }
  }

  // Se ainda não encontrou, buscar sessão diretamente do Stripe
  // para pegar o email do cliente e salvar no cookie
  console.log("🔍 Buscando sessão diretamente do Stripe...")
  const stripeSession = await getStripeSession(sessionId)
  
  if (stripeSession?.customer_details?.email) {
    const clientEmail = stripeSession.customer_details.email
    console.log("📧 Email encontrado na sessão do Stripe:", clientEmail)
    
    // Redirecionar para route handler que salva o cookie (NÃO passar email na URL final)
    // O route handler vai salvar no cookie e redirecionar para home
    redirect(`/api/save-client-cookie?email=${encodeURIComponent(clientEmail)}`)
  }
  
  // Redirecionar para home - quando o webhook processar, os agendamentos aparecerão
  console.log("⏳ Redirecionando para home - webhook processará em breve")
  redirect("/")
}

export default SuccessPage

