"use server"

import { db } from "../_lib/prisma"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface MonthlyStats {
  month: string
  monthNumber: number
  year: number
  bookings: number
  refunds: number
  cancellations: number
  completed: number
  grossValue: number
  netValue: number
  stripeFees: number
}

interface YearlyStats {
  year: number
  bookings: number
  refunds: number
  cancellations: number
  completed: number
  grossValue: number
  netValue: number
  stripeFees: number
}

export async function getAdminStats() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Calcular intervalo dos últimos 12 meses
  const startDate = new Date(currentYear - 1, currentMonth, 1)
  const endDate = endOfMonth(now)

  // Buscar todos os bookings e payments dos últimos 12 meses
  // Incluir também bookings que foram reagendados ou reembolsados (mesmo que criados antes do período)
  // para verificar se um booking cancelado foi realmente cancelado ou apenas reagendado
  const bookings = await db.booking.findMany({
    where: {
      OR: [
        {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          // Incluir bookings originais que foram reagendados no período
          rescheduledBookings: {
            some: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
        {
          // Incluir bookings que foram reembolsados no período (mesmo que criados antes)
          isRefunded: true,
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      ],
    },
    include: {
      payment: true,
      rescheduledBookings: {
        select: {
          id: true,
          createdAt: true,
        },
      },
    },
  })

  // Buscar todos os payments dos últimos 12 meses (incluindo de subscriptions)
  const allPayments = await db.payment.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  // Agrupar por mês
  const monthlyData: { [key: string]: MonthlyStats } = {}
  const months = eachMonthOfInterval({ start: startDate, end: endDate })

  // Primeiro, processar todos os bookings reembolsados para subtrair valores do mês correto
  const refundedBookings = bookings.filter((b) => b.isRefunded)

  months.forEach((month) => {
    const monthKey = format(month, "yyyy-MM")
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)

    const monthName = format(month, "MMMM", { locale: ptBR })
    monthlyData[monthKey] = {
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      monthNumber: month.getMonth() + 1,
      year: month.getFullYear(),
      bookings: 0,
      refunds: 0,
      cancellations: 0,
      completed: 0,
      grossValue: 0,
      netValue: 0,
      stripeFees: 0,
    }

    // Filtrar bookings criados no mês (excluindo os que foram reembolsados)
    // Se um booking foi reembolsado, não deve contar como agendamento
    const monthBookings = bookings.filter((b) => {
      const bookingDate = new Date(b.createdAt)
      const isInMonth = bookingDate >= monthStart && bookingDate <= monthEnd
      // Não incluir bookings reembolsados (mesmo que criados neste mês)
      return isInMonth && !b.isRefunded
    })

    // Filtrar bookings reembolsados no mês (mesmo que criados antes)
    const refundedInMonth = bookings.filter((b) => {
      if (!b.isRefunded) return false
      const updatedDate = new Date(b.updatedAt)
      return updatedDate >= monthStart && updatedDate <= monthEnd
    })

    // Contar por status
    monthBookings.forEach((booking) => {
      // Se o booking tem originalBookingId, significa que é um reagendamento
      // Não contar reagendamentos como novos agendamentos
      const isReschedule = !!booking.originalBookingId
      
      // Se o booking foi cancelado mas foi reagendado, não contar como cancelamento
      // (foi reagendado, não cancelado)
      const wasRescheduled = booking.rescheduledBookings && booking.rescheduledBookings.length > 0
      
      // Se o booking foi reembolsado, não contar como agendamento
      const isRefunded = booking.isRefunded
      
      // Contar apenas bookings originais (não reagendamentos) e não reembolsados como novos agendamentos
      if (!isReschedule && !isRefunded) {
        monthlyData[monthKey].bookings++
      }

      // Contar cancelamentos apenas se:
      // 1. O status é cancelled E
      // 2. Não foi reagendado (se foi reagendado, não é cancelamento, é reagendamento)
      if (booking.status === "cancelled" && !wasRescheduled) {
        monthlyData[monthKey].cancellations++
      } else if (booking.status === "confirmed" || booking.status === "completed") {
        // Verificar se foi concluído (data passou)
        const bookingDate = new Date(booking.date)
        if (bookingDate < now) {
          monthlyData[monthKey].completed++
        }
      }

      // Calcular valores
      // Para reagendamentos, não contar o valor novamente (já foi contado no booking original)
      // Não contar valores de bookings reembolsados (serão subtraídos depois)
      // Apenas contar valores de bookings originais ou bookings que têm payment próprio
      if (!isReschedule && !isRefunded && booking.payment && booking.payment.status === "paid") {
        const amount = Number(booking.payment.amount)
        monthlyData[monthKey].grossValue += amount

        // Calcular tarifa do Stripe (aproximadamente 3.99% + R$ 0.39 por transação)
        // Para valores maiores, a tarifa pode variar, mas vamos usar uma estimativa
        const stripeFee = amount * 0.0399 + 0.39
        monthlyData[monthKey].stripeFees += stripeFee
        monthlyData[monthKey].netValue += amount - stripeFee
      }
    })

    // Contar reembolsos no mês (mesmo que o booking tenha sido criado antes)
    refundedInMonth.forEach((booking) => {
      monthlyData[monthKey].refunds++
    })

    // Adicionar payments de subscriptions do mês (que não estão relacionados a bookings)
    const monthPayments = allPayments.filter((p) => {
      const paymentDate = new Date(p.createdAt)
      const isInMonth = paymentDate >= monthStart && paymentDate <= monthEnd
      // Verificar se o payment não está relacionado a um booking (para evitar duplicação)
      const hasBooking = bookings.some((b) => b.paymentId === p.id)
      return isInMonth && !hasBooking && p.status === "paid"
    })

    monthPayments.forEach((payment) => {
      const amount = Number(payment.amount)
      monthlyData[monthKey].grossValue += amount

      const stripeFee = amount * 0.0399 + 0.39
      monthlyData[monthKey].stripeFees += stripeFee
      monthlyData[monthKey].netValue += amount - stripeFee
    })
  })

  // Agora, subtrair valores dos bookings reembolsados do mês em que foram criados
  // IMPORTANTE: Só subtrair se o booking foi criado e reembolsado em meses diferentes
  // Se foi criado e reembolsado no mesmo mês, não foi adicionado (filtrado), então não precisa subtrair
  refundedBookings.forEach((booking) => {
    const bookingCreatedDate = new Date(booking.createdAt)
    const bookingRefundedDate = new Date(booking.updatedAt)
    const createdMonthKey = format(bookingCreatedDate, "yyyy-MM")
    const refundedMonthKey = format(bookingRefundedDate, "yyyy-MM")
    
    // Só subtrair se foi criado em um mês diferente do mês em que foi reembolsado
    // Se foi criado e reembolsado no mesmo mês, não foi adicionado, então não precisa subtrair
    if (createdMonthKey !== refundedMonthKey && monthlyData[createdMonthKey] && booking.payment && booking.payment.status === "paid") {
      const amount = Number(booking.payment.amount)
      monthlyData[createdMonthKey].grossValue -= amount

      // Subtrair tarifa do Stripe (aproximadamente 3.99% + R$ 0.39 por transação)
      const stripeFee = amount * 0.0399 + 0.39
      monthlyData[createdMonthKey].stripeFees -= stripeFee
      monthlyData[createdMonthKey].netValue -= (amount - stripeFee)
    }
  })

  // Agrupar por ano
  const yearlyData: { [key: number]: YearlyStats } = {}

  Object.values(monthlyData).forEach((monthData) => {
    if (!yearlyData[monthData.year]) {
      yearlyData[monthData.year] = {
        year: monthData.year,
        bookings: 0,
        refunds: 0,
        cancellations: 0,
        completed: 0,
        grossValue: 0,
        netValue: 0,
        stripeFees: 0,
      }
    }

    yearlyData[monthData.year].bookings += monthData.bookings
    yearlyData[monthData.year].refunds += monthData.refunds
    yearlyData[monthData.year].cancellations += monthData.cancellations
    yearlyData[monthData.year].completed += monthData.completed
    yearlyData[monthData.year].grossValue += monthData.grossValue
    yearlyData[monthData.year].netValue += monthData.netValue
    yearlyData[monthData.year].stripeFees += monthData.stripeFees
  })

  return {
    monthly: Object.values(monthlyData).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.monthNumber - b.monthNumber
    }),
    yearly: Object.values(yearlyData).sort((a, b) => a.year - b.year),
  }
}

