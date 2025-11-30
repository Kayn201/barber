"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

interface UpdateServiceParams {
  id: string
  name?: string
  description?: string
  imageUrl?: string
  price?: number
  duration?: number
  isSubscription?: boolean
  subscriptionInterval?: string | null
  isActive?: boolean
  cancellationTimeMinutes?: number
  maxReschedules?: number
}

export async function updateService(params: UpdateServiceParams) {
  try {
    const { id, ...data } = params
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl
    if (data.price !== undefined) updateData.price = data.price
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.isSubscription !== undefined) {
      updateData.isSubscription = data.isSubscription
      if (!data.isSubscription) {
        updateData.subscriptionInterval = null
      }
    }
    if (data.subscriptionInterval !== undefined)
      updateData.subscriptionInterval = data.subscriptionInterval
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.cancellationTimeMinutes !== undefined)
      updateData.cancellationTimeMinutes = data.cancellationTimeMinutes
    if (data.maxReschedules !== undefined)
      updateData.maxReschedules = data.maxReschedules

    const service = await db.barbershopService.update({
      where: { id },
      data: updateData,
    })

    revalidatePath("/admin")
    revalidatePath("/")
    revalidatePath("/api/services")
    return { success: true, service }
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error)
    return { success: false, error: "Erro ao atualizar serviço" }
  }
}

