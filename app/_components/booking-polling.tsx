"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface BookingPollingProps {
  hasEmail: boolean
  hasBookings: boolean
}

export default function BookingPolling({ hasEmail, hasBookings }: BookingPollingProps) {
  const router = useRouter()

  useEffect(() => {
    // Só fazer polling se tem email mas não tem bookings ainda
    // Isso significa que o webhook pode estar processando
    if (!hasEmail || hasBookings) {
      return
    }

    // Fazer polling a cada 2 segundos por até 30 segundos (15 tentativas)
    let attempts = 0
    const maxAttempts = 15

    const interval = setInterval(() => {
      attempts++
      
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        return
      }

      // Recarregar a página para verificar novos bookings
      router.refresh()
    }, 2000)

    return () => clearInterval(interval)
  }, [hasEmail, hasBookings, router])

  return null
}

