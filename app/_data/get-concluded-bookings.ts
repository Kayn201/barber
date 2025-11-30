"use server"

import { getServerSession } from "next-auth"
import { db } from "../_lib/prisma"
import { authOptions } from "../_lib/auth"
import { cookies } from "next/headers"

export const getConcludedBookings = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  // Se estiver logado, buscar por userId
  if (session?.user) {
    return db.booking.findMany({
      where: {
        userId: (session.user as any).id,
        date: {
          lt: new Date(),
        },
      },
      include: {
        service: true,
        professional: true,
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
          lt: new Date(),
        },
      },
      include: {
        service: true,
        professional: true,
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
            lt: new Date(),
          },
        },
        include: {
          service: true,
          professional: true,
        },
        orderBy: {
          date: "asc",
        },
      })
    }
  }

  return []
}
