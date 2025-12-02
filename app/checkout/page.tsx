import { db } from "../_lib/prisma"
import { notFound, redirect } from "next/navigation"
import { createCheckoutSession } from "../_actions/create-checkout-session"

interface CheckoutPageProps {
  searchParams: {
    professional?: string
    service?: string
    date?: string
  }
}

const CheckoutPage = async ({ searchParams }: CheckoutPageProps) => {
  const { professional, service, date } = searchParams

  if (!professional || !service || !date) {
    return notFound()
  }

  const professionalData = await db.professional.findUnique({
    where: { id: professional },
  })

  const serviceData = await db.barbershopService.findUnique({
    where: { id: service },
  })

  if (!professionalData || !serviceData) {
    return notFound()
  }

  const bookingDate = new Date(date)

  if (serviceData.isSubscription && serviceData.subscriptionInterval) {
    const { getServerSession } = await import("next-auth")
    const { authOptions } = await import("../_lib/auth")
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      redirect(`/book?professional=${professional}&error=auth_required`)
    }
  }

  const checkoutUrl = await createCheckoutSession({
    professionalId: professional,
    serviceId: service,
    date: bookingDate,
    amount: Number(serviceData.price),
  })

  // Se checkoutUrl for null, significa que o usuário já tem assinatura ativa
  // Nesse caso, criar o booking diretamente sem pagamento
  if (!checkoutUrl) {
    if (serviceData.isSubscription) {
      // Buscar assinatura ativa do usuário
      const { getServerSession } = await import("next-auth")
      const { authOptions } = await import("../_lib/auth")
      const session = await getServerSession(authOptions)
      
      if (session?.user) {
        const userEmail = (session.user as any).email
        const client = await db.client.findFirst({
          where: { email: userEmail },
          include: {
            subscriptions: {
              where: {
                serviceId: service,
                status: "active",
                currentPeriodEnd: {
                  gte: new Date(), // Ainda não expirou - isso é o que importa
                },
                // Removido cancelAtPeriodEnd: false - mesmo marcada para cancelar, ainda é válida até o final do período
              },
            },
          },
        })
        
        if (client && client.subscriptions.length > 0) {
          // Criar booking diretamente sem pagamento
          const { createBookingFromSubscription } = await import("../_actions/create-booking-from-subscription")
          const result = await createBookingFromSubscription({
            serviceId: service,
            professionalId: professional,
            date: bookingDate,
            subscriptionId: client.subscriptions[0].id,
          })
          
          if (result.success) {
            redirect(`/?booking=created`)
          } else {
            redirect(`/book?professional=${professional}&error=booking_failed`)
          }
        }
      }
    }
    
    redirect(`/book?professional=${professional}&error=checkout_failed`)
  }

  redirect(checkoutUrl)
}

export default CheckoutPage


