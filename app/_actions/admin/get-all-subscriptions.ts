"use server"

import { db } from "../../_lib/prisma"

export const getAllSubscriptions = async () => {
  const subscriptions = await db.subscription.findMany({
    include: {
      client: {
        select: {
          id: true,
          name: true,
          // Não incluir email, phone, stripeId - dados sensíveis
        },
      },
      service: true,
    },
    orderBy: {
      updatedAt: "desc", // Ordenar por updatedAt para mostrar mudanças recentes primeiro
    },
    take: 50,
  })

  // Remover dados sensíveis antes de retornar
  return subscriptions.map((subscription) => ({
    ...subscription,
    client: subscription.client ? {
      id: subscription.client.id,
      name: subscription.client.name,
      // Email, phone e stripeId removidos
    } : null,
  }))
}

