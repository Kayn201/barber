import { db } from "../_lib/prisma"
import { notFound } from "next/navigation"
import BookingFlow from "../_components/booking-flow"
import Header from "../_components/header"
import { Suspense } from "react"

interface BookPageProps {
  searchParams: {
    professional?: string
    error?: string
  }
}

const BookPage = async ({ searchParams }: BookPageProps) => {
  const professionalId = searchParams.professional

  if (!professionalId) {
    return notFound()
  }

  const professional = await db.professional.findUnique({
    where: {
      id: professionalId,
    },
    include: {
      services: {
        include: {
          service: true,
        },
      },
      weeklySchedule: true,
      blockedDates: true,
      ratings: true,
    },
  })

  // Buscar horários da empresa uma vez
  const barbershop = await db.barbershop.findFirst({
    include: {
      businessHours: true,
    },
  })

  if (!professional) {
    return notFound()
  }

  // Calcular média de avaliações
  const averageRating =
    professional.ratings.length > 0
      ? professional.ratings.reduce((sum, r) => sum + r.score, 0) /
        professional.ratings.length
      : 0

  const normalizedProfessional = {
    ...professional,
    services: professional.services.map((ps) => ({
      ...ps,
      service: {
        ...ps.service,
        price: Number(ps.service.price),
      },
    })),
  }

  return (
    <div>
      <Header />
      <div className="p-5">
        <Suspense fallback={<div>Carregando...</div>}>
          <BookingFlow
            professional={JSON.parse(JSON.stringify(normalizedProfessional))}
            averageRating={averageRating}
            businessHours={barbershop ? JSON.parse(JSON.stringify(barbershop.businessHours)) : []}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default BookPage

