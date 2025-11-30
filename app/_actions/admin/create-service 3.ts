"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

interface CreateServiceParams {
  name: string
  description: string
  imageUrl: string
  price: number
  duration: number
  isSubscription: boolean
  subscriptionInterval?: string
  isActive?: boolean
  cancellationTimeMinutes?: number
  maxReschedules?: number
}

export async function createService(params: CreateServiceParams) {
  try {
    const service = await db.barbershopService.create({
      data: {
        name: params.name,
        description: params.description,
        imageUrl: params.imageUrl,
        price: params.price,
        duration: params.duration,
        isSubscription: params.isSubscription,
        subscriptionInterval: params.isSubscription
          ? params.subscriptionInterval || null
          : null,
        isActive: params.isActive ?? true,
        cancellationTimeMinutes: params.cancellationTimeMinutes ?? 1440,
        maxReschedules: params.maxReschedules ?? 1,
      },
    })

    revalidatePath("/admin")
    revalidatePath("/")
    revalidatePath("/api/services")
    return { success: true, service }
  } catch (error) {
    console.error("Erro ao criar serviço:", error)
    return { success: false, error: "Erro ao criar serviço" }
  }
}

