"use client"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Wallet } from "lucide-react"
import { toast } from "sonner"

interface AddToWalletButtonProps {
  bookingId: string
  hasWalletPass?: boolean
}

export default function AddToWalletButton({
  bookingId,
  hasWalletPass = false,
}: AddToWalletButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  // Detectar se é iOS
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
      setIsIOS(isIOSDevice)
    }
  }, [])

  // Se não for iOS, não mostrar o botão
  if (!isIOS) {
    return null
  }

  const handleAddToWallet = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/wallet/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao gerar passe")
      }

      // Criar blob e fazer download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `agendamento-${bookingId}.pkpass`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Passe gerado com sucesso! Adicione à sua Wallet.")
      
      // Recarregar página para atualizar o estado (hasWalletPass)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      console.error("Erro ao gerar wallet pass:", error)
      toast.error(error.message || "Erro ao gerar passe")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleAddToWallet}
      disabled={isGenerating}
      variant="outline"
      size="sm"
      className="flex items-center gap-1 md:gap-2 text-[#EE8530] border-[#EE8530] hover:bg-[#EE8530]/10 text-[10px] md:text-xs h-6 md:h-7 px-2 md:px-3"
    >
      <Wallet className="h-3 w-3 md:h-4 md:w-4" />
      <span className="hidden sm:inline">
        {isGenerating ? "Gerando..." : hasWalletPass ? "Atualizar Wallet" : "Adicionar à Wallet"}
      </span>
      <span className="sm:hidden">
        {isGenerating ? "..." : hasWalletPass ? "Atualizar" : "Wallet"}
      </span>
    </Button>
  )
}

