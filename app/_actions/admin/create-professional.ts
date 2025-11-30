"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

interface WeeklyScheduleItem {
  dayOfWeek: number // 1-5 (segunda a sexta)
  startTime: string // "08:00"
  endTime: string // "18:00"
  isAvailable: boolean
}

interface CreateProfessionalParams {
  name: string
  profession: string
  imageUrl: string
  serviceIds: string[]
  weeklySchedule: WeeklyScheduleItem[]
}

export async function createProfessional(params: CreateProfessionalParams) {
  try {
    const professional = await db.professional.create({
      data: {
        name: params.name,
        profession: params.profession,
        imageUrl: params.imageUrl,
        services: {
          create: params.serviceIds.map((serviceId) => ({
            serviceId,
          })),
        },
        weeklySchedule: {
          create: params.weeklySchedule.map((schedule) => ({
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isAvailable: schedule.isAvailable,
          })),
        },
      },
      include: {
        services: true,
        weeklySchedule: true,
      },
    })

    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true, professional }
  } catch (error) {
    console.error("Erro ao criar profissional:", error)
    return { success: false, error: "Erro ao criar profissional" }
  }
}

