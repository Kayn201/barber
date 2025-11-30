"use client"

import { useEffect, useState } from "react"
import RatingDialog from "./rating-dialog"

const RatingCheck = () => {
  const [bookingToRate, setBookingToRate] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const checkForRating = async () => {
      try {
        const response = await fetch(`/api/bookings/completed-without-rating`)
        if (response.ok) {
          const booking = await response.json()
          if (booking) {
            setBookingToRate(booking)
            setIsOpen(true)
          }
        }
      } catch (error) {
        console.error("Erro ao verificar avaliações pendentes:", error)
      }
    }

    // Verificar após um pequeno delay para garantir que a página carregou
    const timer = setTimeout(checkForRating, 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!bookingToRate) return null

  return (
    <RatingDialog
      booking={bookingToRate}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) {
          // Quando fechar, limpar o booking para não mostrar novamente
          setBookingToRate(null)
        }
      }}
    />
  )
}

export default RatingCheck

