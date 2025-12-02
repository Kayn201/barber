import { cookies } from "next/headers"
import { db } from "@/app/_lib/prisma"
import { redirect } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"
import { getBaseUrl } from "@/app/_lib/get-base-url"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email
    const clientId = body.clientId

    if (!email && !clientId) {
      return NextResponse.json({ error: "Email ou clientId é obrigatório" }, { status: 400 })
    }

    // Se tem email, salvar no cookie
    if (email) {
      cookies().set("clientEmail", email, {
        maxAge: 60 * 60 * 24 * 365, // 1 ano
        path: "/",
        sameSite: "lax",
      })

      // Tentar buscar cliente pelo email para pegar o clientId
      // Se não encontrar, aguardar um pouco (webhook pode estar processando)
      let client = await db.client.findFirst({
        where: { email: email },
        select: { id: true },
      })

      // Se não encontrou, aguardar até 2 segundos (webhook pode estar processando)
      if (!client) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms x 4 = 2s
          client = await db.client.findFirst({
            where: { email: email },
            select: { id: true },
          })
          if (client) {
            console.log("✅ Cliente encontrado após aguardar:", client.id)
            break
          }
        }
      }

      if (client) {
        cookies().set("clientId", client.id, {
          maxAge: 60 * 60 * 24 * 365, // 1 ano
          path: "/",
          sameSite: "lax",
        })
        console.log("✅ Cookie salvo com sucesso - clientId:", client.id)
        return NextResponse.json({ success: true, clientId: client.id })
      } else {
        console.log("⏳ Cliente ainda não criado. Email salvo no cookie.")
        console.log("💡 O sistema tentará processar automaticamente na próxima requisição.")
        return NextResponse.json({ success: true, message: "Email salvo, aguardando criação do cliente" })
      }
    }

    // Se tem clientId, salvar no cookie
    if (clientId) {
      cookies().set("clientId", clientId, {
        maxAge: 60 * 60 * 24 * 365, // 1 ano
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
          maxAge: 60 * 60 * 24 * 365, // 1 ano
          path: "/",
          sameSite: "lax",
        })
      }

      console.log("✅ Cookie salvo com sucesso - clientId:", clientId)
      return NextResponse.json({ success: true, clientId })
    }

    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  } catch (error: any) {
    console.error("Erro ao salvar cookie:", error)
    return NextResponse.json({ error: "Erro ao salvar cookie" }, { status: 500 })
  }
}

// Manter GET para compatibilidade, mas sem expor email na URL
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get("clientId")

  if (!clientId) {
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL("/", baseUrl))
  }

  try {
    cookies().set("clientId", clientId, {
      maxAge: 60 * 60 * 24 * 365, // 1 ano
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
        maxAge: 60 * 60 * 24 * 365, // 1 ano
        path: "/",
        sameSite: "lax",
      })
    }

    console.log("✅ Cookie salvo com sucesso - clientId:", clientId)
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL("/", baseUrl))
  } catch (error: any) {
    console.error("Erro ao salvar cookie:", error)
    const baseUrl = getBaseUrl()
    return NextResponse.redirect(new URL("/", baseUrl))
  }
}

