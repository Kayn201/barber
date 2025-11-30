"use server"

import { db } from "@/app/_lib/prisma"
import { revalidatePath } from "next/cache"

export async function deleteProfessional(professionalId: string) {
  try {
    await db.professional.delete({
      where: { id: professionalId },
    })

    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Erro ao deletar profissional:", error)
    return { success: false, error: "Erro ao deletar profissional" }
  }
}

