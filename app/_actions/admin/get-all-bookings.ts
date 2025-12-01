"use server"

import { db } from "../../_lib/prisma"

export const getAllBookings = async () => {
  const bookings = await db.booking.findMany({
    include: {
      client: {
        select: {
          id: true,
          name: true,
          // Não incluir email, phone, stripeId - dados sensíveis
        },
      },
      service: true,
      professional: true,
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          // Não incluir stripeId - dado sensível
        },
      },
      originalBooking: {
        select: {
          id: true,
          createdAt: true,
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              type: true,
              createdAt: true,
              updatedAt: true,
              // Não incluir stripeId - dado sensível
            },
          },
        },
      },
      rescheduledBookings: {
        select: {
          id: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 50,
  })

  // Remover dados sensíveis antes de retornar
  return bookings.map((booking) => ({
    ...booking,
    client: booking.client ? {
      id: booking.client.id,
      name: booking.client.name,
      // Email, phone e stripeId removidos
    } : null,
  }))
}

