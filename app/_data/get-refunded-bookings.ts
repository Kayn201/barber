"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { db } from "../_lib/prisma"
import { cookies } from "next/headers"

export const getRefundedBookings = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  // Se estiver logado, buscar por userId
  if (session?.user) {
    return db.booking.findMany({
      where: {
        userId: (session.user as any).id,
        isRefunded: true,
      },
      include: {
        service: true,
        professional: true,
        client: true,
        payment: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  }

  // Se não estiver logado, buscar por clientId (cookie)
  if (clientId) {
    return db.booking.findMany({
      where: {
        clientId: clientId,
        isRefunded: true,
      },
      include: {
        service: true,
        professional: true,
        client: true,
        payment: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  }

  // Se não tem clientId mas tem email, buscar por email
  if (clientEmail) {
    const client = await db.client.findFirst({
      where: { email: clientEmail },
      select: { id: true },
    })

    if (client) {
      return db.booking.findMany({
        where: {
          clientId: client.id,
          isRefunded: true,
        },
        include: {
          service: true,
          professional: true,
          client: true,
          payment: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
    }
  }

  return []
}

