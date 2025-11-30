"use server"

import { getServerSession } from "next-auth"
import { db } from "../_lib/prisma"
import { authOptions } from "../_lib/auth"
import { cookies } from "next/headers"
import { isFuture } from "date-fns"

export const getConfirmedBookings = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  // Se estiver logado, buscar por userId
  if (session?.user) {
    const bookings = await db.booking.findMany({
      where: {
        userId: (session.user as any).id,
        status: "confirmed",
        isRefunded: false,
      },
      include: {
        service: true,
        professional: true,
        client: true,
        payment: true,
      },
      orderBy: {
        date: "asc",
      },
    })
    
    // Filtrar apenas os que são futuros
    return bookings.filter((booking) => isFuture(new Date(booking.date)))
  }

  // Se não estiver logado, buscar por clientId (cookie)
  if (clientId) {
    const bookings = await db.booking.findMany({
      where: {
        clientId: clientId,
        status: "confirmed",
        isRefunded: false,
      },
      include: {
        service: true,
        professional: true,
        client: true,
        payment: true,
      },
      orderBy: {
        date: "asc",
      },
    })
    
    // Filtrar apenas os que são futuros
    return bookings.filter((booking) => isFuture(new Date(booking.date)))
  }

  // Se não tem clientId mas tem email, buscar clientId pelo email
  if (clientEmail) {
    const client = await db.client.findFirst({
      where: { email: clientEmail },
      select: { id: true },
    })
    
    if (client) {
      // Salvar clientId no cookie para próximas buscas usando Server Action
      const { saveClientId } = await import("../_actions/save-client-id")
      await saveClientId(client.id)
      
      const bookings = await db.booking.findMany({
        where: {
          clientId: client.id,
          status: "confirmed",
          isRefunded: false,
        },
        include: {
          service: true,
          professional: true,
          client: true,
          payment: true,
        },
        orderBy: {
          date: "asc",
        },
      })
      
      // Filtrar apenas os que são futuros
      return bookings.filter((booking) => isFuture(new Date(booking.date)))
    }
  }

  return []
}

