"use server"

import { revalidatePath } from "next/cache"
import { db } from "../_lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../_lib/auth"
import { isSlotAvailable } from "../_lib/check-slot-availability"

interface CreateBookingFromSubscriptionParams {
  serviceId: string
  date: Date
  professionalId: string
  subscriptionId: string
}

export const createBookingFromSubscription = async (
  params: CreateBookingFromSubscriptionParams
) => {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Usuário não autenticado" }
    }

    // Verificar se a assinatura está ativa
    const subscription = await db.subscription.findUnique({
      where: { id: params.subscriptionId },
      include: {
        client: true,
        service: true,
      },
    })

    if (!subscription) {
      return { success: false, error: "Assinatura não encontrada" }
    }

    // Verificar se a assinatura está ativa e válida
    // Uma assinatura é válida se: status === "active" E currentPeriodEnd >= now
    // Mesmo que cancelAtPeriodEnd === true, ainda é válida até o final do período
    const now = new Date()
    if (
      subscription.status !== "active" ||
      subscription.currentPeriodEnd < now
      // Removido verificação de cancelAtPeriodEnd - mesmo marcada para cancelar, ainda é válida até o final do período
    ) {
      return { success: false, error: "Assinatura não está ativa ou válida" }
    }

    // Verificar se o serviço corresponde à assinatura
    if (subscription.serviceId !== params.serviceId) {
      return { success: false, error: "Serviço não corresponde à assinatura" }
    }

    // Verificar se o slot está disponível
    const slotAvailable = await isSlotAvailable({
      professionalId: params.professionalId,
      startDate: params.date,
      serviceDuration: subscription.service.duration,
    })

    if (!slotAvailable) {
      return {
        success: false,
        error: "Este horário já está ocupado. Por favor, escolha outro horário.",
      }
    }

    // Buscar userId do cliente
    const userEmail = (session.user as any).email
    const user = await db.user.findUnique({
      where: { email: userEmail },
    })

    if (!user) {
      return { success: false, error: "Usuário não encontrado" }
    }

    // Criar booking sem pagamento (já está coberto pela assinatura)
    const booking = await db.booking.create({
      data: {
        serviceId: params.serviceId,
        date: params.date,
        professionalId: params.professionalId,
        clientId: subscription.clientId,
        userId: user.id,
        status: "confirmed",
        // Não criar payment, pois já está coberto pela assinatura
      },
    })
    
    // Gerar wallet pass automaticamente (não bloquear se falhar)
    try {
      const { generateWalletPassForBooking } = await import("./generate-wallet-pass-for-booking")
      await generateWalletPassForBooking(booking.id)
    } catch (error) {
      console.error("Erro ao gerar wallet pass automaticamente:", error)
      // Não bloquear criação do booking se falhar
    }

    revalidatePath("/barbershops/[id]")
    revalidatePath("/bookings")
    revalidatePath("/")
    revalidatePath("/admin")

    return { success: true }
  } catch (error: any) {
    console.error("Erro ao criar booking de assinatura:", error)
    return { success: false, error: error.message || "Erro ao criar agendamento" }
  }
}

