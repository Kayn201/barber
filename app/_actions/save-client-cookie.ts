"use server"

import { cookies } from "next/headers"
import { db } from "../_lib/prisma"

interface SaveClientCookieParams {
  email?: string
  clientId?: string
}

export async function saveClientCookie({ email, clientId }: SaveClientCookieParams) {
  try {
    // Se tem email, salvar no cookie
    if (email) {
      cookies().set("clientEmail", email, {
        maxAge: 60 * 60 * 24 * 365, // 1 ano
        path: "/",
        sameSite: "lax",
      })

      // Tentar buscar cliente pelo email para pegar o clientId
      let client = await db.client.findFirst({
        where: { email: email },
        select: { id: true },
      })

      // Se não encontrou, aguardar até 2 segundos (webhook pode estar processando)
      if (!client) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 500))
          client = await db.client.findFirst({
            where: { email: email },
            select: { id: true },
          })
          if (client) {
            break
          }
        }
      }

      if (client) {
        cookies().set("clientId", client.id, {
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
          sameSite: "lax",
        })
      }
    }

    // Se tem clientId, salvar no cookie
    if (clientId) {
      cookies().set("clientId", clientId, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      })

      // Buscar email do cliente
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { email: true },
      })

      if (client?.email) {
        cookies().set("clientEmail", client.email, {
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
          sameSite: "lax",
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Erro ao salvar cookie:", error)
    return { success: false, error: "Erro ao salvar cookie" }
  }
}

