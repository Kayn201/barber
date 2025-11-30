import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/_lib/auth"
import { db } from "@/app/_lib/prisma"
import { generateWalletPass } from "@/app/_lib/wallet-pass-generator"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar booking com todas as relações
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

    // Verificar se o usuário tem permissão (é o dono do booking)
    if (session?.user && (session.user as any).id) {
      if (booking.userId !== (session.user as any).id) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 403 }
        )
      }
    } else if (booking.clientId) {
      // Verificar se tem clientId no cookie
      const clientId = request.cookies.get("clientId")?.value
      if (booking.clientId !== clientId) {
        return NextResponse.json(
          { error: "Não autorizado" },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 403 }
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

    // Salvar walletPassUrl no booking
    const passUrl = `${baseUrl}/api/wallet/pass/${booking.id}`
    await db.booking.update({
      where: { id: bookingId },
      data: { walletPassUrl: passUrl },
    })
    
    // Revalidar páginas para atualizar em tempo real
    revalidatePath("/")
    revalidatePath("/bookings")
    revalidatePath("/admin")

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

