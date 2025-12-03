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
 * 
 * IMPORTANTE: Esta função tem timeout de 30 segundos e verifica se já existe wallet pass
 * para evitar gerações duplicadas.
 */
export async function generateWalletPassForBooking(bookingId: string) {
  const startTime = Date.now()
  const TIMEOUT_MS = 30000 // 30 segundos
  
  console.log(`🚀 [${bookingId}] Iniciando geração de wallet pass...`)
  
  try {
    // Verificar se já existe wallet pass ANTES de começar (evitar duplicatas)
    const existingBooking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { walletPassUrl: true },
    })

    if (existingBooking?.walletPassUrl) {
      console.log(`✅ [${bookingId}] Wallet pass já existe, pulando geração:`, existingBooking.walletPassUrl)
      return { success: true, alreadyExists: true, walletPassUrl: existingBooking.walletPassUrl }
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
      console.error(`❌ [${bookingId}] Booking não encontrado para gerar wallet pass`)
      return { success: false, error: "Booking não encontrado" }
    }

    // Verificar novamente após buscar (race condition protection)
    if (booking.walletPassUrl) {
      console.log(`✅ [${bookingId}] Wallet pass foi criado durante a busca, pulando geração:`, booking.walletPassUrl)
      return { success: true, alreadyExists: true, walletPassUrl: booking.walletPassUrl }
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
    console.log(`📁 [${bookingId}] Arquivos encontrados no diretório:`, filesInDir)
    
    // Criar Promise com timeout
    const generatePromise = generateWalletPass(
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

    // Adicionar timeout de 30 segundos
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: Geração de wallet pass excedeu ${TIMEOUT_MS}ms`))
      }, TIMEOUT_MS)
    })

    console.log(`⏱️ [${bookingId}] Gerando wallet pass (timeout: ${TIMEOUT_MS}ms)...`)
    const passBuffer = await Promise.race([generatePromise, timeoutPromise])

    // Verificar novamente se já foi criado por outra requisição (race condition)
    const checkBooking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { walletPassUrl: true },
    })

    if (checkBooking?.walletPassUrl) {
      console.log(`⚠️ [${bookingId}] Wallet pass foi criado por outra requisição durante a geração, descartando resultado`)
      return { success: true, alreadyExists: true, walletPassUrl: checkBooking.walletPassUrl }
    }

    // Salvar walletPassUrl no booking
    const passUrl = `${baseUrl}/api/wallet/pass/${booking.id}`
    await db.booking.update({
      where: { id: bookingId },
      data: { walletPassUrl: passUrl },
    })

    const duration = Date.now() - startTime
    console.log(`✅ [${bookingId}] Wallet pass gerado e salvo automaticamente em ${duration}ms:`, passUrl)

    return { success: true, walletPassUrl: passUrl }
  } catch (error: any) {
    const duration = Date.now() - startTime
    const errorMessage = error.message || String(error)
    
    console.error(`❌ [${bookingId}] Erro ao gerar wallet pass após ${duration}ms:`, errorMessage)
    console.error(`   - Stack:`, error.stack || "N/A")
    
    // Marcar booking como falha na geração (opcional - pode adicionar campo walletPassError)
    // Por enquanto, apenas logamos o erro
    
    return { success: false, error: errorMessage, duration }
  } finally {
    const duration = Date.now() - startTime
    if (duration > 10000) {
      console.warn(`⚠️ [${bookingId}] Geração de wallet pass demorou ${duration}ms (considerar otimização)`)
    }
  }
}

