import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await db.barbershopService.findUnique({
      where: { id: params.id },
      include: {
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    })

    if (!service) {
      return NextResponse.json(
        { error: "Serviço não encontrado" },
        { status: 404 }
      )
    }

    const professionals = service.professionals.map((ps) => ps.professional)

    return NextResponse.json(professionals)
  } catch (error) {
    console.error("Erro ao buscar profissionais:", error)
    return NextResponse.json(
      { error: "Erro ao buscar profissionais" },
      { status: 500 }
    )
  }
}

