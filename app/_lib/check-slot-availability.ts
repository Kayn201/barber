import { addMinutes, endOfDay, startOfDay } from "date-fns"
import { db } from "./prisma"

interface SlotAvailabilityProps {
  professionalId: string
  startDate: Date
  serviceDuration: number
  excludeBookingId?: string
  excludeBookingIds?: string[]
}

export const isSlotAvailable = async ({
  professionalId,
  startDate,
  serviceDuration,
  excludeBookingId,
  excludeBookingIds,
}: SlotAvailabilityProps) => {
  const bookings = await db.booking.findMany({
    where: {
      professionalId,
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(startDate),
      },
      status: {
        notIn: ["cancelled"],
      },
      ...(excludeBookingId && {
        id: {
          not: excludeBookingId,
        },
      }),
      ...(excludeBookingIds && {
        id: {
          notIn: excludeBookingIds,
        },
      }),
    },
    include: {
      service: true,
    },
  })

  const proposedEnd = addMinutes(startDate, serviceDuration)

  return !bookings.some((booking) => {
    const bookingStart = new Date(booking.date)
    const bookingEnd = addMinutes(bookingStart, booking.service.duration)

    const startsDuring = startDate >= bookingStart && startDate < bookingEnd
    const endsDuring = proposedEnd > bookingStart && proposedEnd <= bookingEnd
    const surrounds = startDate <= bookingStart && proposedEnd >= bookingEnd

    return startsDuring || endsDuring || surrounds
  })
}


