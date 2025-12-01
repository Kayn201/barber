"use server"

import { db } from "../../_lib/prisma"
import { revalidatePath } from "next/cache"

interface BusinessHours {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface UpdateBusinessProfileParams {
  name: string
  address: string
  phones: string[]
  description: string
  imageUrl: string
  businessNumber?: string
  businessHours: BusinessHours[]
}

export const updateBusinessProfile = async (
  barbershopId: string,
  data: UpdateBusinessProfileParams
) => {
  try {
    // Atualizar dados da barbearia
    await db.barbershop.update({
      where: { id: barbershopId },
      data: {
        name: data.name,
        address: data.address,
        phones: data.phones,
        description: data.description,
        imageUrl: data.imageUrl,
        businessNumber: data.businessNumber,
      },
    })

    // Deletar horários antigos
    await db.businessHours.deleteMany({
      where: { barbershopId },
    })

    // Criar novos horários
    await db.businessHours.createMany({
      data: data.businessHours.map((hours) => ({
        barbershopId,
        dayOfWeek: hours.dayOfWeek,
        startTime: hours.startTime,
        endTime: hours.endTime,
        isAvailable: hours.isAvailable,
      })),
    })

    // Sincronizar profissionais: desativar dias que a empresa fechou
    const closedDays = data.businessHours
      .filter((h) => !h.isAvailable)
      .map((h) => h.dayOfWeek)

    // Buscar todos os profissionais para sincronizar
    const allProfessionals = await db.professional.findMany({
      include: {
        weeklySchedule: true,
      },
    })

    // Para cada profissional, sincronizar os dias fechados
    for (const professional of allProfessionals) {
      // Buscar horários atuais do profissional
      const currentSchedules = await db.weeklySchedule.findMany({
        where: { professionalId: professional.id },
      })

      // Criar mapa de todos os dias da semana
      const allDays = [0, 1, 2, 3, 4, 5, 6] // Domingo a Sábado
      const updatedSchedule = allDays.map((dayOfWeek) => {
        const existing = currentSchedules.find((s) => s.dayOfWeek === dayOfWeek)
        const businessDay = data.businessHours.find((h) => h.dayOfWeek === dayOfWeek)
        
        // Se a empresa fechou este dia, desativar automaticamente
        if (closedDays.includes(dayOfWeek)) {
          return {
            dayOfWeek,
            startTime: existing?.startTime || businessDay?.startTime || "08:00",
            endTime: existing?.endTime || businessDay?.endTime || "18:00",
            isAvailable: false, // Sempre false se empresa fechou
          }
        }
        
        // Manter horário existente (se empresa está aberta, profissional pode estar ativo ou não)
        return existing
          ? {
              dayOfWeek: existing.dayOfWeek,
              startTime: existing.startTime,
              endTime: existing.endTime,
              isAvailable: existing.isAvailable, // Manter estado atual se empresa está aberta
            }
          : {
              dayOfWeek,
              startTime: businessDay?.startTime || "08:00",
              endTime: businessDay?.endTime || "18:00",
              isAvailable: businessDay?.isAvailable || false,
            }
      })

      // Atualizar horários do profissional
      await db.weeklySchedule.deleteMany({
        where: { professionalId: professional.id },
      })

      if (updatedSchedule.length > 0) {
        await db.weeklySchedule.createMany({
          data: updatedSchedule.map((schedule) => ({
            professionalId: professional.id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isAvailable: schedule.isAvailable,
          })),
        })
      }
    }

    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Erro ao atualizar perfil empresarial:", error)
    return {
      success: false,
      error: "Erro ao atualizar perfil empresarial",
    }
  }
}

