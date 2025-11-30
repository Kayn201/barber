"use server"

import { db } from "../../_lib/prisma"

export const checkNewBookings = async (lastBookingId?: string) => {
  // Se não há último booking conhecido, retornar que há novos
  if (!lastBookingId) {
    return { hasNew: true }
  }

  // Verificar se existe algum booking mais recente que o último conhecido
  const latestBooking = await db.booking.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
    },
  })

  if (!latestBooking) {
    return { hasNew: false }
  }

  // Se o ID do último booking conhecido não existe mais ou é diferente, há novos
  const lastKnownBooking = await db.booking.findUnique({
    where: { id: lastBookingId },
    select: { createdAt: true },
  })

  const hasNew = !lastKnownBooking || latestBooking.id !== lastBookingId

  return {
    hasNew,
    latestBookingId: latestBooking.id,
  }
}

