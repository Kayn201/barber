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
  professionalSchedule?: any[] // Horários do profissional passados como prop
  businessHours?: any[] // Horários da empresa passados como prop
}

export const useDailyAvailability = ({
  date,
  professionalId,
  serviceDuration,
  professionalIds,
  excludeBookingId,
  currentProfessionalId,
  professionalSchedule: propProfessionalSchedule,
  businessHours: propBusinessHours,
}: UseDailyAvailabilityParams) => {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [professionalSchedule, setProfessionalSchedule] = useState<any[]>(propProfessionalSchedule || [])
  const [businessHours, setBusinessHours] = useState<any[]>(propBusinessHours || [])

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

  // Se os dados foram passados como props, usar diretamente. Caso contrário, buscar via API (fallback)
  useEffect(() => {
    // Se já temos os dados via props, não fazer fetch
    if (propProfessionalSchedule && propProfessionalSchedule.length > 0) {
      setProfessionalSchedule(propProfessionalSchedule)
    }
    if (propBusinessHours && propBusinessHours.length > 0) {
      setBusinessHours(propBusinessHours)
    }
    
    // Só fazer fetch se não temos os dados via props
    if (propProfessionalSchedule && propProfessionalSchedule.length > 0 && 
        propBusinessHours && propBusinessHours.length > 0) {
      return // Já temos tudo, não precisa fazer fetch
    }

    // Cache simples para evitar múltiplas requisições (apenas se não temos props)
    const cacheKey = `schedules_${professionalId}_${professionalIds?.join(",")}_${currentProfessionalId}`
    
    // Verificar cache primeiro
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (!propProfessionalSchedule || propProfessionalSchedule.length === 0) {
          setProfessionalSchedule(parsed.professionalSchedule || [])
        }
        if (!propBusinessHours || propBusinessHours.length === 0) {
          setBusinessHours(parsed.businessHours || [])
        }
        return
      } catch (e) {
        // Cache inválido, continuar com fetch
      }
    }

    const fetchSchedules = async () => {
      const idsToFetch = currentProfessionalId 
        ? [currentProfessionalId]
        : (professionalIds && professionalIds.length > 0 ? professionalIds : [professionalId])
      
      if (idsToFetch.length > 0) {
        try {
          let fetchedSchedule: any[] = []
          let fetchedBusinessHours: any[] = []
          
          // Só buscar professionalSchedule se não foi passado via props
          if (!propProfessionalSchedule || propProfessionalSchedule.length === 0) {
            const schedulesResponse = await fetch(
              `/api/professionals/schedules?ids=${idsToFetch.join(",")}`
            )
            if (schedulesResponse.ok) {
              const schedulesData = await schedulesResponse.json()
              fetchedSchedule = schedulesData[0]?.weeklySchedule || []
              setProfessionalSchedule(fetchedSchedule)
            }
          } else {
            fetchedSchedule = propProfessionalSchedule
          }
          
          // Só buscar businessHours se não foi passado via props
          if (!propBusinessHours || propBusinessHours.length === 0) {
            const businessResponse = await fetch(`/api/business-hours`)
            if (businessResponse.ok) {
              fetchedBusinessHours = await businessResponse.json()
              setBusinessHours(fetchedBusinessHours)
            }
          } else {
            fetchedBusinessHours = propBusinessHours
          }
          
          // Salvar no cache
          sessionStorage.setItem(cacheKey, JSON.stringify({
            professionalSchedule: fetchedSchedule,
            businessHours: fetchedBusinessHours,
            timestamp: Date.now(),
          }))
        } catch (error) {
          console.error("Erro ao buscar horários:", error)
        }
      }
    }

    fetchSchedules()
  }, [professionalId, professionalIds, currentProfessionalId, propProfessionalSchedule, propBusinessHours])

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
      professionalSchedule: professionalSchedule,
      businessHours: businessHours,
    })
  }, [
    bookings,
    date,
    serviceDuration,
    professionalId,
    professionalIds,
    excludeBookingId,
    currentProfessionalId,
    professionalSchedule,
    businessHours,
  ])

  return {
    availableTimes,
    bookings,
    loading,
  }
}

