"use client"

import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { format, isFuture, set, isPast, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { refundBooking } from "../_actions/refund-booking"
import { rescheduleBooking } from "../_actions/reschedule-booking"
import { toast } from "sonner"
import { useState, useEffect, useMemo } from "react"
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
import { Calendar } from "./ui/calendar"
import { Label } from "./ui/label"
import { getBookings } from "../_actions/get-bookings"
import { getProfessionalSchedule } from "../_actions/get-professional-schedule"
import { useDailyAvailability } from "../_hooks/use-daily-availability"
import { TIME_LIST } from "../_lib/get-available-times"
import { getAllBookings } from "../_actions/admin/get-all-bookings"
import { checkNewBookings } from "../_actions/admin/check-new-bookings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { CheckCircle2, XCircle, CalendarCheck, RotateCcw } from "lucide-react"

interface AdminBookingsTabProps {
  bookings: any[]
}

const AdminBookingsTab = ({ bookings: initialBookings }: AdminBookingsTabProps) => {
  const [bookings, setBookings] = useState(initialBookings)
  const [lastBookingId, setLastBookingId] = useState<string | undefined>(
    initialBookings[0]?.id
  )
  const [refundingBookingId, setRefundingBookingId] = useState<string | null>(null)
  const [reschedulingBookingId, setReschedulingBookingId] = useState<string | null>(null)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState<string | null>(null)
  const [selectedRescheduleDay, setSelectedRescheduleDay] = useState<Date | undefined>(undefined)
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<string | undefined>(undefined)
  const [currentRescheduleBooking, setCurrentRescheduleBooking] = useState<any | null>(null)
  const [availableRescheduleDates, setAvailableRescheduleDates] = useState<Date[]>([])
  const [professionalScheduleMap, setProfessionalScheduleMap] = useState<Record<string, {
    weeklySchedule: any[]
    blockedDates: any[]
  }>>({})

  // Buscar dados do profissional quando necessário
  useEffect(() => {
    if (currentRescheduleBooking?.professionalId && !professionalScheduleMap[currentRescheduleBooking.professionalId]) {
      getProfessionalSchedule(currentRescheduleBooking.professionalId)
        .then((data) => {
          if (data) {
            setProfessionalScheduleMap((prev) => ({
              ...prev,
              [currentRescheduleBooking.professionalId]: {
                weeklySchedule: data.weeklySchedule || [],
                blockedDates: data.blockedDates || [],
              },
            }))
          }
        })
        .catch(console.error)
    }
  }, [currentRescheduleBooking?.professionalId, professionalScheduleMap])

  // Gerar lista de datas disponíveis (igual ao booking-flow)
  useEffect(() => {
    if (!currentRescheduleBooking?.professionalId) {
      setAvailableRescheduleDates([])
      return
    }

    const professionalSchedule = professionalScheduleMap[currentRescheduleBooking.professionalId]
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
  }, [currentRescheduleBooking?.professionalId, professionalScheduleMap])

  // Polling inteligente: só busca todos os bookings se detectar novos
  useEffect(() => {
    const checkAndUpdate = async () => {
      // Só verifica se a página estiver visível
      if (document.hidden) return

      try {
        // Verifica se há novos bookings (query leve - só verifica timestamps)
        const checkResult = await checkNewBookings(lastBookingId)
        
        // Se há novos bookings, busca a lista completa
        if (checkResult.hasNew) {
          const updatedBookings = await getAllBookings()
          setBookings(updatedBookings)
          // Atualiza o ID do último booking conhecido
          if (updatedBookings[0]?.id) {
            setLastBookingId(updatedBookings[0].id)
          }
        }
      } catch (error) {
        console.error("Erro ao verificar novos bookings:", error)
      }
    }

    // Verificar quando a página volta a ficar visível
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndUpdate()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Polling a cada 10 segundos - só verifica se há novos (query leve)
    const interval = setInterval(checkAndUpdate, 10000)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [lastBookingId])

  const getStatusBadge = (status: string, isRefunded: boolean, hasOriginalBookingId?: boolean) => {
    // Se foi reembolsado, mostrar badge de Reembolsado
    if (isRefunded) {
      return <Badge variant="secondary">Reembolsado</Badge>
    }
    // Se foi cancelado (e não foi reembolsado), mostrar badge de Cancelado
    if (status === "cancelled") {
      return <Badge variant="destructive">Cancelado</Badge>
    }
    // Se foi reagendado, mostrar badge de Reagendado
    if (hasOriginalBookingId) {
      return <Badge variant="default">Reagendado</Badge>
    }
    // Se está confirmado, mostrar badge de Confirmado
    if (status === "confirmed") {
      return <Badge className="bg-green-600 text-white hover:bg-green-600">Confirmado</Badge>
    }
    // Outros status
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "secondary",
      pending: "outline",
    }
    return (
      <Badge variant={variants[status] || "outline"}>
        {status === "completed" ? "Finalizado" : "Pendente"}
      </Badge>
    )
  }

  const handleRefund = async (bookingId: string) => {
    setRefundingBookingId(bookingId)
    try {
      const result = await refundBooking({
        bookingId,
        isAdmin: true, // Admin pode reembolsar sem respeitar tempo limite
      })
      if (result.success) {
        toast.success("Reembolso processado com sucesso!")
        // Atualizar lista de bookings
        const updatedBookings = await getAllBookings()
        setBookings(updatedBookings)
        if (updatedBookings[0]?.id) {
          setLastBookingId(updatedBookings[0].id)
        }
      } else {
        toast.error(result.error || "Erro ao processar reembolso")
      }
    } catch (error) {
      console.error(error)
      toast.error("Erro ao processar reembolso. Tente novamente.")
    } finally {
      setRefundingBookingId(null)
    }
  }

  // Usar o hook de disponibilidade diária (igual ao booking-flow)
  const { availableTimes, loading: isTimesLoading } = useDailyAvailability({
    date: selectedRescheduleDay,
    professionalId: currentRescheduleBooking?.professionalId || "",
    serviceDuration: currentRescheduleBooking?.service?.duration || 0,
    excludeBookingId: currentRescheduleBooking?.id,
    currentProfessionalId: currentRescheduleBooking?.professionalId,
  })

  // Criar timeSlots com todos os horários (disponíveis e indisponíveis)
  const availableTimeSet = useMemo(() => new Set(availableTimes), [availableTimes])

  const timeSlots = useMemo(() => {
    if (!selectedRescheduleDay) return []

    return TIME_LIST.map((time) => ({
      time,
      available: availableTimeSet.has(time),
    }))
  }, [availableTimeSet, selectedRescheduleDay])

  const handleReschedule = async (bookingId: string) => {
    if (!selectedRescheduleDay || !selectedRescheduleTime) {
      toast.error("Por favor, selecione uma data e horário")
      return
    }

    const newDate = set(selectedRescheduleDay, {
      hours: Number(selectedRescheduleTime.split(":")[0]),
      minutes: Number(selectedRescheduleTime.split(":")[1]),
    })

    setReschedulingBookingId(bookingId)
    try {
      const result = await rescheduleBooking({
        bookingId,
        newDate,
        isAdmin: true, // Admin pode reagendar sem respeitar limite
      })
      if (result.success) {
        toast.success("Agendamento reagendado com sucesso!")
        setRescheduleDialogOpen(null)
        setCurrentRescheduleBooking(null)
        setSelectedRescheduleDay(undefined)
        setSelectedRescheduleTime(undefined)
        // Atualizar lista de bookings
        const updatedBookings = await getAllBookings()
        setBookings(updatedBookings)
        if (updatedBookings[0]?.id) {
          setLastBookingId(updatedBookings[0].id)
        }
      } else {
        toast.error(result.error || "Erro ao reagendar")
      }
    } catch (error) {
      console.error(error)
      toast.error("Erro ao reagendar. Tente novamente.")
    } finally {
      setReschedulingBookingId(null)
    }
  }

  // Filtrar bookings por status
  const confirmedBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const hasOriginalBookingId = !!(booking as any).originalBookingId
      // Incluir confirmados e reagendados confirmados (novos bookings criados a partir de reagendamento)
      return booking.status === "confirmed" && !booking.isRefunded
    })
  }, [bookings])

  const refundedBookings = useMemo(() => {
    return bookings.filter((booking) => booking.isRefunded)
  }, [bookings])

  const cancelledBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const hasOriginalBookingId = !!(booking as any).originalBookingId
      return booking.status === "cancelled" && !booking.isRefunded && !hasOriginalBookingId
    })
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "completed")
  }, [bookings])

  // Função para renderizar um booking card
  const renderBookingCard = (booking: any) => {
    const isConfirmed = isFuture(new Date(booking.date))
    const hasPayment = booking.payment?.stripeId || booking.originalBooking?.payment?.stripeId
    const isCancelled = booking.status === "cancelled"
    const isCompleted = booking.status === "completed"
    const hasOriginalBookingId = !!(booking as any).originalBookingId
    const isReagendado = hasOriginalBookingId
    const isConfirmado = booking.status === "confirmed" && !hasOriginalBookingId
    
    // Para ADM: Reagendados e Confirmados SEMPRE têm Reagendar e Reembolsar
    // Finalizados não têm botões
    // ADM não precisa seguir travas - eles mandam!
    const shouldShowButtons = !booking.isRefunded && !isCompleted && (isReagendado || isConfirmado)
    // Sempre mostrar ambos os botões para ADM ter controle total - sem travas
    const canRefund = shouldShowButtons // ADM sempre pode reembolsar
    const canReschedule = shouldShowButtons // ADM sempre pode reagendar
    const isSubscriptionService = booking.service?.isSubscription || false

    return (
      <Card key={booking.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{booking.service.name}</h3>
                {getStatusBadge(booking.status, booking.isRefunded, hasOriginalBookingId)}
              </div>
              <p className="text-sm text-gray-400">
                {booking.client?.name || "Cliente"} - {booking.client?.email || "N/A"}
              </p>
              <p className="text-sm text-gray-400">
                Profissional: {booking.professional.name}
              </p>
              <p className="text-sm">
                {format(new Date(booking.date), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
              {booking.isRefunded && booking.updatedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Reembolsado em: {format(new Date(booking.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="text-right">
              {booking.payment && (
                <p className="text-sm font-semibold text-[#EE8530]">
                  {Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(booking.payment.amount))}
                </p>
              )}
            </div>
          </div>

          {/* Mostrar botões para Reagendados e Confirmados (não para Finalizados) */}
          {shouldShowButtons && (
            <div className="flex gap-2 pt-4 border-t border-gray-800">
              {canReschedule && (
                <Dialog
                  open={rescheduleDialogOpen === booking.id}
                  onOpenChange={(open) => {
                    setRescheduleDialogOpen(open ? booking.id : null)
                    if (open) {
                      setCurrentRescheduleBooking(booking)
                      setSelectedRescheduleDay(undefined)
                      setSelectedRescheduleTime(undefined)
                    } else {
                      setSelectedRescheduleDay(undefined)
                      setSelectedRescheduleTime(undefined)
                      setCurrentRescheduleBooking(null)
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={reschedulingBookingId === booking.id}
                    >
                      {reschedulingBookingId === booking.id ? "Reagendando..." : "Reagendar"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[90%] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader>
                      <DialogTitle>Reagendar Agendamento</DialogTitle>
                      <DialogDescription>
                        Selecione uma nova data e horário para este agendamento.
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
                        onClick={() => handleReschedule(booking.id)}
                        disabled={!selectedRescheduleDay || !selectedRescheduleTime || reschedulingBookingId === booking.id}
                        className="w-full sm:w-auto bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
                      >
                        {reschedulingBookingId === booking.id ? "Reagendando..." : "Confirmar Reagendamento"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {canRefund && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={refundingBookingId === booking.id}
                    >
                      {refundingBookingId === booking.id 
                        ? "Processando..." 
                        : isSubscriptionService 
                          ? "Cancelar Assinatura" 
                          : "Reembolsar"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[90%]">
                    <DialogHeader>
                      <DialogTitle>
                        {isSubscriptionService ? "Cancelar Assinatura" : "Reembolsar Agendamento"}
                      </DialogTitle>
                      <DialogDescription>
                        {isSubscriptionService 
                          ? "Você está prestes a cancelar esta assinatura e reembolsar o cliente. A assinatura será cancelada imediatamente e o valor será devolvido. Esta ação é irreversível."
                          : "Você está prestes a reembolsar este agendamento. O valor será devolvido ao cliente. Esta ação é irreversível."}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row gap-3">
                      <DialogClose asChild>
                        <Button variant="secondary" className="w-full">
                          Cancelar
                        </Button>
                      </DialogClose>
                      <DialogClose className="w-full">
                        <Button
                          variant="destructive"
                          onClick={() => handleRefund(booking.id)}
                          disabled={refundingBookingId === booking.id}
                          className="w-full"
                        >
                          {refundingBookingId === booking.id 
                            ? "Processando..." 
                            : isSubscriptionService 
                              ? "Confirmar Cancelamento" 
                              : "Confirmar Reembolso"}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Agendamentos</h2>

      <Tabs defaultValue="confirmed" className="w-full overflow-x-hidden">
        <div className="overflow-x-auto -mx-5 px-5 scrollbar-hide">
          <TabsList className="inline-flex w-auto gap-2 p-1 h-auto bg-[#1A1B1F] rounded-lg border border-gray-800">
            <TabsTrigger 
              value="confirmed" 
              className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Agendamento ({confirmedBookings.length})
            </TabsTrigger>
            <TabsTrigger 
              value="refunded" 
              className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reembolso ({refundedBookings.length})
            </TabsTrigger>
            <TabsTrigger 
              value="cancelled" 
              className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Cancelado ({cancelledBookings.length})
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              <CalendarCheck className="mr-2 h-4 w-4" />
              Finalizado ({completedBookings.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="confirmed" className="mt-6">
          {confirmedBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                Nenhum agendamento confirmado encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {confirmedBookings.map(renderBookingCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="refunded" className="mt-6">
          {refundedBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                Nenhum agendamento reembolsado encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {refundedBookings.map(renderBookingCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          {cancelledBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                Nenhum agendamento cancelado encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {cancelledBookings.map(renderBookingCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedBookings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                Nenhum agendamento finalizado encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedBookings.map(renderBookingCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminBookingsTab

