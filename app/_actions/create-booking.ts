"use server"

import { revalidatePath } from "next/cache"
import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { isSlotAvailable } from "../_lib/check-slot-availability"

interface CreateBookingParams {
  serviceId: string
  date: Date
  professionalId?: string
}

export const createBooking = async (params: CreateBookingParams) => {
  const user = await getServerSession(authOptions)
  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Buscar o serviço para pegar a duração
  const service = await db.barbershopService.findUnique({
    where: { id: params.serviceId },
    include: {
      professionals: {
        include: {
          professional: true,
        },
      },
    },
  })

  if (!service) {
    throw new Error("Serviço não encontrado")
  }

  // Se não foi passado professionalId, buscar um profissional disponível no horário
  let professionalId = params.professionalId
  if (!professionalId) {
    for (const ps of service.professionals) {
      const available = await isSlotAvailable({
        professionalId: ps.professional.id,
        startDate: params.date,
        serviceDuration: service.duration,
      })
      if (available) {
        professionalId = ps.professional.id
        break
      }
    }

    if (!professionalId) {
      throw new Error("Este horário já está ocupado. Por favor, escolha outro horário.")
    }
  }

  const slotAvailable = await isSlotAvailable({
    professionalId,
    startDate: params.date,
    serviceDuration: service.duration,
  })

  if (!slotAvailable) {
    throw new Error("Este horário já está ocupado. Por favor, escolha outro horário.")
  }

  await db.booking.create({
    data: {
      serviceId: params.serviceId,
      date: params.date,
      professionalId: professionalId,
      userId: (user.user as any).id,
    },
  })
  revalidatePath("/barbershops/[id]")
  revalidatePath("/bookings")
  revalidatePath("/")
  revalidatePath("/admin")
}
