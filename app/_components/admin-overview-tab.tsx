"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getAdminStats } from "../_actions/get-admin-stats"
import { getAllBookings } from "../_actions/admin/get-all-bookings"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import { Calendar, DollarSign, TrendingUp, TrendingDown, XCircle, CheckCircle, RefreshCw, Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"

interface AdminOverviewTabProps {
  monthlyStats: any[]
  yearlyStats: any[]
  allBookings?: any[] // Bookings para calcular total (mesma fonte da aba Agendamentos)
}

const AdminOverviewTab = ({ monthlyStats: initialMonthlyStats, yearlyStats: initialYearlyStats, allBookings: initialAllBookings = [] }: AdminOverviewTabProps) => {
  const [viewMode, setViewMode] = useState<"month" | "year">("month")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [monthlyStats, setMonthlyStats] = useState(initialMonthlyStats)
  const [yearlyStats, setYearlyStats] = useState(initialYearlyStats)
  const [allBookings, setAllBookings] = useState(initialAllBookings)
  const [expandedChart, setExpandedChart] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  // Função para atualizar stats (memoizada para evitar recriações)
  const updateStats = useCallback(async (force = false) => {
    // Só verificar document.hidden se não for forçado (evento de booking-updated)
    if (!force && document.hidden) return

    try {
      // Buscar stats e bookings atualizados
      const [stats, bookings] = await Promise.all([
        getAdminStats(),
        getAllBookings(),
      ])
      setMonthlyStats(stats.monthly)
      setYearlyStats(stats.yearly)
      setAllBookings(bookings)
    } catch (error) {
      console.error("Erro ao buscar stats:", error)
    }
  }, [])

  // Atualizar apenas quando necessário (sem polling constante)
  useEffect(() => {
    // Verificar imediatamente quando o componente monta
    updateStats()

    // Verificar quando a página volta a ficar visível
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Atualizar quando a aba fica visível novamente
        updateStats()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [updateStats])

  // Observar quando a aba overview é ativada
  useEffect(() => {
    const handleTabActivated = () => {
      // Atualizar quando a aba overview é ativada
      updateStats()
    }

    window.addEventListener("overview-tab-activated", handleTabActivated)

    return () => {
      window.removeEventListener("overview-tab-activated", handleTabActivated)
    }
  }, [updateStats])

  // Observar quando um booking é criado, reembolsado ou reagendado
  useEffect(() => {
    const handleBookingUpdated = (event: any) => {
      // Atualizar stats quando um booking é criado, reembolsado ou reagendado
      // Forçar atualização mesmo se a aba não estiver visível
      // Adicionar um pequeno delay para garantir que o banco de dados foi atualizado
      setTimeout(() => {
        updateStats(true)
      }, 500) // 500ms de delay para garantir que o banco foi atualizado
    }

    window.addEventListener("booking-updated", handleBookingUpdated)

    return () => {
      window.removeEventListener("booking-updated", handleBookingUpdated)
    }
  }, [updateStats])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  // Formatar valores do eixo Y (Mil, Mi, Bi, Tri)
  const formatYAxisValue = (value: number) => {
    if (value >= 1000000000000) {
      return `${(value / 1000000000000).toFixed(1)}Tri`
    }
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}Bi`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}Mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}Mil`
    }
    return value.toString()
  }

  // Formatar valores monetários do eixo Y (Mil, Mi, Bi, Tri)
  const formatYAxisCurrency = (value: number) => {
    if (value >= 1000000000000) {
      return `${(value / 1000000000000).toFixed(1)}Tri`
    }
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}Bi`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}Mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}Mil`
    }
    return value.toString()
  }

  // Formatar mês/ano para o eixo X (01/25, 02/25, etc)
  const formatMonthYear = useCallback((month: string, year: number) => {
    const monthMap: { [key: string]: string } = {
      Janeiro: "01",
      Fevereiro: "02",
      Março: "03",
      Abril: "04",
      Maio: "05",
      Junho: "06",
      Julho: "07",
      Agosto: "08",
      Setembro: "09",
      Outubro: "10",
      Novembro: "11",
      Dezembro: "12",
    }
    const monthNumber = monthMap[month] || month.padStart(2, "0")
    const yearShort = year.toString().slice(-2)
    return `${monthNumber}/${yearShort}`
  }, [])

  // Obter anos únicos que têm dados (com bookings > 0 ou valores > 0)
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    monthlyStats.forEach((stat) => {
      if (stat.bookings > 0 || stat.grossValue > 0) {
        years.add(stat.year)
      }
    })
    yearlyStats.forEach((stat) => {
      if (stat.bookings > 0 || stat.grossValue > 0) {
        years.add(stat.year)
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [monthlyStats, yearlyStats])

  const availableMonths = useMemo(() => {
    if (selectedYear === "all") return []
    const monthsMap = new Map<string, { value: string; label: string; monthNumber: number }>()
    monthlyStats
      .filter((stat) => {
        const yearMatch = stat.year === parseInt(selectedYear)
        const hasData = stat.bookings > 0 || stat.grossValue > 0
        return yearMatch && hasData
      })
      .forEach((stat) => {
        const key = `${stat.year}-${stat.monthNumber}`
        if (!monthsMap.has(key)) {
          monthsMap.set(key, {
            value: key,
            label: stat.month,
            monthNumber: stat.monthNumber,
          })
        }
      })
    // Ordenar de Janeiro (1) a Dezembro (12)
    return Array.from(monthsMap.values()).sort((a, b) => a.monthNumber - b.monthNumber)
  }, [monthlyStats, selectedYear])

  // Filtrar dados baseado na seleção (apenas com dados reais)
  const filteredData = useMemo(() => {
    if (viewMode === "year") {
      let filtered = yearlyStats.filter((stat) => stat.bookings > 0 || stat.grossValue > 0)
      if (selectedYear !== "all") {
        filtered = filtered.filter((stat) => stat.year === parseInt(selectedYear))
      }
      return filtered
    } else {
      // Modo mensal - apenas meses com dados
      let filtered = monthlyStats.filter((stat) => stat.bookings > 0 || stat.grossValue > 0)
      if (selectedYear !== "all") {
        filtered = filtered.filter((stat) => stat.year === parseInt(selectedYear))
      }
      if (selectedMonth !== "all") {
        const [year, month] = selectedMonth.split("-").map(Number)
        filtered = filtered.filter((stat) => stat.year === year && stat.monthNumber === month)
      }
      // Ordenar por ano e mês (Janeiro a Dezembro)
      return filtered.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.monthNumber - b.monthNumber
      })
    }
  }, [viewMode, selectedYear, selectedMonth, monthlyStats, yearlyStats])

  // Calcular dados do gráfico baseado em allBookings (mesma fonte da aba Agendamentos)
  const bookingsChartData = useMemo(() => {
    if (allBookings.length === 0) return []

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const startDate = new Date(currentYear - 1, currentMonth, 1)
    const endDate = endOfMonth(now)

    const months = eachMonthOfInterval({ start: startDate, end: endDate })
    const dataMap = new Map<string, { bookings: number; cancellations: number; refunds: number; completed: number; month: string; monthNumber: number; year: number }>()

    // Inicializar todos os meses com zeros
    months.forEach((month) => {
      const monthKey = format(month, "yyyy-MM")
      const monthName = format(month, "MMMM", { locale: ptBR })
      const monthNumber = month.getMonth() + 1
      const year = month.getFullYear()
      dataMap.set(monthKey, {
        bookings: 0,
        cancellations: 0,
        refunds: 0,
        completed: 0,
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        monthNumber,
        year,
      })
    })

    // Processar cada booking
    allBookings.forEach((booking) => {
      const bookingDate = new Date(booking.createdAt)
      const monthKey = format(bookingDate, "yyyy-MM")
      
      if (!dataMap.has(monthKey)) return

      const data = dataMap.get(monthKey)!
      const hasOriginalBookingId = !!(booking as any).originalBookingId
      const wasRescheduled = booking.rescheduledBookings && booking.rescheduledBookings.length > 0

      // Agendamentos confirmados (incluindo reagendamentos ativos)
      // Mesma lógica da aba "Agendamentos": status === "confirmed" && !isRefunded
      if (booking.status === "confirmed" && !booking.isRefunded) {
        data.bookings++
      }

      // Reagendamentos (cancelados que não foram reembolsados e não têm originalBookingId)
      // Mesma lógica da aba "Agendamentos" e do card final
      if (booking.status === "cancelled" && !booking.isRefunded && !hasOriginalBookingId) {
        data.cancellations++
      }

      // Reembolsos
      if (booking.isRefunded) {
        // Contar no mês em que foi reembolsado (updatedAt)
        const refundDate = new Date(booking.updatedAt)
        const refundMonthKey = format(refundDate, "yyyy-MM")
        if (dataMap.has(refundMonthKey)) {
          dataMap.get(refundMonthKey)!.refunds++
        }
      }

      // Concluídos
      if (booking.status === "completed") {
        data.completed++
      }
    })

    // Converter para array, filtrar apenas meses com dados e ordenar
    return Array.from(dataMap.values())
      .filter((item) => item.bookings > 0 || item.refunds > 0 || item.cancellations > 0 || item.completed > 0)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.monthNumber - b.monthNumber
      })
      .map((item) => ({
        ...item,
        monthYearLabel: formatMonthYear(item.month, item.year),
      }))
  }, [allBookings, formatMonthYear])

  // Preparar dados para o gráfico de quantidades (Agendamentos, Reagendamentos, Reembolsos)
  const quantitiesChartData = useMemo(() => {
    if (viewMode === "month") {
      // Filtrar bookingsChartData baseado nos filtros
      let filtered = bookingsChartData
      if (selectedYear !== "all") {
        filtered = filtered.filter((item) => item.year === parseInt(selectedYear))
      }
      if (selectedMonth !== "all") {
        const [year, month] = selectedMonth.split("-").map(Number)
        filtered = filtered.filter((item) => item.year === year && item.monthNumber === month)
      }
      return filtered
    } else {
      // Modo anual - agrupar por ano
      const yearlyMap = new Map<number, { bookings: number; cancellations: number; refunds: number; completed: number; year: number }>()
      
      bookingsChartData.forEach((item) => {
        if (!yearlyMap.has(item.year)) {
          yearlyMap.set(item.year, { bookings: 0, cancellations: 0, refunds: 0, completed: 0, year: item.year })
        }
        const yearly = yearlyMap.get(item.year)!
        yearly.bookings += item.bookings
        yearly.cancellations += item.cancellations
        yearly.refunds += item.refunds
        yearly.completed += item.completed
      })

      let filtered = Array.from(yearlyMap.values())
        .filter((item) => item.bookings > 0 || item.refunds > 0 || item.cancellations > 0 || item.completed > 0)
        .sort((a, b) => a.year - b.year)
      if (selectedYear !== "all") {
        filtered = filtered.filter((item) => item.year === parseInt(selectedYear))
      }
      return filtered.map((item) => ({
        ...item,
        monthYearLabel: item.year.toString(),
      }))
    }
  }, [bookingsChartData, viewMode, selectedYear, selectedMonth])

  // Calcular dados financeiros baseado em allBookings (mesma fonte da aba Agendamentos)
  // Garantindo que bookings reagendados não sejam contabilizados duas vezes
  const financialChartData = useMemo(() => {
    if (allBookings.length === 0) return []

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const startDate = new Date(currentYear - 1, currentMonth, 1)
    const endDate = endOfMonth(now)

    const months = eachMonthOfInterval({ start: startDate, end: endDate })
    const dataMap = new Map<string, { grossValue: number; stripeFees: number; netValue: number; month: string; monthNumber: number; year: number }>()

    // Inicializar todos os meses com zeros
    months.forEach((month) => {
      const monthKey = format(month, "yyyy-MM")
      const monthName = format(month, "MMMM", { locale: ptBR })
      const monthNumber = month.getMonth() + 1
      const year = month.getFullYear()
      dataMap.set(monthKey, {
        grossValue: 0,
        stripeFees: 0,
        netValue: 0,
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        monthNumber,
        year,
      })
    })

    // Processar cada booking
    allBookings.forEach((booking) => {
      const bookingDate = new Date(booking.createdAt)
      const monthKey = format(bookingDate, "yyyy-MM")
      
      if (!dataMap.has(monthKey)) return

      const hasOriginalBookingId = !!(booking as any).originalBookingId
      const wasRescheduled = booking.rescheduledBookings && booking.rescheduledBookings.length > 0
      const isRefunded = booking.isRefunded

      // Valores financeiros: 
      // - Se é um reagendamento ativo (tem originalBookingId), buscar valor do booking original
      // - Se não é reagendamento, usar valor próprio
      // - Não contar valores de bookings que foram reagendados (wasRescheduled) - foram cancelados
      if (booking.status === "confirmed" && !isRefunded && !wasRescheduled) {
        let amount = 0
        let payment = booking.payment

        // Se é um reagendamento ativo, buscar valor do booking original
        if (hasOriginalBookingId && booking.originalBooking?.payment) {
          payment = booking.originalBooking.payment
        }

        // Se tem pagamento pago, contabilizar
        if (payment && payment.status === "paid") {
          amount = Number(payment.amount)
          
          // Determinar o mês correto para contabilizar
          // Se é reagendamento, usar o mês do booking original
          let valueMonthKey = monthKey
          if (hasOriginalBookingId && booking.originalBooking) {
            const originalDate = new Date(booking.originalBooking.createdAt)
            valueMonthKey = format(originalDate, "yyyy-MM")
          }

          if (dataMap.has(valueMonthKey)) {
            const data = dataMap.get(valueMonthKey)!
            data.grossValue += amount

            // Calcular tarifa do Stripe (aproximadamente 3.99% + R$ 0.39 por transação)
            const stripeFee = amount * 0.0399 + 0.39
            data.stripeFees += stripeFee
            data.netValue += amount - stripeFee
          }
        }
      }

      // Reembolsos: contar valores no mês em que foram reembolsados
      // (subtrair do mês de criação se foi reembolsado depois)
      if (isRefunded && booking.payment && booking.payment.status === "paid") {
        const refundDate = new Date(booking.updatedAt)
        const refundMonthKey = format(refundDate, "yyyy-MM")
        const createdMonthKey = format(bookingDate, "yyyy-MM")
        
        // Se foi reembolsado depois do mês de criação, subtrair do mês de criação
        if (refundMonthKey > createdMonthKey && dataMap.has(createdMonthKey)) {
          const data = dataMap.get(createdMonthKey)!
          const amount = Number(booking.payment.amount)
          data.grossValue -= amount
          const stripeFee = amount * 0.0399 + 0.39
          data.stripeFees -= stripeFee
          data.netValue -= (amount - stripeFee)
        }
      }
    })

    // Converter para array, filtrar apenas meses com dados e ordenar
    return Array.from(dataMap.values())
      .filter((item) => item.grossValue > 0 || item.netValue > 0 || item.stripeFees > 0)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.monthNumber - b.monthNumber
      })
      .map((item) => ({
        ...item,
        monthYearLabel: formatMonthYear(item.month, item.year),
        // Adicionar campos necessários para compatibilidade
        bookings: 0,
        refunds: 0,
        cancellations: 0,
        completed: 0,
      }))
  }, [allBookings, formatMonthYear])

  // Preparar dados para os gráficos financeiros
  const chartData = useMemo(() => {
    if (viewMode === "month") {
      // Filtrar financialChartData baseado nos filtros
      let filtered = financialChartData
      if (selectedYear !== "all") {
        filtered = filtered.filter((item) => item.year === parseInt(selectedYear))
      }
      if (selectedMonth !== "all") {
        const [year, month] = selectedMonth.split("-").map(Number)
        filtered = filtered.filter((item) => item.year === year && item.monthNumber === month)
      }
      return filtered
    } else {
      // Modo anual - agrupar por ano
      const yearlyMap = new Map<number, { grossValue: number; stripeFees: number; netValue: number; year: number }>()
      
      financialChartData.forEach((item) => {
        if (!yearlyMap.has(item.year)) {
          yearlyMap.set(item.year, { grossValue: 0, stripeFees: 0, netValue: 0, year: item.year })
        }
        const yearly = yearlyMap.get(item.year)!
        yearly.grossValue += item.grossValue
        yearly.stripeFees += item.stripeFees
        yearly.netValue += item.netValue
      })

      let filtered = Array.from(yearlyMap.values())
        .filter((item) => item.grossValue > 0 || item.netValue > 0 || item.stripeFees > 0)
        .sort((a, b) => a.year - b.year)
      if (selectedYear !== "all") {
        filtered = filtered.filter((item) => item.year === parseInt(selectedYear))
      }
      return filtered.map((item) => ({
        ...item,
        monthYearLabel: item.year.toString(),
        // Adicionar campos necessários para compatibilidade
        month: "",
        monthNumber: 0,
        bookings: 0,
        refunds: 0,
        cancellations: 0,
        completed: 0,
      }))
    }
  }, [financialChartData, viewMode, selectedYear, selectedMonth])

  // Usar quantitiesChartData para o gráfico de quantidades, chartData para valores financeiros
  const quantitiesData = quantitiesChartData
  const financialData = chartData
  const xAxisKey = "monthYearLabel"
  const xAxisLabel = viewMode === "month" ? "Mês" : "Ano"

  // Calcular totais de agendamentos usando a mesma lógica da aba "Agendamentos"
  // (status === "confirmed" && !isRefunded)
  const totalConfirmedBookings = useMemo(() => {
    return allBookings.filter((booking) => {
      return booking.status === "confirmed" && !booking.isRefunded
    }).length
  }, [allBookings])

  const totalRefundedBookings = useMemo(() => {
    return allBookings.filter((booking) => booking.isRefunded).length
  }, [allBookings])

  const totalRescheduledBookings = useMemo(() => {
    return allBookings.filter((booking) => {
      const hasOriginalBookingId = !!(booking as any).originalBookingId
      return booking.status === "cancelled" && !booking.isRefunded && !hasOriginalBookingId
    }).length
  }, [allBookings])

  const totalCompletedBookings = useMemo(() => {
    return allBookings.filter((booking) => booking.status === "completed").length
  }, [allBookings])

  // Calcular totais dos gráficos (para valores financeiros e outros dados)
  const totals = financialData.reduce(
    (acc, item) => ({
      bookings: acc.bookings + item.bookings,
      refunds: acc.refunds + item.refunds,
      cancellations: acc.cancellations + item.cancellations,
      completed: acc.completed + item.completed,
      grossValue: acc.grossValue + item.grossValue,
      netValue: acc.netValue + item.netValue,
      stripeFees: acc.stripeFees + item.stripeFees,
    }),
    {
      bookings: 0,
      refunds: 0,
      cancellations: 0,
      completed: 0,
      grossValue: 0,
      netValue: 0,
      stripeFees: 0,
    }
  )

  // Usar os totais reais dos bookings em vez dos totais dos gráficos
  const finalTotals = {
    bookings: totalConfirmedBookings,
    refunds: totalRefundedBookings,
    cancellations: totalRescheduledBookings,
    completed: totalCompletedBookings,
    grossValue: totals.grossValue,
    netValue: totals.netValue,
    stripeFees: totals.stripeFees,
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={viewMode} onValueChange={(v) => {
          setViewMode(v as "month" | "year")
          setSelectedMonth("all")
          setSelectedYear("all")
        }}>
          <TabsList>
            <TabsTrigger value="month">Mensal</TabsTrigger>
            <TabsTrigger value="year">Anual</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={(value) => {
            setSelectedYear(value)
            if (viewMode === "month") {
              setSelectedMonth("all")
            }
          }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {viewMode === "month" && (
            <Select
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              disabled={selectedYear === "all"}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalTotals.bookings}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.grossValue)}</div>
            <p className="text-xs text-muted-foreground">Receita total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarifas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.stripeFees)}</div>
            <p className="text-xs text-muted-foreground">Taxas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.netValue)}</div>
            <p className="text-xs text-muted-foreground">Após tarifas</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Quantidades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Agendamentos, Reagendamentos e Reembolsos</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpandedChart("quantities")}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quantitiesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis tickFormatter={formatYAxisValue} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null
                  
                  const labels: Record<string, string> = {
                    bookings: "Agendamentos",
                    cancellations: "Reagendamentos",
                    refunds: "Reembolsos",
                    completed: "Efetivados",
                  }
                  
                  const colors: Record<string, string> = {
                    bookings: "#EE8530",
                    cancellations: "#fbbf24",
                    refunds: "#ef4444",
                    completed: "#10b981",
                  }
                  
                  return (
                    <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: colors[entry.dataKey] || "#ffffff" }}>
                          {labels[entry.dataKey] || entry.dataKey}: {entry.value}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend />
              <Bar dataKey="bookings" fill="#EE8530" name="Agendamentos" />
              <Bar dataKey="cancellations" fill="#fbbf24" name="Reagendamentos" />
              <Bar dataKey="refunds" fill="#ef4444" name="Reembolsos" />
              <Bar dataKey="completed" fill="#10b981" name="Efetivados" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Dialog para gráfico expandido - Quantidades */}
      <Dialog open={expandedChart === "quantities"} onOpenChange={(open) => !open && setExpandedChart(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Agendamentos, Reagendamentos e Reembolsos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quantitiesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis tickFormatter={formatYAxisValue} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    
                    const labels: Record<string, string> = {
                      bookings: "Agendamentos",
                      cancellations: "Reagendamentos",
                      refunds: "Reembolsos",
                      completed: "Efetivados",
                    }
                    
                    const colors: Record<string, string> = {
                      bookings: "#EE8530",
                      cancellations: "#fbbf24",
                      refunds: "#ef4444",
                      completed: "#10b981",
                    }
                    
                    return (
                      <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                        {payload.map((entry: any, index: number) => (
                          <p key={index} className="text-sm" style={{ color: colors[entry.dataKey] || "#ffffff" }}>
                            {labels[entry.dataKey] || entry.dataKey}: {entry.value}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Bar dataKey="bookings" fill="#EE8530" name="Agendamentos" />
                <Bar dataKey="cancellations" fill="#fbbf24" name="Reagendamentos" />
                <Bar dataKey="refunds" fill="#ef4444" name="Reembolsos" />
                <Bar dataKey="completed" fill="#10b981" name="Efetivados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gráfico de Valores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Valores Financeiros</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpandedChart("financial")}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={financialData}>
              <defs>
                <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EE8530" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#EE8530" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis tickFormatter={(value) => `R$ ${formatYAxisCurrency(value)}`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null
                  
                  // Ordem específica: Valor Bruto, Tarifas, Valor Líquido
                  const order = ["grossValue", "stripeFees", "netValue"]
                  const labels: Record<string, string> = {
                    grossValue: "Valor Bruto",
                    stripeFees: "Tarifas",
                    netValue: "Valor Líquido",
                  }
                  
                  const colors: Record<string, string> = {
                    grossValue: "#EE8530",
                    stripeFees: "#ef4444",
                    netValue: "#10b981",
                  }
                  
                  // Ordenar payload pela ordem especificada
                  const sortedPayload = [...payload].sort((a: any, b: any) => {
                    const indexA = order.indexOf(a.dataKey)
                    const indexB = order.indexOf(b.dataKey)
                    return indexA - indexB
                  })
                  
                  return (
                    <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                      {sortedPayload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: colors[entry.dataKey] || "#ffffff" }}>
                          {labels[entry.dataKey] || entry.dataKey}: {formatCurrency(entry.value)}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="grossValue"
                stroke="#EE8530"
                fillOpacity={1}
                fill="url(#colorGross)"
                name="Valor Bruto"
              />
              <Area
                type="monotone"
                dataKey="stripeFees"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorFees)"
                name="Tarifas"
              />
              <Area
                type="monotone"
                dataKey="netValue"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorNet)"
                name="Valor Líquido"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Dialog para gráfico expandido - Valores Financeiros */}
      <Dialog open={expandedChart === "financial"} onOpenChange={(open) => !open && setExpandedChart(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Valores Financeiros</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <defs>
                  <linearGradient id="colorGrossExpanded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EE8530" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#EE8530" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNetExpanded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFeesExpanded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis tickFormatter={(value) => `R$ ${formatYAxisCurrency(value)}`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    
                    const order = ["grossValue", "stripeFees", "netValue"]
                    const labels: Record<string, string> = {
                      grossValue: "Valor Bruto",
                      stripeFees: "Tarifas",
                      netValue: "Valor Líquido",
                    }
                    
                    const colors: Record<string, string> = {
                      grossValue: "#EE8530",
                      stripeFees: "#ef4444",
                      netValue: "#10b981",
                    }
                    
                    const sortedPayload = [...payload].sort((a: any, b: any) => {
                      const indexA = order.indexOf(a.dataKey)
                      const indexB = order.indexOf(b.dataKey)
                      return indexA - indexB
                    })
                    
                    return (
                      <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                        {sortedPayload.map((entry: any, index: number) => (
                          <p key={index} className="text-sm" style={{ color: colors[entry.dataKey] || "#ffffff" }}>
                            {labels[entry.dataKey] || entry.dataKey}: {formatCurrency(entry.value)}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="grossValue"
                  stroke="#EE8530"
                  fillOpacity={1}
                  fill="url(#colorGrossExpanded)"
                  name="Valor Bruto"
                />
                <Area
                  type="monotone"
                  dataKey="stripeFees"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorFeesExpanded)"
                  name="Tarifas"
                />
                <Area
                  type="monotone"
                  dataKey="netValue"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorNetExpanded)"
                  name="Valor Líquido"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gráfico de Tendência de Agendamentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Tendência de Agendamentos</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpandedChart("trend")}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quantitiesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis tickFormatter={formatYAxisValue} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null
                  
                  return (
                    <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                      <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: "#EE8530" }}>
                          Agendamentos: {entry.value}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="bookings"
                stroke="#EE8530"
                strokeWidth={3}
                dot={{ fill: "#EE8530", r: 5 }}
                activeDot={{ r: 7 }}
                name="Agendamentos"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Dialog para gráfico expandido - Tendência */}
      <Dialog open={expandedChart === "trend"} onOpenChange={(open) => !open && setExpandedChart(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tendência de Agendamentos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quantitiesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis tickFormatter={formatYAxisValue} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    
                    return (
                      <div className="bg-[#1A1B1F] border border-gray-800 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2 text-white">{xAxisLabel}: {label}</p>
                        {payload.map((entry: any, index: number) => (
                          <p key={index} className="text-sm" style={{ color: "#EE8530" }}>
                            Agendamentos: {entry.value}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#EE8530"
                  strokeWidth={3}
                  dot={{ fill: "#EE8530", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Agendamentos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cards de Estatísticas Detalhadas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efetivados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{finalTotals.completed}</div>
                  <p className="text-xs text-muted-foreground">
                    {finalTotals.bookings > 0
                      ? `${((finalTotals.completed / finalTotals.bookings) * 100).toFixed(1)}% do total`
                      : "0% do total"}
                  </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reagendamentos</CardTitle>
            <XCircle className="h-4 w-4" style={{ color: "#EE8530" }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: "#EE8530" }}>{finalTotals.cancellations}</div>
                  <p className="text-xs text-muted-foreground">
                    {finalTotals.bookings > 0
                      ? `${((finalTotals.cancellations / finalTotals.bookings) * 100).toFixed(1)}% do total`
                      : "0% do total"}
                  </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reembolsos</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{finalTotals.refunds}</div>
                  <p className="text-xs text-muted-foreground">
                    {finalTotals.bookings > 0
                      ? `${((finalTotals.refunds / finalTotals.bookings) * 100).toFixed(1)}% do total`
                      : "0% do total"}
                  </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminOverviewTab

