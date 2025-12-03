import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"
import { generateWalletPass } from "@/app/_lib/wallet-pass-generator"
import { getBaseUrl } from "@/app/_lib/get-base-url"
import crypto from "crypto"
import path from "path"

const PASS_TYPE_IDENTIFIER = "pass.popupsystem.com.br"

// GET - Retornar versão atualizada do passe
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      passTypeIdentifier: string
      serialNumber: string
    }
  }
) {
  try {
    const { passTypeIdentifier, serialNumber } = params

    if (passTypeIdentifier !== PASS_TYPE_IDENTIFIER) {
      return NextResponse.json(
        { error: "PassTypeIdentifier inválido" },
        { status: 400 }
      )
    }

    // Verificar authentication token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("ApplePass ")) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    // Buscar booking
    const booking = await db.booking.findUnique({
      where: { id: serialNumber },
      include: {
        service: true,
        professional: true,
        client: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Passe não encontrado" },
        { status: 404 }
      )
    }

    // Buscar barbershop
    const barbershop = await db.barbershop.findFirst({
      select: {
        name: true,
        address: true,
        phones: true,
      },
    })

    // Gerar authentication token
    const authenticationToken = crypto.randomBytes(16).toString("hex")

    // URL base do web service - usar URL de produção
    const baseUrl = getBaseUrl()
    const webServiceURL = `${baseUrl}/api/wallet/v1`

    // Gerar o passe atualizado - usar caminho de certificados
    // Priorizar WALLET_CERTIFICATES_PATH se for um caminho absoluto válido
    let certificatesPath: string
    if (process.env.WALLET_CERTIFICATES_PATH && path.isAbsolute(process.env.WALLET_CERTIFICATES_PATH)) {
      // Usar caminho absoluto se fornecido
      certificatesPath = process.env.WALLET_CERTIFICATES_PATH
    } else {
      // Fallback: caminho relativo ao projeto
      certificatesPath = path.join(process.cwd(), "wallet", "certificates")
    }

    const passBuffer = await generateWalletPass(
      {
        booking: {
          id: booking.id,
          service: booking.service,
          professional: booking.professional,
          date: booking.date,
          status: booking.status,
          barbershop: barbershop || undefined,
        },
        webServiceURL,
        authenticationToken,
      },
      certificatesPath
    )

    // Retornar o arquivo .pkpass atualizado
    return new NextResponse(new Uint8Array(passBuffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="agendamento-${booking.id}.pkpass"`,
      },
    })
  } catch (error) {
    console.error("Erro ao retornar passe atualizado:", error)
    return NextResponse.json(
      { error: "Erro ao processar requisição" },
      { status: 500 }
    )
  }
}

