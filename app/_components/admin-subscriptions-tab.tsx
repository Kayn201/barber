"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { format, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect, useMemo } from "react"
import { getAllSubscriptions } from "../_actions/admin/get-all-subscriptions"
import { checkNewSubscriptions } from "../_actions/admin/check-new-subscriptions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { cancelSubscription } from "../_actions/cancel-subscription"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface AdminSubscriptionsTabProps {
  subscriptions: any[]
}

const AdminSubscriptionsTab = ({ subscriptions: initialSubscriptions }: AdminSubscriptionsTabProps) => {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
  const [lastSubscriptionId, setLastSubscriptionId] = useState<string | undefined>(
    initialSubscriptions[0]?.id
  )
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [cancelImmediately, setCancelImmediately] = useState<boolean | undefined>(undefined)
  const [isCanceling, setIsCanceling] = useState(false)
  const [filter, setFilter] = useState<"all" | "active" | "canceled">("all")
  const router = useRouter()

  // Filtrar assinaturas
  const filteredSubscriptions = useMemo(() => {
    if (filter === "all") return subscriptions
    if (filter === "active") {
      return subscriptions.filter(
        (sub) => sub.status === "active" && !sub.cancelAtPeriodEnd
      )
    }
    if (filter === "canceled") {
      return subscriptions.filter(
        (sub) => sub.status === "canceled" || sub.cancelAtPeriodEnd
      )
    }
    return subscriptions
  }, [subscriptions, filter])

  // Calcular dias restantes
  const getDaysRemaining = (currentPeriodEnd: Date) => {
    const now = new Date()
    const endDate = new Date(currentPeriodEnd)
    const days = differenceInDays(endDate, now)
    return days >= 0 ? days : 0
  }

  // Polling inteligente: só busca todas as subscriptions se detectar novas
  useEffect(() => {
    const checkAndUpdate = async () => {
      // Só verifica se a página estiver visível
      if (document.hidden) return

      try {
        // Verifica se há novas subscriptions (query leve - só verifica timestamps)
        const checkResult = await checkNewSubscriptions(lastSubscriptionId)
        
        // Se há novas subscriptions, busca a lista completa
        if (checkResult.hasNew) {
          const updatedSubscriptions = await getAllSubscriptions()
          setSubscriptions(updatedSubscriptions)
          // Atualiza o ID da última subscription conhecida
          if (updatedSubscriptions[0]?.id) {
            setLastSubscriptionId(updatedSubscriptions[0].id)
          }
        }
      } catch (error) {
        console.error("Erro ao verificar novas subscriptions:", error)
      }
    }

    // Verificar quando a página volta a ficar visível
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndUpdate()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Polling a cada 10 segundos - só verifica se há novas (query leve)
    const interval = setInterval(checkAndUpdate, 10000)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [lastSubscriptionId])
  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean, currentPeriodEnd: Date) => {
    const now = new Date()
    const endDate = new Date(currentPeriodEnd)
    const isExpired = endDate < now

    // Se já passou a data e está cancelada ou marcada para cancelar, mostrar como cancelado
    if (isExpired && (status === "canceled" || cancelAtPeriodEnd)) {
      return (
        <Badge variant="secondary" className="text-xs">
          Cancelado
        </Badge>
      )
    }

    // Se está marcada para cancelar mas ainda não passou a data
    if (cancelAtPeriodEnd && !isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          Cancela na data {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
        </Badge>
      )
    }
    
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      canceled: "destructive",
      past_due: "destructive",
      unpaid: "destructive",
    }
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status === "active" ? "Ativa" : status === "canceled" ? "Cancelada" : "Vencida"}
      </Badge>
    )
  }

  const activeCount = subscriptions.filter(
    (sub) => sub.status === "active" && !sub.cancelAtPeriodEnd
  ).length
  const canceledCount = subscriptions.filter(
    (sub) => sub.status === "canceled" || sub.cancelAtPeriodEnd
  ).length

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Assinaturas</h2>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "active" | "canceled")} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todas ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="active">Ativas ({activeCount})</TabsTrigger>
          <TabsTrigger value="canceled">Canceladas ({canceledCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {filteredSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                {filter === "active"
                  ? "Nenhuma assinatura ativa encontrada"
                  : filter === "canceled"
                  ? "Nenhuma assinatura cancelada encontrada"
                  : "Nenhuma assinatura encontrada"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSubscriptions.map((subscription) => {
                const daysRemaining = subscription.status === "active" && !subscription.cancelAtPeriodEnd
                  ? getDaysRemaining(subscription.currentPeriodEnd)
                  : null

                return (
                  <Card key={subscription.id}>
                    <CardHeader>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Assinatura</p>
                            <CardTitle className="text-base md:text-lg">{subscription.service.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(subscription.status, subscription.cancelAtPeriodEnd, subscription.currentPeriodEnd)}
                            {daysRemaining !== null && subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                              <Badge variant="outline" className="text-xs">
                                {daysRemaining === 0
                                  ? "Renova hoje"
                                  : daysRemaining === 1
                                  ? "1 dia para renovação"
                                  : `${daysRemaining} dias para renovação`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">
                          <span className="font-semibold text-gray-600 dark:text-gray-300">Cliente:</span> {subscription.client.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(() => {
                          const now = new Date()
                          const endDate = new Date(subscription.currentPeriodEnd)
                          const isExpired = endDate < now

                          if (subscription.cancelAtPeriodEnd && !isExpired) {
                            return (
                              <p className="text-sm text-red-500 dark:text-red-400">
                                Esta assinatura será cancelada ao final do período atual. O cliente continuará tendo acesso até{" "}
                                {format(endDate, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                                .
                              </p>
                            )
                          }
                          return null
                        })()}
                        
                        {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedSubscription(subscription)
                              setCancelImmediately(undefined) // Reset para mostrar opções no diálogo
                              setCancelDialogOpen(true)
                            }}
                            className="text-xs h-9 w-full sm:w-auto"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="w-[90%]">
          <DialogHeader>
            <DialogTitle className="text-sm">Cancelar Assinatura</DialogTitle>
            <DialogDescription className="text-xs">
              Como deseja cancelar esta assinatura?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <Button
              variant={cancelImmediately === false ? "default" : "outline"}
              className={`w-full h-auto py-1.5 px-2.5 flex flex-col items-start text-left ${
                cancelImmediately === false ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700" : ""
              }`}
              onClick={() => {
                setCancelImmediately(false)
              }}
            >
              <span className="font-semibold text-[11px] mb-0.5">Cancelar ao Final do Período</span>
              <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">
                Cancelada em{" "}
                {selectedSubscription &&
                  format(new Date(selectedSubscription.currentPeriodEnd), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                . Cliente mantém acesso até essa data.
              </span>
            </Button>
            <Button
              variant={cancelImmediately === true ? "destructive" : "outline"}
              className={`w-full h-auto py-1.5 px-2.5 flex flex-col items-start text-left ${
                cancelImmediately === true ? "" : "border-red-300 dark:border-red-700"
              }`}
              onClick={() => {
                setCancelImmediately(true)
              }}
            >
              <span className={`font-semibold text-[11px] mb-0.5 ${
                cancelImmediately === true ? "text-white" : "text-red-600 dark:text-red-400"
              }`}>
                Cancelar Imediatamente
              </span>
              <span className={`text-[9px] leading-tight ${
                cancelImmediately === true ? "text-red-100" : "text-gray-500 dark:text-gray-400"
              }`}>
                Cancelamento imediato. Cliente perde acesso agora. Irreversível.
              </span>
            </Button>
          </div>
          <DialogFooter className="flex flex-row gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCancelDialogOpen(false)
                setSelectedSubscription(null)
                setCancelImmediately(undefined)
              }}
              className="w-full text-xs h-9"
              disabled={isCanceling}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!selectedSubscription) return

                setIsCanceling(true)
                try {
                  const result = await cancelSubscription({
                    subscriptionId: selectedSubscription.id,
                    cancelImmediately: cancelImmediately!,
                    isAdmin: true,
                  })

                  if (result.success) {
                    toast.success(
                      cancelImmediately
                        ? "Assinatura cancelada imediatamente"
                        : "Assinatura será cancelada ao final do período"
                    )
                    setCancelDialogOpen(false)
                    setSelectedSubscription(null)
                    setCancelImmediately(undefined)
                    // Atualizar estado local para refletir o cancelamento
                    setSubscriptions((prev) =>
                      prev.map((sub) =>
                        sub.id === selectedSubscription.id
                          ? {
                              ...sub,
                              cancelAtPeriodEnd: cancelImmediately ? false : true,
                              status: cancelImmediately ? "canceled" : sub.status,
                            }
                          : sub
                      )
                    )
                    router.refresh()
                  } else {
                    toast.error(result.error || "Erro ao cancelar assinatura")
                  }
                } catch (error) {
                  console.error("Erro ao cancelar assinatura:", error)
                  toast.error("Erro ao cancelar assinatura")
                } finally {
                  setIsCanceling(false)
                }
              }}
              disabled={isCanceling || cancelImmediately === undefined}
              className="w-full text-xs h-9"
            >
              {isCanceling
                ? "Processando..."
                : cancelImmediately === undefined
                ? "Selecione uma opção"
                : cancelImmediately
                ? "Confirmar Cancelamento"
                : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminSubscriptionsTab

