"use client"

import { useState } from "react"
import ActiveBookingCard from "./active-booking-card"
import { Button } from "./ui/button"
import { Prisma } from "@prisma/client"

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    service: true
    professional: true
    client: true
    payment: true
  }
}>

interface ActiveBookingsSectionProps {
  bookings: BookingWithRelations[]
  barbershop?: {
    id: string
    name: string
    address: string
    imageUrl: string
    phones: string[]
  }
}

const ActiveBookingsSection = ({
  bookings,
  barbershop,
}: ActiveBookingsSectionProps) => {
  const [expanded, setExpanded] = useState(false)

  if (!bookings.length) return null

  const primary = bookings[0]
  const others = bookings.slice(1)
  const visibleOthers = expanded ? others : []

  const toggleText = expanded
    ? "Mostrar menos"
    : `Ver mais ${others.length} agendamento${others.length > 1 ? "s" : ""}`

  return (
    <div className="space-y-4">
      <div>
        <ActiveBookingCard
          booking={primary}
          barbershop={barbershop}
        />
      </div>

      {visibleOthers.map((booking) => (
        <ActiveBookingCard
          key={booking.id}
          booking={booking}
          barbershop={barbershop}
        />
      ))}

      {others.length > 0 && (
        <Button
          variant="ghost"
          className="w-full text-sm font-semibold text-[#EE8530]"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {toggleText}
        </Button>
      )}
    </div>
  )
}

export default ActiveBookingsSection

