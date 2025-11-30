"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

interface WeeklyScheduleItem {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface UpdateProfessionalParams {
  id: string
  name?: string
  profession?: string
  imageUrl?: string
  serviceIds?: string[]
  weeklySchedule?: WeeklyScheduleItem[]
}

export async function updateProfessional(params: UpdateProfessionalParams) {
  try {
    const { id, ...data } = params

    // Atualizar dados básicos
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.profession !== undefined) updateData.profession = data.profession
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl

    // Atualizar serviços
    if (data.serviceIds !== undefined) {
      // Remover todos os serviços existentes
      await db.professionalService.deleteMany({
        where: { professionalId: id },
      })
      // Adicionar novos serviços
      if (data.serviceIds.length > 0) {
        await db.professionalService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            professionalId: id,
            serviceId,
          })),
        })
      }
    }

    // Atualizar horários semanais
    if (data.weeklySchedule !== undefined) {
      // Remover todos os horários existentes
      await db.weeklySchedule.deleteMany({
        where: { professionalId: id },
      })
      // Adicionar novos horários
      if (data.weeklySchedule.length > 0) {
        await db.weeklySchedule.createMany({
          data: data.weeklySchedule.map((schedule) => ({
            professionalId: id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isAvailable: schedule.isAvailable,
          })),
        })
      }
    }

    // Atualizar profissional
    const professional = await db.professional.update({
      where: { id },
      data: updateData,
      include: {
        services: true,
        weeklySchedule: true,
      },
    })

    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true, professional }
  } catch (error) {
    console.error("Erro ao atualizar profissional:", error)
    return { success: false, error: "Erro ao atualizar profissional" }
  }
}

