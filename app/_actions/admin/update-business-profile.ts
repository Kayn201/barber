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

