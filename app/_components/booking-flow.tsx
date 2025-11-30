"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Calendar } from "./ui/calendar"
import { ptBR } from "date-fns/locale"
import { format, isPast, isSameDay, set, addMinutes, startOfDay, endOfDay } from "date-fns"
import Image from "next/image"
import { StarIcon, X } from "lucide-react"
import { Professional, BarbershopService, WeeklySchedule, BlockedDate } from "@prisma/client"
import { TIME_LIST } from "../_lib/get-available-times"
import BookingReviewCard from "./booking-review-card"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet"
import { useDailyAvailability } from "@/app/_hooks/use-daily-availability"

interface BookingFlowProps {
  professional: Professional & {
    services: {
      service: BarbershopService
    }[]
    weeklySchedule: WeeklySchedule[]
    blockedDates: BlockedDate[]
    ratings: { score: number }[]
  }
  averageRating: number
}

type BookingStep = "service" | "date" | "time" | "review"

const BookingFlow = ({ professional, averageRating }: BookingFlowProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<BookingStep>("service")
  const [selectedService, setSelectedService] = useState<BarbershopService | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined)
  const [availableDates, setAvailableDates] = useState<Date[]>([])

  // Verificar se há erro nos searchParams
  useEffect(() => {
    const error = searchParams.get("error")
    if (error === "checkout_failed") {
      toast.error("Erro ao criar sessão de checkout. Tente novamente.")
      // Remover o parâmetro de erro da URL
      router.replace(`/book?professional=${professional.id}`)
    } else if (error === "auth_required") {
      toast.error("É necessário fazer login para assinaturas.")
      // Remover o parâmetro de erro da URL
      router.replace(`/book?professional=${professional.id}`)
    }
  }, [searchParams, router, professional.id])

  // Gerar lista de datas disponíveis baseado na agenda semanal e bloqueios
  useEffect(() => {
    const generateAvailableDates = () => {
      const dates: Date[] = []
      const today = new Date()
      const maxDate = new Date()
      maxDate.setDate(today.getDate() + 60) // 60 dias à frente

      for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay()
        const schedule = professional.weeklySchedule.find(
          (s) => s.dayOfWeek === dayOfWeek && s.isAvailable
        )

        if (!schedule) continue

        // Verificar se a data está bloqueada
        const isBlocked = professional.blockedDates.some(
          (blocked) =>
            format(blocked.date, "yyyy-MM-dd") === format(d, "yyyy-MM-dd")
        )

        if (!isBlocked && !isPast(d)) {
          dates.push(new Date(d))
        }
      }

      setAvailableDates(dates)
    }

    generateAvailableDates()
  }, [professional])

  const calendarSelectedDate = selectedDate

  const { availableTimes, loading: isTimesLoading } = useDailyAvailability({
    date: calendarSelectedDate,
    professionalId: professional.id,
    serviceDuration: selectedService?.duration || 0,
    professionalIds: [professional.id],
  })

  const availableTimeSet = useMemo(() => new Set(availableTimes), [availableTimes])

  const timeSlots = useMemo(() => {
    if (!calendarSelectedDate) return []

    return TIME_LIST.map((time) => ({
      time,
      available: availableTimeSet.has(time),
    }))
  }, [availableTimeSet, calendarSelectedDate])

  const handleServiceSelect = (service: BarbershopService) => {
    setSelectedService(service)
    setStep("time")
    setSelectedTime(undefined)
    // Não pré-selecionar nenhuma data - deixar o usuário escolher
    setSelectedDate(undefined)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
    setSelectedTime(undefined)
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
  }

  const handleProceedToPayment = () => {
    if (!selectedService || !selectedDate || !selectedTime) return

    const bookingDateTime = set(selectedDate, {
      hours: Number(selectedTime.split(":")[0]),
      minutes: Number(selectedTime.split(":")[1]),
    })

    // Redirecionar para página de checkout do Stripe
    router.push(
      `/checkout?professional=${professional.id}&service=${selectedService.id}&date=${bookingDateTime.toISOString()}`
    )
  }

  const selectedDateTime = useMemo(() => {
    if (!calendarSelectedDate || !selectedTime) return null

    return set(calendarSelectedDate, {
      hours: Number(selectedTime.split(":")[0]),
      minutes: Number(selectedTime.split(":")[1]),
    })
  }, [calendarSelectedDate, selectedTime])

  return (
    <div className="space-y-6">
      {/* HEADER DO PROFISSIONAL - Só mostra nos passos de seleção de serviço e data */}
      {step !== "time" && (
        <Card className="bg-[#1A1B1F]">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="relative h-20 w-20 flex-shrink-0">
              <Image
                src={professional.imageUrl}
                alt={professional.name}
                fill
                className="rounded-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{professional.name}</h1>
              <p className="text-sm text-gray-400">{professional.profession}</p>
              {averageRating > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <StarIcon size={14} className="fill-[#EE8530] text-[#EE8530]" />
                  <span className="text-sm font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 1: SELEÇÃO DE SERVIÇO */}
      {step === "service" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Selecione o serviço</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
            >
              Voltar
            </Button>
          </div>
          <div className="space-y-3">
            {professional.services.map(({ service }) => (
              <Card
                key={service.id}
                className="cursor-pointer transition-colors hover:bg-[#1A1B1F]"
                onClick={() => handleServiceSelect(service)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {service.imageUrl?.trim() && (
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <Image
                        src={service.imageUrl}
                        alt={service.name}
                        fill
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-sm text-gray-400">
                      {service.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#EE8530]">
                      {Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(service.price))}
                    </p>
                    <p className="text-xs text-gray-400">
                      {service.duration} min
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PASSO 2: FAZER RESERVA - Layout como na imagem */}
          {step === "time" && selectedService && (
        <div className="space-y-6">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-solid pb-6">
            <h2 className="text-lg font-bold">Fazer Reserva</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStep("service")
                setSelectedService(null)
                setSelectedDate(undefined)
                setSelectedTime(undefined)
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* CALENDÁRIO */}
          <div className="w-full border-b border-solid pb-6">
            <div className="w-full">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={calendarSelectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const isSelected = selectedDate && isSameDay(date, selectedDate)
                  const isSelectable = availableDates.some((d) =>
                    isSameDay(d, date)
                  )
                  const isToday = isSameDay(date, new Date())
                  const isPastDate = !isToday && isPast(date)
                  return (
                    isPastDate ||
                    (!isSelected && !isSelectable && !isToday)
                  )
                }}
                className="w-full"
              />
            </div>
          </div>

          {/* HORÁRIOS - Scroll horizontal - Só mostra se uma data foi selecionada */}
          {calendarSelectedDate && (
            <div className="flex gap-2 overflow-x-auto border-b border-solid pb-6 [&::-webkit-scrollbar]:hidden whitespace-nowrap">
              {isTimesLoading ? (
                <p className="text-sm text-gray-400">Verificando horários...</p>
              ) : (
                <>
                  {timeSlots.map(({ time, available }) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      disabled={!available}
                      className={
                        selectedTime === time
                          ? "min-w-[80px] rounded-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
                          : !available
                          ? "min-w-[80px] rounded-full bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
                          : "min-w-[80px] rounded-full hover:bg-[#EE8530]/10"
                      }
                      onClick={() => available && handleTimeSelect(time)}
                    >
                      {time}
                    </Button>
                  ))}
                  {timeSlots.every((slot) => !slot.available) && (
                    <p className="text-sm text-gray-400">
                      Não há horários disponíveis para este dia.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* CARD DE REVISÃO - Só aparece quando horário for selecionado */}
          {selectedTime && selectedDateTime && selectedService && (
            <BookingReviewCard
              service={selectedService}
              professional={professional}
              selectedDate={selectedDateTime}
              onProceedToPayment={handleProceedToPayment}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default BookingFlow

