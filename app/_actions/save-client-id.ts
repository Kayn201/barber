"use server"

import { cookies } from "next/headers"

export const saveClientId = async (clientId: string) => {
  if (!clientId) return { success: false, error: "ClientId é obrigatório" }

  try {
    cookies().set("clientId", clientId, {
      maxAge: 60 * 60 * 24 * 365, // 1 ano
      path: "/",
    })
    return { success: true }
  } catch (error) {
    console.error("Erro ao salvar clientId:", error)
    return { success: false, error: "Erro ao salvar clientId" }
  }
}

