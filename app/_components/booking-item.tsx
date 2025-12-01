"use client"

import { Prisma } from "@prisma/client"
import { Avatar, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Card, CardContent } from "./ui/card"
import { format, isFuture, addMinutes, set, isPast, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import Image from "next/image"
import PhoneItem from "./phone-item"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { DialogClose } from "@radix-ui/react-dialog"
import { deleteBooking } from "../_actions/delete-booking"
import { refundBooking } from "../_actions/refund-booking"
import { rescheduleBooking } from "../_actions/reschedule-booking"
import { toast } from "sonner"
import { useState, useMemo, useEffect } from "react"
import BookingSummary from "./booking-summary"
import { Calendar } from "./ui/calendar"
import { Label } from "./ui/label"
import { TIME_LIST } from "../_lib/get-available-times"
import { useDailyAvailability } from "@/app/_hooks/use-daily-availability"
import { getProfessionalSchedule } from "../_actions/get-professional-schedule"

interface BookingItemProps {
  booking: any // Usando any temporariamente até o Prisma Client ser atualizado
  barbershop?: {
    id: string
    name: string
    address: string
    imageUrl: string
    phones: string[]
  }
  isRescheduled?: boolean
}

const BookingItem = ({ booking, barbershop, isRescheduled = false }: BookingItemProps) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [selectedRescheduleDay, setSelectedRescheduleDay] = useState<Date | undefined>(undefined)
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<string | undefined>(undefined)
  const [availableRescheduleDates, setAvailableRescheduleDates] = useState<Date[]>([])
  const [professionalSchedule, setProfessionalSchedule] = useState<{
    weeklySchedule: any[]
    blockedDates: any[]
  } | null>(null)
  const isConfirmed = isFuture(booking.date)

  // Buscar dados do profissional quando o dialog abrir
  useEffect(() => {
    if (rescheduleDialogOpen && !professionalSchedule) {
      getProfessionalSchedule(booking.professionalId)
        .then((data) => {
          if (data) {
            setProfessionalSchedule({
              weeklySchedule: data.weeklySchedule || [],
              blockedDates: data.blockedDates || [],
            })
          }
        })
        .catch(console.error)
    }
  }, [rescheduleDialogOpen, booking.professionalId, professionalSchedule])

  // Gerar lista de datas disponíveis (igual ao booking-flow)
  useEffect(() => {
    if (!professionalSchedule) {
      setAvailableRescheduleDates([])
      return
    }

    const generateAvailableDates = () => {
      const dates: Date[] = []
      const today = new Date()
      const maxDate = new Date()
      maxDate.setDate(today.getDate() + 60) // 60 dias à frente

      for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay()
        const schedule = professionalSchedule.weeklySchedule.find(
          (s) => s.dayOfWeek === dayOfWeek && s.isAvailable
        )

        if (!schedule) continue

        // Verificar se a data está bloqueada
        const isBlocked = professionalSchedule.blockedDates.some(
          (blocked) =>
            format(blocked.date, "yyyy-MM-dd") === format(d, "yyyy-MM-dd")
        )

        if (!isBlocked && !isPast(d)) {
          dates.push(new Date(d))
        }
      }

      setAvailableRescheduleDates(dates)
    }

    generateAvailableDates()
  }, [professionalSchedule])

  const { availableTimes, loading: isTimesLoading } = useDailyAvailability({
    date: selectedRescheduleDay,
    professionalId: booking.professionalId,
    serviceDuration: booking.service.duration,
    excludeBookingId: booking.id,
    currentProfessionalId: booking.professionalId,
  })

  const timeSlots = useMemo(() => {
    if (!selectedRescheduleDay) return []

    const timesSet = new Set(availableTimes)
    return TIME_LIST.map((time) => ({
      time,
      available: timesSet.has(time),
    }))
  }, [availableTimes, selectedRescheduleDay])

  // Verificar se pode reembolsar
  // Regras para cliente:
  // 1. Não pode reembolsar se o booking foi reagendado (tem originalBookingId OU é um booking original que foi reagendado)
  // 2. Não pode reembolsar se o status é "cancelled" (booking original que foi reagendado)
  // 3. Deve estar dentro do tempo de cancelamento configurado pelo ADM (se configurado)
  const canRefund = useMemo(() => {
    if (!isConfirmed || booking.isRefunded) return false
    
    // Se o booking foi reagendado (tem originalBookingId), não permitir reembolso pelo cliente
    // Isso identifica o booking novo (reagendado)
    if ((booking as any).originalBookingId) return false
    
    // Verificar se tem payment - se não tem, não pode reembolsar (pode ser booking de assinatura)
    if (!booking.payment?.stripeId) return false
    
    // Verificar tempo limite de cancelamento configurado pelo ADM
    const now = new Date()
    const bookingDate = new Date(booking.date)
    const timeDifference = bookingDate.getTime() - now.getTime()
    const minutesUntilBooking = timeDifference / (1000 * 60)
    const cancellationTimeMinutes = booking.service.cancellationTimeMinutes || 0
    
    // Se cancellationTimeMinutes for 0 ou não configurado, permitir reembolso
    if (cancellationTimeMinutes === 0) return true
    
    // Se estiver configurado, verificar se está dentro do tempo
    return minutesUntilBooking >= cancellationTimeMinutes
  }, [booking, isConfirmed])

  // Verificar se o tempo expirou (para mostrar mensagem específica)
  const isTimeExpired = useMemo(() => {
    if (!isConfirmed || booking.isRefunded) return false
    if ((booking as any).originalBookingId) return false
    if (!booking.payment?.stripeId) return false
    
    const now = new Date()
    const bookingDate = new Date(booking.date)
    const timeDifference = bookingDate.getTime() - now.getTime()
    const minutesUntilBooking = timeDifference / (1000 * 60)
    const cancellationTimeMinutes = booking.service.cancellationTimeMinutes || 0
    
    // Só considerar tempo expirado se cancellationTimeMinutes estiver configurado e o tempo passou
    if (cancellationTimeMinutes === 0) return false
    return minutesUntilBooking < cancellationTimeMinutes
  }, [booking, isConfirmed])

  // Verificar se pode reagendar (limite de reagendamentos)
  const canReschedule = useMemo(() => {
    if (!isConfirmed || booking.isRefunded) return false
    const maxReschedules = booking.service.maxReschedules ?? 1
    const currentRescheduleCount = booking.rescheduleCount ?? 0
    return currentRescheduleCount < maxReschedules
  }, [booking, isConfirmed])

  const handleRefund = async () => {
    setIsRefunding(true)
    try {
      const result = await refundBooking({
        bookingId: booking.id,
        isAdmin: false,
      })
      if (result.success) {
        toast.success("Reembolso solicitado com sucesso!")
        // Disparar evento para atualizar stats na aba "Visão geral"
        window.dispatchEvent(new CustomEvent("booking-updated", { detail: { type: "refunded" } }))
        setIsSheetOpen(false)
        window.location.reload()
      } else {
        toast.error(result.error || "Erro ao processar reembolso")
      }
    } catch (error) {
      console.error(error)
      toast.error("Erro ao processar reembolso. Tente novamente.")
    } finally {
      setIsRefunding(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedRescheduleDay || !selectedRescheduleTime) {
      toast.error("Por favor, selecione uma data e horário")
      return
    }

    const newDate = set(selectedRescheduleDay, {
      hours: Number(selectedRescheduleTime.split(":")[0]),
      minutes: Number(selectedRescheduleTime.split(":")[1]),
    })

    setIsRescheduling(true)
    try {
      const result = await rescheduleBooking({
        bookingId: booking.id,
        newDate,
        isAdmin: false,
      })
      if (result.success) {
        toast.success("Agendamento reagendado com sucesso!")
        // Disparar evento para atualizar stats na aba "Visão geral"
        window.dispatchEvent(new CustomEvent("booking-updated", { detail: { type: "rescheduled" } }))
        setRescheduleDialogOpen(false)
        setIsSheetOpen(false)
        window.location.reload()
      } else {
        toast.error(result.error || "Erro ao reagendar")
      }
    } catch (error) {
      console.error(error)
      toast.error("Erro ao reagendar. Tente novamente.")
    } finally {
      setIsRescheduling(false)
    }
  }

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen)
  }
  
  // Calcular horário de término baseado na duração do serviço
  const startTime = booking.date
  const endTime = addMinutes(startTime, booking.service.duration)

  return (
    <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
      <SheetTrigger className="block w-full text-left">
        <Card
          className={`w-full rounded-[22px] border relative overflow-hidden ${
            isRescheduled
              ? "bg-gray-800/50 border-gray-700"
              : isConfirmed
              ? "bg-[#1A1B1F] border-gray-800"
              : "bg-[#1A1B1F] border-gray-800"
          }`}
        >
          {isRescheduled && (
            <div className="absolute inset-0 bg-gray-900/60 z-10 pointer-events-none" />
          )}
          {!isConfirmed && !isRescheduled && (
            <div className="absolute inset-0 bg-gray-900/70 z-10 pointer-events-none" />
          )}
          <CardContent className="px-6 py-5 relative z-20">
            <div className="flex items-stretch gap-6">
              {/* Lado esquerdo */}
              <div className="flex-1 space-y-3">
                {/* Badge Confirmado/Finalizado/Reagendado - não é botão, apenas span */}
                <div>
                  <span
                    className={`inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-white ${
                      isRescheduled ? 'bg-gray-600' : isConfirmed ? 'bg-[#EE8530]' : 'bg-gray-600'
                    }`}
                  >
                    {isRescheduled ? "Reagendado" : isConfirmed ? "Confirmado" : "Finalizado"}
                  </span>
                </div>

                {/* Nome do serviço em bold */}
                <h3 className={`text-lg font-bold leading-tight ${isRescheduled ? 'text-gray-400' : isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                  {booking.service.name}
                </h3>

                {/* Avatar e nome do profissional */}
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6 overflow-hidden rounded-full">
                    <Image
                      src={booking.professional.imageUrl}
                      alt={booking.professional.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className={`text-sm ${isRescheduled ? 'text-gray-400' : isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                    {booking.professional.name}
                  </p>
                </div>
              </div>

              {/* Linha vertical separadora - quase no final */}
              <div className={`self-stretch w-px rounded ${isConfirmed ? 'bg-[#2F2F36]' : 'bg-[#2F2F36]'}`} />

              {/* Lado direito: Data e Hora centralizados verticalmente */}
              <div className="w-[150px] flex flex-col items-center text-center gap-1">
                <div className="h-full flex flex-col justify-center gap-1">
                  <p className={`text-sm font-semibold capitalize ${isRescheduled ? 'text-gray-400' : isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                    {format(booking.date, "MMMM", { locale: ptBR })}
                  </p>
                  <p className={`text-4xl font-bold leading-none ${isRescheduled ? 'text-gray-400' : isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                    {format(booking.date, "dd", { locale: ptBR })}
                  </p>
                  <p className={`text-xs tracking-wide ${isRescheduled ? 'text-gray-400' : isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                    {format(startTime, "HH:mm", { locale: ptBR })} - {format(endTime, "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </SheetTrigger>
      <SheetContent className="w-[85%]">
        <SheetHeader>
          <SheetTitle className="text-left text-base md:text-lg">Informações da Reserva</SheetTitle>
        </SheetHeader>

        {barbershop && (
          <div
            onClick={() => {
              const address = barbershop.address
              if (!address) return

              // Tentar abrir Waze primeiro (deep link)
              const wazeUrl = `waze://?q=${encodeURIComponent(address)}`
              const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`
              
              // Detectar se o Waze foi aberto (a página perde o foco)
              let wazeOpened = false
              const handleBlur = () => {
                wazeOpened = true
                window.removeEventListener('blur', handleBlur)
              }
              window.addEventListener('blur', handleBlur)
              
              // Tentar abrir Waze via iframe (mais confiável em mobile)
              const iframe = document.createElement('iframe')
              iframe.style.display = 'none'
              iframe.src = wazeUrl
              document.body.appendChild(iframe)
              
              // Se Waze não abrir em 1 segundo, abrir Google Maps
              setTimeout(() => {
                if (!wazeOpened) {
                  window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')
                }
                document.body.removeChild(iframe)
                window.removeEventListener('blur', handleBlur)
              }, 1000)
            }}
            className="relative mt-4 md:mt-6 flex h-[120px] md:h-[180px] w-full items-end cursor-pointer group"
          >
            <Image
              alt={`Mapa do estabelecimento ${barbershop.name}`}
              src="/map.png"
              fill
              className="rounded-xl object-cover transition-opacity group-hover:opacity-90"
            />

            <Card className="z-50 mx-3 md:mx-5 mb-2 md:mb-3 w-full rounded-xl pointer-events-none">
              <CardContent className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3">
                <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                  <AvatarImage src={barbershop.imageUrl} />
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm md:text-base truncate">{barbershop.name}</h3>
                  <p className="text-[10px] md:text-xs text-gray-400 line-clamp-2 break-words">{barbershop.address}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-4 md:mt-6">
          <Badge
            className="w-fit text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1"
            variant={isConfirmed ? "default" : "secondary"}
          >
            {isConfirmed ? "Confirmado" : "Finalizado"}
          </Badge>

          {barbershop && (
            <>
              <div className="mb-3 mt-4 md:mt-6">
                <BookingSummary
                  barbershop={barbershop}
                  service={booking.service}
                  selectedDate={booking.date}
                />
              </div>

              <div className="space-y-2 md:space-y-3">
                {barbershop.phones.map((phone, index) => (
                  <PhoneItem key={index} phone={phone} />
                ))}
              </div>
            </>
          )}
        </div>
        <SheetFooter className="mt-6">
          <div className="flex flex-col gap-3 w-full">
            {isConfirmed && (
              <>
                {canReschedule ? (
                  <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => {
                    setRescheduleDialogOpen(open)
                    if (open) {
                      // Não pré-selecionar nenhuma data - deixar o usuário escolher
                      setSelectedRescheduleDay(undefined)
                      setSelectedRescheduleTime(undefined)
                    } else {
                      setSelectedRescheduleDay(undefined)
                      setSelectedRescheduleTime(undefined)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
                        disabled={isRescheduling}
                      >
                        {isRescheduling ? "Reagendando..." : "Reagendar"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[90%] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
                      <DialogHeader>
                        <DialogTitle>Reagendar Agendamento</DialogTitle>
                        <DialogDescription>
                          Selecione uma nova data e horário para seu agendamento.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 py-4 overflow-x-hidden">
                        {/* CALENDÁRIO */}
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <div className="w-full">
                            <Calendar
                              mode="single"
                              locale={ptBR}
                              selected={selectedRescheduleDay}
                              onSelect={setSelectedRescheduleDay}
                              disabled={(date) => {
                                const isSelected = selectedRescheduleDay && isSameDay(date, selectedRescheduleDay)
                                const isSelectable = availableRescheduleDates.some((d) =>
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

                        {/* HORÁRIOS - Scroll horizontal invisível - Só mostra se uma data foi selecionada */}
                        {selectedRescheduleDay && (
                          <div className="space-y-2">
                            <Label>Horário</Label>
                            <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden">
                              {isTimesLoading ? (
                                <p className="text-sm text-gray-400">Verificando horários...</p>
                              ) : (
                                <div className="flex gap-2 pb-1">
                                  {timeSlots.map(({ time, available }) => (
                                    <Button
                                      key={time}
                                      type="button"
                                      variant={selectedRescheduleTime === time ? "default" : "outline"}
                                      disabled={!available}
                                      className={
                                        selectedRescheduleTime === time
                                          ? "min-w-[80px] rounded-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90 flex-shrink-0"
                                          : !available
                                          ? "min-w-[80px] rounded-full bg-gray-600 text-gray-400 cursor-not-allowed opacity-50 flex-shrink-0"
                                          : "min-w-[80px] rounded-full hover:bg-[#EE8530]/10 flex-shrink-0"
                                      }
                                      onClick={() => available && setSelectedRescheduleTime(time)}
                                    >
                                      {time}
                                    </Button>
                                  ))}
                                  {timeSlots.every((slot) => !slot.available) && (
                                    <p className="text-sm text-gray-400 whitespace-nowrap">
                                      Não há horários disponíveis para este dia.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                        <DialogClose asChild>
                          <Button variant="outline" className="w-full sm:w-auto">Cancelar</Button>
                        </DialogClose>
                        <Button
                          onClick={handleReschedule}
                          disabled={!selectedRescheduleDay || !selectedRescheduleTime || isRescheduling}
                          className="w-full sm:w-auto bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
                        >
                          {isRescheduling ? "Reagendando..." : "Confirmar Reagendamento"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Limite de Reagendamentos Atingido
                  </Button>
                )}

                {!isRescheduled && (
                  canRefund ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          disabled={isRefunding}
                        >
                          {isRefunding ? "Processando..." : "Pedir Reembolso"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[90%] max-w-md">
                        <DialogHeader className="space-y-2 md:space-y-3">
                          <DialogTitle className="text-base md:text-lg">Você deseja solicitar reembolso?</DialogTitle>
                          <DialogDescription className="text-xs md:text-sm">
                            Ao solicitar reembolso, você receberá o valor pago de volta e o agendamento será cancelado. Esta ação é irreversível.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
                          <DialogClose asChild>
                            <Button variant="secondary" className="w-full text-xs md:text-sm h-9 md:h-10">
                              Cancelar
                            </Button>
                          </DialogClose>
                          <DialogClose className="w-full">
                            <Button
                              variant="destructive"
                              onClick={handleRefund}
                              disabled={isRefunding}
                              className="w-full text-xs md:text-sm h-9 md:h-10"
                            >
                              {isRefunding ? "Processando..." : "Confirmar Reembolso"}
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled
                    >
                      {isTimeExpired ? "Tempo Limite para Reembolso Expirado" : "Pedir Reembolso"}
                    </Button>
                  )
                )}
              </>
            )}
            {!isConfirmed && (
              <SheetClose asChild>
                <Button variant="outline" className="w-full">
                  Voltar
                </Button>
              </SheetClose>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default BookingItem
