import { cookies } from "next/headers"
import { db } from "@/app/_lib/prisma"
import { redirect } from "next/navigation"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get("email")
  const clientId = searchParams.get("clientId")

  if (!email && !clientId) {
    redirect("/")
  }

  try {
    // Se tem email, salvar no cookie
    if (email) {
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
        redirect(`/?clientId=${client.id}`)
      }
    }

    // Se tem clientId, salvar no cookie
    if (clientId) {
      cookies().set("clientId", clientId, {
        maxAge: 60 * 60 * 24 * 365, // 1 ano
        path: "/",
      })

      // Buscar email do cliente
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { email: true },
      })

      if (client?.email) {
        cookies().set("clientEmail", client.email, {
          maxAge: 60 * 60 * 24 * 365, // 1 ano
          path: "/",
        })
      }

      redirect(`/?clientId=${clientId}`)
    }

    // Se só tem email mas não encontrou cliente, redirecionar para home
    // Quando o webhook processar, o cliente será criado e os agendamentos aparecerão
    redirect("/")
  } catch (error) {
    console.error("Erro ao salvar cookie:", error)
    redirect("/")
  }
}

