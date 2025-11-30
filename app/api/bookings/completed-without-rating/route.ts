import { NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"
import { cookies } from "next/headers"

export async function GET() {
  const clientId = cookies().get("clientId")?.value

  if (!clientId) {
    return NextResponse.json(null)
  }

  // Buscar agendamentos concluídos sem avaliação
  const booking = await db.booking.findFirst({
    where: {
      clientId,
      date: {
        lt: new Date(), // Data passada (serviço já foi executado)
      },
      status: {
        in: ["confirmed", "completed"],
      },
      ratingId: null, // Sem avaliação
    },
    include: {
      service: {
        select: {
          name: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      date: "desc", // Mais recente primeiro
    },
  })

  if (!booking) {
    return NextResponse.json(null)
  }

  return NextResponse.json(booking)
}

