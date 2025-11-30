"use server"

import { endOfDay, startOfDay } from "date-fns"
import { db } from "../_lib/prisma"

interface GetBookingsProps {
  serviceId?: string
  date: Date
  professionalId?: string
}

export const getBookings = ({ date, serviceId, professionalId }: GetBookingsProps) => {
  return db.booking.findMany({
    where: {
      date: {
        lte: endOfDay(date),
        gte: startOfDay(date),
      },
      status: {
        notIn: ["cancelled"], // Excluir apenas cancelled, manter outros status
      },
      ...(professionalId && {
        professionalId,
      }),
      ...(serviceId && {
        serviceId,
      }),
    },
    include: {
      professional: true,
      service: true,
    },
    orderBy: {
      date: "asc",
    },
  })
}
