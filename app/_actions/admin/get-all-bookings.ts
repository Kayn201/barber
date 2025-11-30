"use server"

import { db } from "../../_lib/prisma"

export const getAllBookings = async () => {
  const bookings = await db.booking.findMany({
    include: {
      client: true,
      service: true,
      professional: true,
      payment: true,
      originalBooking: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: {
      date: "desc",
    },
    take: 50,
  })

  return bookings
}

