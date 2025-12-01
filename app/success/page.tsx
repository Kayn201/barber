import Header from "../_components/header"
import { Card, CardContent } from "../_components/ui/card"
import { Button } from "../_components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"
import { headers } from "next/headers"
import { db } from "../_lib/prisma"
import { redirect } from "next/navigation"
import { processCheckoutSession } from "../_actions/process-checkout-session"
import SuccessRedirect from "../_components/success-redirect"

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
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-gray-400 mb-4">Sessão não encontrada</p>
              <Button asChild>
                <Link href="/">Voltar para Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Primeiro, buscar sessão diretamente do Stripe para pegar o email
  // Isso garante que temos o email mesmo se o webhook ainda não processou
  const stripeSession = await getStripeSession(sessionId)
  const clientEmail = stripeSession?.customer_details?.email

  // Buscar o booking criado após o pagamento
  let payment = await db.payment.findUnique({
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

  // Processar tudo no servidor primeiro
  let clientIdToSave: string | null = null

  // Se não encontrou payment, processar a sessão diretamente (simular webhook)
  // Isso garante que os dados apareçam mesmo se o webhook não for chamado
  if (!payment && stripeSession?.payment_status === "paid") {
    console.log("⚠️ Payment não encontrado. Processando sessão diretamente (simulando webhook)...")
    console.log("📦 Metadata da sessão:", JSON.stringify(stripeSession.metadata, null, 2))
    
    try {
      const result = await processCheckoutSession({ sessionId })
      
      if (result.success) {
        if (result.booking) {
          console.log("✅ Booking criado diretamente:", result.booking.id)
          console.log("👤 Client ID:", result.clientId)
          
          // Buscar payment atualizado
          payment = await db.payment.findUnique({
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
        }
        
        // Salvar cookie usando clientId (mais seguro - não expõe email na URL)
        if (result.clientId) {
          clientIdToSave = result.clientId
          const { saveClientCookie } = await import("../_actions/save-client-cookie")
          await saveClientCookie({ clientId: result.clientId })
        } else if (clientEmail) {
          const { saveClientCookie } = await import("../_actions/save-client-cookie")
          await saveClientCookie({ email: clientEmail })
        }
      } else {
        console.error("❌ Erro ao processar sessão:", result.error)
        if (clientEmail) {
          const { saveClientCookie } = await import("../_actions/save-client-cookie")
          await saveClientCookie({ email: clientEmail })
        }
      }
    } catch (error: any) {
      console.error("❌ Erro ao processar checkout session:", error)
      if (clientEmail) {
        const { saveClientCookie } = await import("../_actions/save-client-cookie")
        await saveClientCookie({ email: clientEmail })
      }
    }
  }

  // Se encontrou payment e booking, processar normalmente
  if (payment?.booking) {
    const booking = payment.booking
    const email = booking.client?.email || clientEmail
    
    console.log("✅ Booking encontrado:", booking.id)
    console.log("📧 Email do cliente:", email)
    console.log("👤 Client ID:", booking.clientId)
    
    // Salvar cookie usando clientId (mais seguro)
    if (booking.clientId) {
      clientIdToSave = booking.clientId
      const { saveClientCookie } = await import("../_actions/save-client-cookie")
      await saveClientCookie({ clientId: booking.clientId })
    } else if (email) {
      const { saveClientCookie } = await import("../_actions/save-client-cookie")
      await saveClientCookie({ email })
    }
  }

  // Se não encontrou booking mas tem payment, buscar booking pelo paymentId
  if (payment && !payment.booking) {
    console.log("💳 Payment encontrado mas sem booking. Buscando booking pelo paymentId...")
    
    const bookingByPayment = await db.booking.findFirst({
      where: {
        paymentId: payment.id,
      },
      include: {
        service: true,
        professional: true,
        client: true,
      },
    })

    if (bookingByPayment) {
      console.log("✅ Booking encontrado pelo paymentId:", bookingByPayment.id)
      
      const email = bookingByPayment.client?.email || clientEmail
      
      if (bookingByPayment.clientId) {
        clientIdToSave = bookingByPayment.clientId
        const { saveClientCookie } = await import("../_actions/save-client-cookie")
        await saveClientCookie({ clientId: bookingByPayment.clientId })
      } else if (email) {
        const { saveClientCookie } = await import("../_actions/save-client-cookie")
        await saveClientCookie({ email })
      }
    }
  }

  // Se ainda não encontrou, mas tem email do Stripe, salvar email no cookie
  if (clientEmail && !clientIdToSave) {
    console.log("📧 Email encontrado na sessão do Stripe. Salvando no cookie...")
    const { saveClientCookie } = await import("../_actions/save-client-cookie")
    await saveClientCookie({ email: clientEmail })
  }
  
  // Renderizar página de sucesso com redirect automático
  // Isso evita tela preta enquanto processa
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
            <p className="text-gray-400">
              Seu agendamento foi realizado com sucesso. Você será redirecionado em instantes...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#EE8530]" />
            </div>
            <SuccessRedirect clientId={clientIdToSave} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SuccessPage

