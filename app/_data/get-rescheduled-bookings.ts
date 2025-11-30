"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { db } from "../_lib/prisma"
import { cookies } from "next/headers"

export const getRescheduledBookings = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  let userId: string | undefined
  let finalClientId: string | undefined

  // Determinar userId ou clientId
  if (session?.user) {
    userId = (session.user as any).id
  } else if (clientId) {
    finalClientId = clientId
  } else if (clientEmail) {
    const client = await db.client.findFirst({
      where: { email: clientEmail },
      select: { id: true },
    })
    if (client) {
      const { saveClientId } = await import("../_actions/save-client-id")
      await saveClientId(client.id)
      finalClientId = client.id
    }
  }

  if (!userId && !finalClientId) {
    return []
  }

  // Buscar todos os bookings do usuário/cliente
  const allBookings = await db.booking.findMany({
    where: {
      ...(userId ? { userId } : { clientId: finalClientId }),
    },
    select: {
      id: true,
    },
  })

  const bookingIds = allBookings.map((b) => b.id)

  if (bookingIds.length === 0) {
    return []
  }

  // Buscar bookings que têm outros bookings com originalBookingId apontando para eles
  // Esses são os bookings originais que foram reagendados
  // Primeiro, buscar todos os bookings que têm reagendamentos (originalBookingId aponta para eles)
  const allBookingsWithReschedules = await db.booking.findMany({
    where: {
      originalBookingId: {
        in: bookingIds,
      },
    },
    select: {
      originalBookingId: true,
    },
  })

  // Extrair os IDs dos bookings originais que foram reagendados
  const originalBookingIds = Array.from(new Set(allBookingsWithReschedules.map(b => b.originalBookingId).filter(Boolean) as string[]))

  if (originalBookingIds.length === 0) {
    return []
  }

  // Buscar os bookings originais que foram reagendados
  const rescheduledOriginalBookings = await db.booking.findMany({
    where: {
      id: {
        in: originalBookingIds as string[],
      },
    },
    include: {
      service: true,
      professional: true,
      payment: true,
    },
    orderBy: {
      date: "desc",
    },
  })

  return rescheduledOriginalBookings
}

