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

  if (!checkoutUrl) {
    redirect(`/book?professional=${professional}&error=checkout_failed`)
  }

  redirect(checkoutUrl)
}

export default CheckoutPage


