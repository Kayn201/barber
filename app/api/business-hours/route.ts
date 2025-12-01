import { NextResponse } from "next/server"
import { getBusinessHours } from "@/app/_actions/get-professionals-schedules"

export async function GET() {
  try {
    const businessHours = await getBusinessHours()
    return NextResponse.json(businessHours)
  } catch (error) {
    console.error("Erro ao buscar horários da empresa:", error)
    return NextResponse.json(
      { error: "Erro ao buscar horários" },
      { status: 500 }
    )
  }
}

