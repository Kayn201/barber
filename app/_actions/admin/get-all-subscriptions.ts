"use server"

import { db } from "../../_lib/prisma"

export const getAllSubscriptions = async () => {
  return db.subscription.findMany({
    include: {
      client: true,
      service: true,
    },
    orderBy: {
      updatedAt: "desc", // Ordenar por updatedAt para mostrar mudanças recentes primeiro
    },
    take: 50,
  })
}

