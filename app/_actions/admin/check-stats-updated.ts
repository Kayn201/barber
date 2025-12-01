"use server"

import { db } from "../../_lib/prisma"

export const checkStatsUpdated = async (lastCheckTimestamp?: number) => {
  // Se não há timestamp, retornar que há atualizações
  if (!lastCheckTimestamp) {
    return { hasUpdates: true }
  }

  // Verificar se há bookings ou payments mais recentes que o timestamp
  // Incluir também verificação de mudanças em isRefunded para detectar reembolsos
  const latestBooking = await db.booking.findFirst({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
      isRefunded: true,
    },
  })

  const latestPayment = await db.payment.findFirst({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
    },
  })

  // Verificar também se há algum booking que foi reembolsado recentemente
  const latestRefundedBooking = await db.booking.findFirst({
    where: {
      isRefunded: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
    },
  })

  const lastUpdate = latestBooking?.updatedAt || latestPayment?.updatedAt || latestRefundedBooking?.updatedAt
  if (!lastUpdate) {
    return { hasUpdates: false }
  }

  const lastUpdateTimestamp = new Date(lastUpdate).getTime()
  const hasUpdates = lastUpdateTimestamp > lastCheckTimestamp

  return {
    hasUpdates,
    lastUpdateTimestamp: lastUpdateTimestamp,
  }
}

