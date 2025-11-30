"use server"

import { db } from "../_lib/prisma"
import https from "https"

const APNS_PRODUCTION_URL = "https://api.push.apple.com"
const APNS_DEVELOPMENT_URL = "https://api.sandbox.push.apple.com"

export async function notifyWalletUpdate(bookingId: string) {
  try {
    // Buscar todas as registrações para este booking
    const registrations = await db.passRegistration.findMany({
      where: {
        serialNumber: bookingId,
      },
      include: {
        device: true,
      },
    })

    if (registrations.length === 0) {
      return { success: true, message: "Nenhum dispositivo registrado" }
    }

    // Enviar notificação push para cada dispositivo
    const notifications = registrations
      .filter((reg) => reg.pushToken)
      .map((reg) => sendPushNotification(reg.pushToken!, bookingId))

    await Promise.all(notifications)

    return { success: true, message: "Notificações enviadas" }
  } catch (error) {
    console.error("Erro ao notificar atualização do wallet:", error)
    return { success: false, error: "Erro ao enviar notificações" }
  }
}

async function sendPushNotification(
  pushToken: string,
  serialNumber: string
): Promise<void> {
  // Nota: Para produção, você precisará configurar o certificado APNS
  // Por enquanto, apenas logamos a notificação
  console.log(`Enviando notificação push para ${pushToken} sobre ${serialNumber}`)
  
  // TODO: Implementar envio real via APNS quando tiver o certificado configurado
  // const apnsUrl = process.env.NODE_ENV === "production" 
  //   ? APNS_PRODUCTION_URL 
  //   : APNS_DEVELOPMENT_URL
  
  // const payload = JSON.stringify({
  //   aps: {
  //     "content-available": 1,
  //   },
  // })
  
  // Implementar requisição HTTPS para APNS aqui
}

