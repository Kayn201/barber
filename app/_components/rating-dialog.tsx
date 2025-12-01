"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Star } from "lucide-react"
import { createRating } from "../_actions/create-rating"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface RatingDialogProps {
  booking: {
    id: string
    service: {
      name: string
    }
    professional: {
      id: string
      name: string
    }
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RatingDialog = ({ booking, open, onOpenChange }: RatingDialogProps) => {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma avaliação")
      return
    }

    setIsSubmitting(true)
    try {
      await createRating({
        bookingId: booking.id,
        professionalId: booking.professional.id,
        score: rating,
      })
      toast.success("Avaliação enviada com sucesso!")
      // Disparar evento para atualizar stats na aba "Visão geral"
      window.dispatchEvent(new CustomEvent("booking-updated", { detail: { type: "completed" } }))
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Erro ao enviar avaliação. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%]">
        <DialogHeader>
          <DialogTitle>Avalie seu atendimento</DialogTitle>
          <DialogDescription>
            Como foi seu atendimento com {booking.professional.name}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <p className="text-sm text-gray-400">{booking.service.name}</p>
            <p className="mt-1 text-sm font-semibold">
              {booking.professional.name}
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  size={40}
                  className={
                    star <= (hoveredRating || rating)
                      ? "fill-[#EE8530] text-[#EE8530]"
                      : "text-gray-300"
                  }
                />
              </button>
            ))}
          </div>

          <Button
            className="w-full bg-[#EE8530] text-white hover:bg-[#EE8530]/90"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RatingDialog

