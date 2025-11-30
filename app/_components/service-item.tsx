"use client"

import { Barbershop, BarbershopService, Booking } from "@prisma/client"
import Image from "next/image"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet"
import { Calendar } from "./ui/calendar"
import { ptBR } from "date-fns/locale"
import { useEffect, useMemo, useState } from "react"
import { isPast, isToday, set } from "date-fns"
import { createBooking } from "../_actions/create-booking"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { getBookings } from "../_actions/get-bookings"
import { Dialog, DialogContent } from "./ui/dialog"
import SignInDialog from "./sign-in-dialog"
import BookingSummary from "./booking-summary"
import { useRouter } from "next/navigation"
import { getAvailableTimes, TIME_LIST } from "../_lib/get-available-times"

interface ServiceItemProps {
  service: BarbershopService
  barbershop: Pick<Barbershop, "name">
}


const ServiceItem = ({ service, barbershop }: ServiceItemProps) => {
  const { data } = useSession()
  const router = useRouter()
  const [signInDialogIsOpen, setSignInDialogIsOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | undefined>(
    undefined,
  )
  const [dayBookings, setDayBookings] = useState<Booking[]>([])
  const [bookingSheetIsOpen, setBookingSheetIsOpen] = useState(false)
  const [professionalIds, setProfessionalIds] = useState<string[]>([])
  const [isTimesLoading, setIsTimesLoading] = useState(false)

  // Buscar profissionais que fazem este serviço
  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const response = await fetch(`/api/services/${service.id}/professionals`)
        if (response.ok) {
          const data = await response.json()
          setProfessionalIds(data.map((p: any) => p.id))
        }
      } catch (error) {
        console.error("Erro ao buscar profissionais:", error)
      }
    }
    fetchProfessionals()
  }, [service.id])

  useEffect(() => {
    const fetch = async () => {
      if (!selectedDay) {
        setDayBookings([])
        return
      }

      setIsTimesLoading(true)
      try {
        const bookings = await getBookings({
          date: selectedDay,
        })
        setDayBookings(bookings)
      } finally {
        setIsTimesLoading(false)
      }
    }
    fetch()
  }, [selectedDay])

  const selectedDate = useMemo(() => {
    if (!selectedDay || !selectedTime) return
    return set(selectedDay, {
      hours: Number(selectedTime?.split(":")[0]),
      minutes: Number(selectedTime?.split(":")[1]),
    })
  }, [selectedDay, selectedTime])

  // Calcular horários disponíveis usando a mesma lógica de conflitos
  const availableTimeSet = useMemo(() => {
    if (!selectedDay || professionalIds.length === 0) return new Set<string>()

    const times = getAvailableTimes({
      bookings: dayBookings.map((b) => ({
        ...b,
        service: { duration: service.duration },
      })),
      selectedDay,
      serviceDuration: service.duration,
      professionalIds,
    })

    return new Set(times)
  }, [dayBookings, selectedDay, service.duration, professionalIds])

  const timeSlots = useMemo(() => {
    if (!selectedDay) return []

    return TIME_LIST.map((time) => ({
      time,
      available: availableTimeSet.has(time),
    }))
  }, [availableTimeSet, selectedDay])

  const handleBookingClick = () => {
    if (data?.user) {
      return setBookingSheetIsOpen(true)
    }
    return setSignInDialogIsOpen(true)
  }

  const handleBookingSheetOpenChange = (open: boolean) => {
    if (open) {
      // Quando abrir, garantir que nenhuma data está selecionada
      setSelectedDay(undefined)
      setSelectedTime(undefined)
      setDayBookings([])
    } else {
      // Quando fechar, resetar
      setSelectedDay(undefined)
      setSelectedTime(undefined)
      setDayBookings([])
    }
    setBookingSheetIsOpen(open)
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDay(date)
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
  }

  const handleCreateBooking = async () => {
    try {
      if (!selectedDate) return
      await createBooking({
        serviceId: service.id,
        date: selectedDate,
      })
      handleBookingSheetOpenChange(false)
      toast.success("Reserva criada com sucesso!", {
        action: {
          label: "Ver agendamentos",
          onClick: () => router.push("/bookings"),
        },
      })
    } catch (error) {
      console.error(error)
      toast.error("Erro ao criar reserva!")
    }
  }


  return (
    <>
      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          {/* IMAGE */}
            {service.imageUrl?.trim() ? (
              <div className="relative max-h-[110px] min-h-[110px] min-w-[110px] max-w-[110px]">
                <Image
                  alt={service.name}
                  src={service.imageUrl}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>
            ) : null}
          {/* DIREITA */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{service.name}</h3>
            <p className="text-sm text-gray-400">{service.description}</p>
            {/* PREÇO E BOTÃO */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary">
                {Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(service.price))}
              </p>

              <Sheet
                open={bookingSheetIsOpen}
                onOpenChange={handleBookingSheetOpenChange}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBookingClick}
                >
                  Reservar
                </Button>

                <SheetContent className="px-0">
                  <SheetHeader>
                    <SheetTitle>Fazer Reserva</SheetTitle>
                  </SheetHeader>

                  <div className="border-b border-solid py-5">
                    <Calendar
                      mode="single"
                      locale={ptBR}
                      selected={selectedDay}
                      onSelect={handleDateSelect}
                      fromDate={new Date()}
                      styles={{
                        head_cell: {
                          width: "100%",
                          textTransform: "capitalize",
                        },
                        cell: {
                          width: "100%",
                        },
                        button: {
                          width: "100%",
                        },
                        nav_button_previous: {
                          width: "32px",
                          height: "32px",
                        },
                        nav_button_next: {
                          width: "32px",
                          height: "32px",
                        },
                        caption: {
                          textTransform: "capitalize",
                        },
                      }}
                    />
                  </div>

                  {selectedDay && (
                    <div className="flex gap-3 overflow-x-auto border-b border-solid p-5 [&::-webkit-scrollbar]:hidden">
                    {isTimesLoading && (
                      <p className="text-xs text-gray-500">Carregando horários...</p>
                    )}
                    {!isTimesLoading &&
                      timeSlots.map(({ time, available }) => (
                        <Button
                          key={time}
                          variant={selectedTime === time ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => handleTimeSelect(time)}
                          disabled={!available}
                        >
                          {time}
                        </Button>
                      ))}
                    {!isTimesLoading && timeSlots.every((slot) => !slot.available) && (
                      <p className="text-xs text-gray-500">
                        Não há horários disponíveis para este dia.
                      </p>
                    )}
                    </div>
                  )}

                  {selectedDate && (
                    <div className="p-5">
                      <BookingSummary
                        barbershop={barbershop}
                        service={service}
                        selectedDate={selectedDate}
                      />
                    </div>
                  )}
                  <SheetFooter className="mt-5 px-5">
                    <Button
                      onClick={handleCreateBooking}
                      disabled={!selectedDay || !selectedTime}
                    >
                      Confirmar
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={signInDialogIsOpen}
        onOpenChange={(open) => setSignInDialogIsOpen(open)}
      >
        <DialogContent className="w-[90%]">
          <SignInDialog />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ServiceItem
