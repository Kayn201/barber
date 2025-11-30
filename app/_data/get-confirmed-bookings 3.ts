"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { db } from "../_lib/prisma"
import { cookies } from "next/headers"

export const getConfirmedBookings = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  // Se estiver logado, buscar por userId
  if (session?.user) {
    return db.booking.findMany({
      where: {
        userId: (session.user as any).id,
        date: {
          gte: new Date(),
        },
        status: "confirmed",
        // Incluir todos os confirmados, mesmo os que foram reagendados (novos bookings)
      },
      include: {
        service: true,
        professional: true,
        payment: true,
      },
      orderBy: {
        date: "asc",
      },
    })
  }

  // Se não estiver logado, buscar por clientId (cookie)
  if (clientId) {
    return db.booking.findMany({
      where: {
        clientId: clientId,
        date: {
          gte: new Date(),
        },
        status: "confirmed",
        // Incluir todos os confirmados, mesmo os que foram reagendados (novos bookings)
      },
      include: {
        service: true,
        professional: true,
        payment: true,
      },
      orderBy: {
        date: "asc",
      },
    })
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
      
      return db.booking.findMany({
        where: {
          clientId: client.id,
          date: {
            gte: new Date(),
          },
          status: "confirmed",
          originalBookingId: null, // Apenas bookings confirmados que não foram reagendados
        },
        include: {
          service: true,
          professional: true,
          payment: true,
        },
        orderBy: {
          date: "asc",
        },
      })
    }
  }

  return []
}
