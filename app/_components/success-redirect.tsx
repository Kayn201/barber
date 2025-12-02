"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface SuccessRedirectProps {
  clientId?: string | null
}

export default function SuccessRedirect({ clientId }: SuccessRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    // Disparar evento para atualizar stats na aba "Visão geral"
    // Isso garante atualização em tempo real quando um booking é criado
    window.dispatchEvent(new CustomEvent("booking-updated", { detail: { type: "created" } }))

    // Processar redirect no cliente após um pequeno delay
    // Isso garante que a página renderize antes de redirecionar
    const timer = setTimeout(() => {
      // Usar window.location.origin para garantir URL correta (não localhost)
      const baseUrl = window.location.origin
      
      if (clientId) {
        // Usar window.location.href para garantir redirecionamento correto
        window.location.href = `${baseUrl}/?clientId=${clientId}`
      } else {
        // Usar window.location.href para garantir redirecionamento correto
        window.location.href = `${baseUrl}/`
      }
    }, 1500) // 1.5 segundos para mostrar a mensagem de sucesso

    return () => clearTimeout(timer)
  }, [clientId])

  return null
}

