"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { format, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useMemo } from "react"
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

interface SubscriptionsListProps {
  subscriptions: any[]
}

const SubscriptionsList = ({ subscriptions: initialSubscriptions }: SubscriptionsListProps) => {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
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
          Cancela no dia {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
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

  const handleCancelClick = (subscription: any) => {
    setSelectedSubscription(subscription)
    setCancelDialogOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!selectedSubscription) return

    setIsCanceling(true)
    try {
      const result = await cancelSubscription({
        subscriptionId: selectedSubscription.id,
        cancelImmediately: false, // Usuário só pode cancelar no final do período
        isAdmin: false,
      })

      if (result.success) {
        toast.success("Assinatura será cancelada ao final do período atual")
        setCancelDialogOpen(false)
        setSelectedSubscription(null)
        // Atualizar estado local para refletir o cancelamento
        setSubscriptions((prev) =>
          prev.map((sub) =>
            sub.id === selectedSubscription.id
              ? { ...sub, cancelAtPeriodEnd: true }
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
  }

  const activeCount = subscriptions.filter(
    (sub) => sub.status === "active" && !sub.cancelAtPeriodEnd
  ).length
  const canceledCount = subscriptions.filter(
    (sub) => sub.status === "canceled" || sub.cancelAtPeriodEnd
  ).length

  return (
    <>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "active" | "canceled")} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="all" className="text-xs py-2">Todas ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="active" className="text-xs py-2">Ativas ({activeCount})</TabsTrigger>
          <TabsTrigger value="canceled" className="text-xs py-2">Canceladas ({canceledCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {filteredSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                {filter === "active"
                  ? "Você não possui assinaturas ativas"
                  : filter === "canceled"
                  ? "Você não possui assinaturas canceladas"
                  : "Você não possui assinaturas"}
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
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{subscription.service.name}</CardTitle>
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
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="font-semibold">Período atual:</span>{" "}
                            {format(new Date(subscription.currentPeriodStart), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}{" "}
                            até{" "}
                            {format(new Date(subscription.currentPeriodEnd), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                        
                        {(() => {
                          const now = new Date()
                          const endDate = new Date(subscription.currentPeriodEnd)
                          const isExpired = endDate < now

                          if (subscription.cancelAtPeriodEnd && !isExpired) {
                            return (
                              <p className="text-sm text-red-500 dark:text-red-400">
                                Esta assinatura será cancelada ao final do período atual. Você continuará tendo acesso até{" "}
                                {format(endDate, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                                .
                              </p>
                            )
                          }
                          return null
                        })()}
                        {subscription.status === "active" && !subscription.cancelAtPeriodEnd ? (
                          <Button
                            variant="destructive"
                            onClick={() => handleCancelClick(subscription)}
                            className="w-full sm:w-auto"
                          >
                            Cancelar Assinatura
                          </Button>
                        ) : null}
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
        <DialogContent className="w-[95%] max-w-md mx-auto">
          <DialogHeader className="space-y-2 md:space-y-3">
            <DialogTitle className="text-base md:text-lg">Cancelar Assinatura</DialogTitle>
            <DialogDescription className="text-xs md:text-sm space-y-2">
              <p>
                Ao cancelar, sua assinatura será encerrada ao final do período atual (
                {selectedSubscription &&
                  format(new Date(selectedSubscription.currentPeriodEnd), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                ). Você continuará tendo acesso até essa data.
              </p>
              <p className="font-semibold">
                Importante: Não haverá reembolso. O cancelamento ocorrerá apenas no final do período pago.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:gap-3 mt-4 md:mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                setCancelDialogOpen(false)
                setSelectedSubscription(null)
              }}
              className="w-full h-9 md:h-10 text-xs md:text-sm"
              disabled={isCanceling}
            >
              Não, manter assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isCanceling}
              className="w-full h-9 md:h-10 text-xs md:text-sm"
            >
              {isCanceling ? "Cancelando..." : "Sim, cancelar ao final do período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SubscriptionsList

