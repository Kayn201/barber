import { isPast, isToday, set, addMinutes, getDay, parse, isBefore, isAfter } from "date-fns"
import { Booking } from "@prisma/client"

export const TIME_LIST = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
]

interface WeeklySchedule {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface GetAvailableTimesProps {
  bookings: (Booking & { service: { duration: number }; professional?: { id: string } })[]
  selectedDay: Date
  serviceDuration: number // duração do serviço em minutos
  excludeBookingId?: string // ID do booking que está sendo reagendado (para excluir do conflito)
  professionalIds?: string[] // IDs dos profissionais que fazem este serviço (para verificar disponibilidade)
  currentProfessionalId?: string // ID do profissional atual (para reagendamentos - verificar apenas este profissional)
  professionalSchedule?: WeeklySchedule[] // Horários semanais do profissional
  businessHours?: WeeklySchedule[] // Horários da empresa (fallback)
}

// Gerar lista de horários baseado em startTime e endTime
function generateTimeList(startTime: string, endTime: string, intervalMinutes: number = 30): string[] {
  const times: string[] = []
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)
  
  const start = new Date()
  start.setHours(startHour, startMin, 0, 0)
  
  const end = new Date()
  end.setHours(endHour, endMin, 0, 0)
  
  const current = new Date(start)
  while (current < end) {
    const hours = String(current.getHours()).padStart(2, "0")
    const minutes = String(current.getMinutes()).padStart(2, "0")
    times.push(`${hours}:${minutes}`)
    current.setMinutes(current.getMinutes() + intervalMinutes)
  }
  
  return times
}

export const getAvailableTimes = ({
  bookings,
  selectedDay,
  serviceDuration,
  excludeBookingId,
  professionalIds,
  currentProfessionalId,
  professionalSchedule,
  businessHours,
}: GetAvailableTimesProps) => {
  // Obter dia da semana (getDay retorna 0-6 onde 0 = domingo)
  // No schema do Prisma, dayOfWeek também usa 0 = domingo, 1 = segunda, etc.
  const dayOfWeek = getDay(selectedDay)
  
  // Determinar horários disponíveis baseado no profissional ou empresa
  let availableTimeSlots: string[] = TIME_LIST
  let isDayAvailable = true
  
  // Prioridade: horário do profissional > horário da empresa > padrão
  if (professionalSchedule && professionalSchedule.length > 0) {
    const daySchedule = professionalSchedule.find(s => s.dayOfWeek === dayOfWeek)
    if (daySchedule) {
      isDayAvailable = daySchedule.isAvailable
      if (isDayAvailable) {
        availableTimeSlots = generateTimeList(daySchedule.startTime, daySchedule.endTime)
      }
    }
  } else if (businessHours && businessHours.length > 0) {
    const daySchedule = businessHours.find(s => s.dayOfWeek === dayOfWeek)
    if (daySchedule) {
      isDayAvailable = daySchedule.isAvailable
      if (isDayAvailable) {
        availableTimeSlots = generateTimeList(daySchedule.startTime, daySchedule.endTime)
      }
    }
  }
  
  // Se o dia não está disponível, retornar array vazio
  if (!isDayAvailable) {
    return []
  }
  
  return availableTimeSlots.filter((time) => {
    const hour = Number(time.split(":")[0])
    const minutes = Number(time.split(":")[1])

    // Verificar se o horário está no passado (apenas para hoje)
    const timeIsOnThePast = isPast(set(new Date(), { hours: hour, minutes }))
    if (timeIsOnThePast && isToday(selectedDay)) {
      return false
    }

    // Calcular início e fim do novo agendamento
    const newBookingStart = set(selectedDay, { hours: hour, minutes })
    const newBookingEnd = addMinutes(newBookingStart, serviceDuration)

    // Se há professionalIds, verificar se pelo menos um está disponível (para novos agendamentos)
    if (professionalIds && professionalIds.length > 0) {
      // Para cada profissional, verificar se está ocupado neste horário
      const availableProfessionals = professionalIds.filter((profId) => {
        // Verificar se este profissional tem conflito
        const hasConflict = bookings.some((booking) => {
          // Excluir o booking que está sendo reagendado
          if (excludeBookingId && booking.id === excludeBookingId) {
            return false
          }

          // Verificar se é do mesmo profissional
          const bookingProfId = booking.professionalId || booking.professional?.id
          if (bookingProfId !== profId) {
            return false
          }

          const bookingStart = new Date(booking.date)
          const bookingEnd = addMinutes(bookingStart, booking.service.duration)

          // Verificar se há sobreposição de horários
          return newBookingStart < bookingEnd && newBookingEnd > bookingStart
        })

        return !hasConflict
      })

      // Se não há nenhum profissional disponível, este horário não está disponível
      return availableProfessionals.length > 0
    }

    // Para reagendamentos: verificar conflitos apenas com o profissional atual
    if (currentProfessionalId) {
      const hasConflict = bookings.some((booking) => {
        // Excluir o booking que está sendo reagendado
        if (excludeBookingId && booking.id === excludeBookingId) {
          return false
        }

        // Verificar se é do mesmo profissional
        const bookingProfId = booking.professionalId || booking.professional?.id
        if (bookingProfId !== currentProfessionalId) {
          return false
        }

        const bookingStart = new Date(booking.date)
        const bookingEnd = addMinutes(bookingStart, booking.service.duration)

        // Verificar se há sobreposição de horários
        return (
          (newBookingStart >= bookingStart && newBookingStart < bookingEnd) ||
          (newBookingEnd > bookingStart && newBookingEnd <= bookingEnd) ||
          (newBookingStart <= bookingStart && newBookingEnd >= bookingEnd)
        )
      })

      if (hasConflict) {
        return false
      }

      return true
    }

    // Fallback: verificar conflitos com todos os bookings (não recomendado, mas mantido para compatibilidade)
    const hasConflict = bookings.some((booking) => {
      // Excluir o booking que está sendo reagendado
      if (excludeBookingId && booking.id === excludeBookingId) {
        return false
      }

      const bookingStart = new Date(booking.date)
      const bookingEnd = addMinutes(bookingStart, booking.service.duration)

      // Verificar se há sobreposição de horários
      return (
        (newBookingStart >= bookingStart && newBookingStart < bookingEnd) ||
        (newBookingEnd > bookingStart && newBookingEnd <= bookingEnd) ||
        (newBookingStart <= bookingStart && newBookingEnd >= bookingEnd)
      )
    })

    if (hasConflict) {
      return false
    }

    return true
  })
}

