"use client"

import { useState, useEffect, useMemo } from "react"
import { Booking } from "@prisma/client"
import { getBookings } from "../_actions/get-bookings"
import { getAvailableTimes } from "../_lib/get-available-times"

interface UseDailyAvailabilityParams {
  date?: Date
  professionalId: string
  serviceDuration: number
  professionalIds?: string[]
  excludeBookingId?: string
  currentProfessionalId?: string
}

export const useDailyAvailability = ({
  date,
  professionalId,
  serviceDuration,
  professionalIds,
  excludeBookingId,
  currentProfessionalId,
}: UseDailyAvailabilityParams) => {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchBookings = async () => {
      if (!date) {
        setBookings([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await getBookings({
          date,
          professionalId,
        })
        setBookings(data)
      } catch (error) {
        console.error("Erro ao buscar bookings:", error)
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [date, professionalId])

  const availableTimes = useMemo(() => {
    if (!date || !serviceDuration) return []

    return getAvailableTimes({
      bookings: bookings.map((b: any) => ({
        ...b,
        service: b.service ? { duration: b.service.duration } : { duration: serviceDuration },
      })),
      selectedDay: date,
      serviceDuration,
      professionalIds: professionalIds ?? [professionalId],
      excludeBookingId,
      currentProfessionalId,
    })
  }, [
    bookings,
    date,
    serviceDuration,
    professionalId,
    professionalIds,
    excludeBookingId,
    currentProfessionalId,
  ])

  return {
    availableTimes,
    bookings,
    loading,
  }
}

