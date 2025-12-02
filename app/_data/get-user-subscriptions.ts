"use server"

import { getServerSession } from "next-auth"
import { db } from "../_lib/prisma"
import { authOptions } from "../_lib/auth"
import { cookies } from "next/headers"

export const getUserSubscriptions = async () => {
  const session = await getServerSession(authOptions)
  const clientId = cookies().get("clientId")?.value
  const clientEmail = cookies().get("clientEmail")?.value

  // Se estiver logado, buscar por userId através do email
  if (session?.user) {
    const userEmail = (session.user as any).email
    
    // Buscar client pelo email
    const client = await db.client.findFirst({
      where: { email: userEmail },
      select: { id: true },
    })
    
    if (client) {
      const subscriptions = await db.subscription.findMany({
        where: {
          clientId: client.id,
          // Buscar todas as assinaturas (ativas, canceladas, etc) para o filtro funcionar
        },
        include: {
          service: true,
        },
        orderBy: {
          currentPeriodEnd: "desc",
        },
      })
      
      return subscriptions
    }
  }

  // Se não estiver logado, buscar por clientId (cookie)
  if (clientId) {
    const subscriptions = await db.subscription.findMany({
      where: {
        clientId: clientId,
        // Buscar todas as assinaturas (ativas, canceladas, etc) para o filtro funcionar
      },
      include: {
        service: true,
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    })
    
    return subscriptions
  }

  // Se não tem clientId mas tem email, buscar clientId pelo email
  if (clientEmail) {
    const client = await db.client.findFirst({
      where: { email: clientEmail },
      select: { id: true },
    })
    
    if (client) {
      const subscriptions = await db.subscription.findMany({
        where: {
          clientId: client.id,
          // Buscar todas as assinaturas (ativas, canceladas, etc) para o filtro funcionar
        },
        include: {
          service: true,
        },
        orderBy: {
          currentPeriodEnd: "desc",
        },
      })
      
      return subscriptions
    }
  }

  return []
}

