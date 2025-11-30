"use server"

import { db } from "../../_lib/prisma"

export const checkNewSubscriptions = async (lastSubscriptionId?: string) => {
  // Se não há última subscription conhecida, retornar que há novas
  if (!lastSubscriptionId) {
    return { hasNew: true }
  }

  // Verificar se existe alguma subscription mais recente que a última conhecida
  const latestSubscription = await db.subscription.findFirst({
    orderBy: {
      updatedAt: "desc", // Usar updatedAt para detectar mudanças de status também
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!latestSubscription) {
    return { hasNew: false }
  }

  // Se o ID da última subscription conhecida não existe mais ou é diferente, há novas
  const lastKnownSubscription = await db.subscription.findUnique({
    where: { id: lastSubscriptionId },
    select: { createdAt: true, updatedAt: true },
  })

  // Verificar se há novas subscriptions OU se alguma subscription foi atualizada
  const hasNew = !lastKnownSubscription || 
                 latestSubscription.id !== lastSubscriptionId ||
                 (lastKnownSubscription.updatedAt.getTime() !== latestSubscription.updatedAt.getTime())

  return {
    hasNew,
    latestSubscriptionId: latestSubscription.id,
  }
}

