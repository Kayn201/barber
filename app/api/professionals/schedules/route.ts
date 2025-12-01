import { NextRequest, NextResponse } from "next/server"
import { getProfessionalsSchedules } from "@/app/_actions/get-professionals-schedules"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const idsParam = searchParams.get("ids")
    
    if (!idsParam) {
      return NextResponse.json({ error: "IDs não fornecidos" }, { status: 400 })
    }

    const ids = idsParam.split(",").filter(Boolean)
    const schedules = await getProfessionalsSchedules(ids)

    return NextResponse.json(schedules)
  } catch (error) {
    console.error("Erro ao buscar horários dos profissionais:", error)
    return NextResponse.json(
      { error: "Erro ao buscar horários" },
      { status: 500 }
    )
  }
}

