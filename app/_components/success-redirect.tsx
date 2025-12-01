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
      if (clientId) {
        router.push(`/?clientId=${clientId}`)
      } else {
        router.push("/")
      }
    }, 1500) // 1.5 segundos para mostrar a mensagem de sucesso

    return () => clearTimeout(timer)
  }, [router, clientId])

  return null
}

