"use server"

import { db } from "../_lib/prisma"

export const getProfessionalSchedule = async (professionalId: string) => {
  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    select: {
      weeklySchedule: true,
      blockedDates: true,
    },
  })

  return professional
}

