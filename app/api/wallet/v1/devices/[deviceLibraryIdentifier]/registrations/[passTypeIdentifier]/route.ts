import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_lib/prisma"

const PASS_TYPE_IDENTIFIER = "pass.teste.popupsystem.com.br"

// GET - Listar serial numbers registrados para um device
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceLibraryIdentifier: string
      passTypeIdentifier: string
    }
  }
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = params

    if (passTypeIdentifier !== PASS_TYPE_IDENTIFIER) {
      return NextResponse.json(
        { error: "PassTypeIdentifier inválido" },
        { status: 400 }
      )
    }

    // Buscar ou criar device
    let device = await db.device.findUnique({
      where: { deviceLibraryIdentifier },
      include: {
        registrations: {
          where: { passTypeIdentifier },
        },
      },
    })

    if (!device) {
      device = await db.device.create({
        data: {
          deviceLibraryIdentifier,
          registrations: {
            create: [],
          },
        },
        include: {
          registrations: {
            where: { passTypeIdentifier },
          },
        },
      })
    }

    // Retornar lista de serial numbers
    const serialNumbers = device.registrations.map((reg) => reg.serialNumber)

    if (serialNumbers.length === 0) {
      return NextResponse.json({}, { status: 204 })
    }

    return NextResponse.json(serialNumbers, {
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Erro ao listar registros:", error)
    return NextResponse.json(
      { error: "Erro ao processar requisição" },
      { status: 500 }
    )
  }
}

// POST - Registrar um passe para um device
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceLibraryIdentifier: string
      passTypeIdentifier: string
    }
  }
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = params

    if (passTypeIdentifier !== PASS_TYPE_IDENTIFIER) {
      return NextResponse.json(
        { error: "PassTypeIdentifier inválido" },
        { status: 400 }
      )
    }

    const { serialNumber, pushToken } = await request.json()

    if (!serialNumber) {
      return NextResponse.json(
        { error: "serialNumber é obrigatório" },
        { status: 400 }
      )
    }

    // Verificar se o booking existe
    const booking = await db.booking.findUnique({
      where: { id: serialNumber },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Passe não encontrado" },
        { status: 404 }
      )
    }

    // Buscar ou criar device
    let device = await db.device.findUnique({
      where: { deviceLibraryIdentifier },
    })

    if (!device) {
      device = await db.device.create({
        data: {
          deviceLibraryIdentifier,
        },
      })
    }

    // Criar ou atualizar registro
    await db.passRegistration.upsert({
      where: {
        passTypeIdentifier_serialNumber_deviceId: {
          passTypeIdentifier,
          serialNumber,
          deviceId: device.id,
        },
      },
      create: {
        deviceId: device.id,
        passTypeIdentifier,
        serialNumber,
        pushToken: pushToken || null,
      },
      update: {
        pushToken: pushToken || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({}, { status: 201 })
  } catch (error) {
    console.error("Erro ao registrar passe:", error)
    return NextResponse.json(
      { error: "Erro ao processar requisição" },
      { status: 500 }
    )
  }
}

// DELETE - Desregistrar um passe de um device
export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      deviceLibraryIdentifier: string
      passTypeIdentifier: string
    }
  }
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = params

    if (passTypeIdentifier !== PASS_TYPE_IDENTIFIER) {
      return NextResponse.json(
        { error: "PassTypeIdentifier inválido" },
        { status: 400 }
      )
    }

    const url = new URL(request.url)
    const serialNumber = url.searchParams.get("passes")

    if (!serialNumber) {
      return NextResponse.json(
        { error: "serialNumber é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar device
    const device = await db.device.findUnique({
      where: { deviceLibraryIdentifier },
    })

    if (!device) {
      return NextResponse.json({}, { status: 200 })
    }

    // Deletar registro
    await db.passRegistration.deleteMany({
      where: {
        deviceId: device.id,
        passTypeIdentifier,
        serialNumber,
      },
    })

    return NextResponse.json({}, { status: 200 })
  } catch (error) {
    console.error("Erro ao desregistrar passe:", error)
    return NextResponse.json(
      { error: "Erro ao processar requisição" },
      { status: 500 }
    )
  }
}

