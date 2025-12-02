"use client"

import { useEffect } from "react"

interface NavigationAppsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  barbershopName: string
}

export default function NavigationAppsDialog({
  open,
  onOpenChange,
  address,
  barbershopName,
}: NavigationAppsDialogProps) {
  useEffect(() => {
    if (!open || !address) return

    // Usar a API nativa do navegador para compartilhar/localizar
    // Isso faz o sistema mostrar o menu nativo de apps disponíveis
    const openNativeNavigation = async () => {
      const encodedAddress = encodeURIComponent(address)
      
      // Tentar usar a API Share primeiro (funciona em iOS e Android modernos)
      if (navigator.share) {
        try {
          await navigator.share({
            title: barbershopName,
            text: address,
            url: `https://maps.google.com/?q=${encodedAddress}`,
          })
          onOpenChange(false)
          return
        } catch (error) {
          // Se o usuário cancelar ou der erro, continuar com o método alternativo
          if ((error as Error).name !== "AbortError") {
            console.log("Share API não disponível, usando método alternativo")
          } else {
            // Usuário cancelou
            onOpenChange(false)
            return
          }
        }
      }

      // Método alternativo: usar link com múltiplos protocolos
      // O sistema operacional mostrará o menu nativo de apps disponíveis
      const link = document.createElement("a")
      link.href = `https://maps.google.com/?q=${encodedAddress}`
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      
      // Adicionar atributos para iOS detectar como localização
      link.setAttribute("data-location", address)
      
      // Tentar abrir com protocolos nativos primeiro
      // iOS detecta automaticamente e mostra menu de apps
      const appleMapsUrl = `http://maps.apple.com/?q=${encodedAddress}`
      const googleMapsUrl = `https://maps.google.com/?q=${encodedAddress}`
      const wazeUrl = `waze://?q=${encodedAddress}`
      
      // Criar um link temporário que o sistema reconhece
      const tempLink = document.createElement("a")
      tempLink.style.display = "none"
      tempLink.href = appleMapsUrl // iOS vai mostrar menu de apps
      
      // Para Android, tentar abrir diretamente
      const isAndroid = /Android/i.test(navigator.userAgent)
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      
      if (isIOS) {
        // iOS: usar link que o sistema reconhece
        // O sistema mostrará automaticamente o menu de apps disponíveis
        window.location.href = appleMapsUrl
      } else if (isAndroid) {
        // Android: tentar usar intent
        const intentUrl = `geo:0,0?q=${encodedAddress}`
        window.location.href = intentUrl
      } else {
        // Desktop: abrir Google Maps
        window.open(googleMapsUrl, "_blank", "noopener,noreferrer")
      }
      
      onOpenChange(false)
    }

    // Pequeno delay para garantir que o dialog foi renderizado
    const timer = setTimeout(() => {
      openNativeNavigation()
    }, 100)

    return () => clearTimeout(timer)
  }, [open, address, barbershopName, onOpenChange])

  // Este componente não renderiza nada visível
  // Ele apenas dispara a ação nativa do sistema
  return null
}

