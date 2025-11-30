import { db } from "../_lib/prisma"
import AdminDashboard from "../_components/admin-dashboard"

const AdminPage = async () => {
  const services = await db.barbershopService.findMany({
    include: {
      professionals: {
        include: {
          professional: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const professionals = await db.professional.findMany({
    include: {
      services: {
        include: {
          service: true,
        },
      },
      ratings: true,
      weeklySchedule: true,
      _count: {
        select: {
          bookings: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const subscriptions = await db.subscription.findMany({
    include: {
      client: true,
      service: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const bookings = await db.booking.findMany({
    include: {
      client: true,
      service: true,
      professional: true,
      payment: true,
    },
    orderBy: {
      date: "desc",
    },
    take: 50,
  })

  const barbershop = await db.barbershop.findFirst({
    include: {
      businessHours: true,
    },
  })

  return (
    <AdminDashboard
      services={services.map((s) => ({
        ...s,
        price: Number(s.price), // Converter Decimal para número
      }))}
      professionals={JSON.parse(JSON.stringify(professionals))}
      subscriptions={JSON.parse(JSON.stringify(subscriptions))}
      bookings={JSON.parse(JSON.stringify(bookings))}
      barbershop={barbershop ? JSON.parse(JSON.stringify(barbershop)) : null}
    />
  )
}

export default AdminPage

