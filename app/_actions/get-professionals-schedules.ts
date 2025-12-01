"use server"

import { db } from "../_lib/prisma"

export async function getProfessionalsSchedules(professionalIds: string[]) {
  if (professionalIds.length === 0) return []

  const professionals = await db.professional.findMany({
    where: {
      id: {
        in: professionalIds,
      },
    },
    include: {
      weeklySchedule: true,
    },
  })

  return professionals.map((p) => ({
    id: p.id,
    weeklySchedule: p.weeklySchedule,
  }))
}

export async function getBusinessHours() {
  const barbershop = await db.barbershop.findFirst({
    include: {
      businessHours: true,
    },
  })

  return barbershop?.businessHours || []
}

