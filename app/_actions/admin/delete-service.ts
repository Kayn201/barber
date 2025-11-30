"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

export async function deleteService(serviceId: string) {
  try {
    await db.barbershopService.delete({
      where: { id: serviceId },
    })

    revalidatePath("/admin")
    revalidatePath("/")
    revalidatePath("/api/services")
    return { success: true }
  } catch (error) {
    console.error("Erro ao deletar serviço:", error)
    return { success: false, error: "Erro ao deletar serviço" }
  }
}

