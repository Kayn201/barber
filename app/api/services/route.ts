import { NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"

export async function GET() {
  try {
    const services = await db.barbershopService.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    })

    return NextResponse.json(services)
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao buscar serviços" },
      { status: 500 }
    )
  }
}

