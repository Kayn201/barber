"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BarbershopService, Professional } from "@prisma/client"
import { MessageCircle } from "lucide-react"
import AuthDialog from "./auth-dialog"

interface BookingReviewCardProps {
  service: BarbershopService
  professional: Professional
  selectedDate: Date
  onProceedToPayment: () => void
}

const BookingReviewCard = ({
  service,
  professional,
  selectedDate,
  onProceedToPayment,
}: BookingReviewCardProps) => {
  const { data: session } = useSession()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const isSubscription = Boolean(service.isSubscription && service.subscriptionInterval)
  const handleWhatsAppClick = () => {
    // Buscar telefone da barbearia (você pode ajustar isso)
    const phoneNumber = "5511999999999" // Substituir pelo telefone real
    const message = encodeURIComponent(
      `Olá! Tenho interesse em antecipar meu horário de agendamento.\n\n` +
        `Serviço: ${service.name}\n` +
        `Data: ${format(selectedDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}\n` +
        `Profissional: ${professional.name}`
    )
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank")
  }

  const handleAgendarClick = () => {
    // Se for assinatura e não estiver autenticado, mostrar dialog de autenticação
    if (isSubscription && !session) {
      setAuthDialogOpen(true)
      return
    }
    onProceedToPayment()
  }

  return (
    <div className="space-y-4">
      {/* SERVIÇO E PREÇO */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{service.name}</h3>
        <span className="text-lg font-bold text-[#EE8530]">
          {Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(service.price))}
        </span>
      </div>

      {/* CARD DE DETALHES DO AGENDAMENTO */}
      <Card className="bg-[#1A1B1F]">
        <CardContent className="space-y-4 p-5">
          {/* DETALHES DO AGENDAMENTO */}
          <div className="space-y-2 border-b border-solid pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Data</span>
              <span className="text-sm font-semibold">
                {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Horário</span>
              <span className="text-sm font-semibold">
                {format(selectedDate, "HH:mm")}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Barber</span>
              <span className="text-sm font-semibold">{professional.name}</span>
            </div>
          </div>

          {/* BOTÃO ANTECIPAR HORÁRIO */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleWhatsAppClick}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Tenho interesse em antecipar horário
          </Button>
        </CardContent>
      </Card>

      {/* BOTÃO AGENDAR */}
      <div className="space-y-2">
        <Button
          className="w-full bg-[#EE8530] text-white hover:bg-[#EE8530]/90"
          onClick={handleAgendarClick}
        >
          Agendar
        </Button>
        <p className="text-center text-xs text-gray-400">
          {isSubscription
            ? "Para assinaturas, é necessário criar uma conta"
            : "Após a confirmar, seu Pass será criado automaticamente"}
        </p>
      </div>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        isSubscription={isSubscription}
      />
    </div>
  )
}

export default BookingReviewCard

