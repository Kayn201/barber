"use server"

import { db } from "../_lib/prisma"
import { generateWalletPass } from "../_lib/wallet-pass-generator"
import { getBaseUrl } from "../_lib/get-base-url"
import crypto from "crypto"
import path from "path"
import fs from "fs"

/**
 * Gera wallet pass automaticamente para um booking
 * Esta função é chamada após criar um booking para gerar o pass automaticamente
 */
export async function generateWalletPassForBooking(bookingId: string) {
  try {
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
      console.error("❌ Booking não encontrado para gerar wallet pass:", bookingId)
      return { success: false, error: "Booking não encontrado" }
    }

    // Se já tem walletPassUrl, não precisa gerar novamente
    if (booking.walletPassUrl) {
      console.log("ℹ️ Booking já tem wallet pass:", booking.walletPassUrl)
      return { success: true, alreadyExists: true }
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
    
    console.log("   - baseUrl:", baseUrl)
    console.log("   - webServiceURL:", webServiceURL)

    // Gerar o passe - usar caminho de certificados
    // Priorizar WALLET_CERTIFICATES_PATH se for um caminho absoluto válido
    let certificatesPath: string
    if (process.env.WALLET_CERTIFICATES_PATH && path.isAbsolute(process.env.WALLET_CERTIFICATES_PATH)) {
      // Usar caminho absoluto se fornecido
      certificatesPath = process.env.WALLET_CERTIFICATES_PATH
    } else {
      // Fallback: caminho relativo ao projeto
      certificatesPath = path.join(process.cwd(), "wallet", "certificates")
    }

    console.log("💳 Gerando wallet pass automaticamente para booking:", bookingId)
    console.log("   - Procurando certificados em:", certificatesPath)
    console.log("   - process.cwd():", process.cwd())
    console.log("   - WALLET_CERTIFICATES_PATH:", process.env.WALLET_CERTIFICATES_PATH || "não definido")
    
    // Verificar se o diretório existe
    if (!fs.existsSync(certificatesPath)) {
      console.error("❌ Diretório de certificados não encontrado:", certificatesPath)
      return { success: false, error: "Diretório de certificados não encontrado. Configure os certificados do Wallet Pass." }
    }
    
    // Verificar se há certificados no diretório
    const filesInDir = fs.readdirSync(certificatesPath)
    console.log("   - Arquivos encontrados no diretório:", filesInDir)
    
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

    console.log("✅ Wallet pass gerado e salvo automaticamente:", passUrl)

    return { success: true, walletPassUrl: passUrl }
  } catch (error: any) {
    // Não bloquear criação do booking se falhar
    console.error("❌ Erro ao gerar wallet pass automaticamente:", error.message)
    return { success: false, error: error.message }
  }
}

