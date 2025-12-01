"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect } from "react"
import { getAllSubscriptions } from "../_actions/admin/get-all-subscriptions"
import { checkNewSubscriptions } from "../_actions/admin/check-new-subscriptions"

interface AdminSubscriptionsTabProps {
  subscriptions: any[]
}

const AdminSubscriptionsTab = ({ subscriptions: initialSubscriptions }: AdminSubscriptionsTabProps) => {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
  const [lastSubscriptionId, setLastSubscriptionId] = useState<string | undefined>(
    initialSubscriptions[0]?.id
  )

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
  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Assinaturas</h2>

      <div className="space-y-4">
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              Nenhuma assinatura encontrada
            </CardContent>
          </Card>
        ) : (
          subscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{subscription.service.name}</CardTitle>
                  {getStatusBadge(subscription.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-semibold">Cliente:</span> {subscription.client.name}
                  </p>
                  {/* Email removido por segurança - não é enviado do servidor */}
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Início:</span>{" "}
                      {format(new Date(subscription.currentPeriodStart), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </div>
                    <div>
                      <span className="font-semibold">Fim:</span>{" "}
                      {format(new Date(subscription.currentPeriodEnd), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant="secondary" className="mt-2">
                      Será cancelada ao final do período
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default AdminSubscriptionsTab

