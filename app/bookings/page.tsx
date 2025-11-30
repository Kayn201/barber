import { getServerSession } from "next-auth"
import Header from "../_components/header"
import { authOptions } from "../_lib/auth"
import { notFound } from "next/navigation"
import BookingItem from "../_components/booking-item"
import { getConfirmedBookings } from "../_data/get-confirmed-bookings"
import { getConcludedBookings } from "../_data/get-concluded-bookings"
import { getRefundedBookings } from "../_data/get-refunded-bookings"
import { getRescheduledBookings } from "../_data/get-rescheduled-bookings"
import { db } from "../_lib/prisma"
import BookingsTabs from "../_components/bookings-tabs"

const Bookings = async () => {
  // Não exigir login - buscar agendamentos por userId ou clientId
  const confirmedBookings = await getConfirmedBookings()
  const concludedBookings = await getConcludedBookings()
  const refundedBookings = await getRefundedBookings()
  const rescheduledBookings = await getRescheduledBookings()
  
  // Buscar barbershop (assumindo que há apenas uma barbearia)
  const barbershop = await db.barbershop.findFirst({
    select: {
      id: true,
      name: true,
      address: true,
      imageUrl: true,
      phones: true,
    },
  })

  return (
    <>
      <Header />
      <div className="space-y-3 p-5">
        <h1 className="text-xl font-bold">Agendamentos</h1>
        <BookingsTabs
          confirmedBookings={JSON.parse(JSON.stringify(confirmedBookings))}
          concludedBookings={JSON.parse(JSON.stringify(concludedBookings))}
          refundedBookings={JSON.parse(JSON.stringify(refundedBookings))}
          rescheduledBookings={JSON.parse(JSON.stringify(rescheduledBookings))}
          barbershop={barbershop ? JSON.parse(JSON.stringify(barbershop)) : undefined}
        />
      </div>
    </>
  )
}

export default Bookings
