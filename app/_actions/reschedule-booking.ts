"use server"

import { db } from "../_lib/prisma"
import { revalidatePath } from "next/cache"
import { isSlotAvailable } from "../_lib/check-slot-availability"

interface RescheduleBookingParams {
  bookingId: string
  newDate: Date
  isAdmin?: boolean // Se true, ignora o limite de reagendamentos
}

export async function rescheduleBooking({
  bookingId,
  newDate,
  isAdmin = false,
}: RescheduleBookingParams) {
  try {
    // Buscar o agendamento original
    const originalBooking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
      },
    })

    if (!originalBooking) {
      return { success: false, error: "Agendamento não encontrado" }
    }

    if (originalBooking.isRefunded) {
      return {
        success: false,
        error: "Não é possível reagendar um agendamento reembolsado",
      }
    }

    // Verificar limite de reagendamentos (apenas para clientes)
    if (!isAdmin) {
      // Buscar o booking original (se este for um reagendamento)
      const rootBooking = originalBooking.originalBookingId
        ? await db.booking.findUnique({
            where: { id: originalBooking.originalBookingId },
            include: { service: true },
          })
        : originalBooking

      const maxReschedules = rootBooking?.service.maxReschedules ?? 1
      const currentRescheduleCount = rootBooking?.rescheduleCount ?? 0

      if (currentRescheduleCount >= maxReschedules) {
        return {
          success: false,
          error: `Você já atingiu o limite de ${maxReschedules} reagendamento(s) para este serviço.`,
        }
      }
    }

    // Verificar se a nova data não está no passado
    if (newDate < new Date()) {
      return {
        success: false,
        error: "Não é possível reagendar para uma data no passado",
      }
    }

    const rootBookingId = originalBooking.originalBookingId || originalBooking.id

    // Buscar todos os bookings relacionados (reagendamentos do mesmo booking original)
    const relatedBookings = await db.booking.findMany({
      where: {
        OR: [
          { id: rootBookingId },
          { originalBookingId: rootBookingId },
        ],
      },
      select: { id: true },
    })
    const relatedBookingIds = relatedBookings.map((b) => b.id)

    const slotAvailable = await isSlotAvailable({
      professionalId: originalBooking.professionalId,
      startDate: newDate,
      serviceDuration: originalBooking.service.duration,
      excludeBookingIds: relatedBookingIds,
    })

    if (!slotAvailable) {
      return {
        success: false,
        error: "Este horário já está ocupado. Por favor, escolha outro horário.",
      }
    }

    // Criar novo agendamento
    // Não copiar paymentId pois ele é único - o pagamento permanece vinculado ao booking original
    const newBooking = await db.booking.create({
      data: {
        userId: originalBooking.userId,
        clientId: originalBooking.clientId,
        serviceId: originalBooking.serviceId,
        professionalId: originalBooking.professionalId,
        // paymentId não é copiado pois é único - o pagamento permanece no booking original
        date: newDate,
        status: originalBooking.status,
        originalBookingId: rootBookingId,
        rescheduleCount: originalBooking.rescheduleCount + 1,
      },
    })

    // Atualizar contador no booking original
    await db.booking.update({
      where: { id: rootBookingId },
      data: {
        rescheduleCount: {
          increment: 1,
        },
      },
    })

    // Cancelar o agendamento antigo
    await db.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
      },
    })

    // Notificar atualização do wallet pass
    try {
      const { notifyWalletUpdate } = await import("./notify-wallet-update")
      await notifyWalletUpdate(newBooking.id)
    } catch (error) {
      console.error("Erro ao notificar wallet:", error)
      // Não falhar o reagendamento se a notificação falhar
    }

    revalidatePath("/bookings")
    revalidatePath("/admin")
    revalidatePath("/")

    return {
      success: true,
      booking: newBooking,
      message: "Agendamento reagendado com sucesso",
    }
  } catch (error) {
    console.error("Erro ao reagendar:", error)
    return {
      success: false,
      error: "Erro ao reagendar agendamento. Tente novamente mais tarde.",
    }
  }
}

