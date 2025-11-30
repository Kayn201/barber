"use server"

import { cookies } from "next/headers"
import { db } from "../_lib/prisma"

export const saveClientEmail = async (email: string) => {
  if (!email) return { success: false, error: "Email é obrigatório" }

  try {
    // Salvar email no cookie
    cookies().set("clientEmail", email, {
      maxAge: 60 * 60 * 24 * 365, // 1 ano
      path: "/",
    })

    // Tentar buscar cliente pelo email para pegar o clientId
    const client = await db.client.findFirst({
      where: { email: email },
      select: { id: true },
    })

    if (client) {
      cookies().set("clientId", client.id, {
        maxAge: 60 * 60 * 24 * 365, // 1 ano
        path: "/",
      })
      return { success: true, clientId: client.id }
    }

    return { success: true, clientId: null }
  } catch (error) {
    console.error("Erro ao salvar email do cliente:", error)
    return { success: false, error: "Erro ao salvar email" }
  }
}

