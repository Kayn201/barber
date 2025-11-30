import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"
import { generateWalletPass } from "@/app/_lib/wallet-pass-generator"
import crypto from "crypto"
import path from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { bookingId } = params

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        professional: true,
        client: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
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

    // URL base do web service
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const webServiceURL = `${baseUrl}/api/wallet/v1`

    // Gerar o passe - usar caminho relativo à raiz do projeto
    const certificatesPath = process.env.WALLET_CERTIFICATES_PATH || 
      path.join(process.cwd(), "wallet", "certificates")

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

    // Retornar o arquivo .pkpass
    return new NextResponse(new Uint8Array(passBuffer), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="agendamento-${booking.id}.pkpass"`,
      },
    })
  } catch (error) {
    console.error("Erro ao gerar wallet pass:", error)
    return NextResponse.json(
      { error: "Erro ao gerar passe" },
      { status: 500 }
    )
  }
}

