"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import BookingItem from "./booking-item"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { CheckCircle2, CalendarCheck, RotateCcw, XCircle } from "lucide-react"

interface BookingsTabsProps {
  confirmedBookings: any[]
  concludedBookings: any[]
  refundedBookings: any[]
  rescheduledBookings: any[]
  barbershop?: {
    id: string
    name: string
    address: string
    imageUrl: string
    phones: string[]
  }
}

const BookingsTabs = ({
  confirmedBookings,
  concludedBookings,
  refundedBookings,
  rescheduledBookings,
  barbershop,
}: BookingsTabsProps) => {
  return (
    <Tabs defaultValue="confirmed" className="w-full overflow-x-hidden">
      <div className="overflow-x-auto -mx-5 px-5 scrollbar-hide">
        <TabsList className="inline-flex w-auto gap-2 p-1 h-auto bg-[#1A1B1F] rounded-lg border border-gray-800">
          <TabsTrigger 
            value="confirmed" 
            className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirmados ({confirmedBookings.length})
          </TabsTrigger>
          <TabsTrigger 
            value="rescheduled" 
            className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reagendados ({rescheduledBookings.length})
          </TabsTrigger>
          <TabsTrigger 
            value="concluded" 
            className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <CalendarCheck className="mr-2 h-4 w-4" />
            Finalizados ({concludedBookings.length})
          </TabsTrigger>
          <TabsTrigger 
            value="refunded" 
            className="flex-shrink-0 whitespace-nowrap data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reembolsados ({refundedBookings.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="confirmed" className="mt-6">
        {confirmedBookings.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Você não tem agendamentos confirmados.
          </p>
        ) : (
          <div className="space-y-3">
            {confirmedBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                barbershop={barbershop}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="rescheduled" className="mt-6">
        {rescheduledBookings.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Você não tem agendamentos reagendados.
          </p>
        ) : (
          <div className="space-y-3">
            {rescheduledBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                barbershop={barbershop}
                isRescheduled={true}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="concluded" className="mt-6">
        {concludedBookings.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Você não tem agendamentos finalizados.
          </p>
        ) : (
          <div className="space-y-3">
            {concludedBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                barbershop={barbershop}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="refunded" className="mt-6">
        {refundedBookings.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Você não tem agendamentos reembolsados.
          </p>
        ) : (
          <div className="space-y-3">
            {refundedBookings.map((booking) => (
              <Card
                key={booking.id}
                className="w-full rounded-[22px] border bg-[#1A1B1F] border-gray-800"
              >
                <CardContent className="px-6 py-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2">
                        Reembolsado
                      </Badge>
                      <h3 className="text-lg font-bold text-white mb-2">
                        {booking.service.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {booking.professional.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {format(new Date(booking.date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(booking.date), "HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  {booking.isRefunded && booking.updatedAt && (
                    <div className="pt-4 border-t border-gray-800">
                      <p className="text-xs text-gray-400">
                        Reembolsado em:{" "}
                        {format(new Date(booking.updatedAt), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export default BookingsTabs

