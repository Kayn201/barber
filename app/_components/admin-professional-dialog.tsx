"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Switch } from "./ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import { createProfessional } from "../_actions/admin/create-professional"
import { updateProfessional } from "../_actions/admin/update-professional"
import { toast } from "sonner"

interface WeeklySchedule {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface Professional {
  id?: string
  name: string
  profession: string
  imageUrl: string
  serviceIds: string[]
  weeklySchedule: WeeklySchedule[]
}

interface AdminProfessionalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professional?: any | null
  services: any[]
  onSuccess?: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
]

// Gerar opções de horário de 15 em 15 minutos (00:00 até 23:45)
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4)
  const minutes = (i % 4) * 15
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
})

const AdminProfessionalDialog = ({
  open,
  onOpenChange,
  professional,
  services,
  onSuccess,
}: AdminProfessionalDialogProps) => {
  const [formData, setFormData] = useState<Professional>({
    name: "",
    profession: "",
    imageUrl: "",
    serviceIds: [],
    weeklySchedule: DAYS_OF_WEEK.map((day) => ({
      dayOfWeek: day.value,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    })),
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (professional) {
        setFormData({
          id: professional.id,
          name: professional.name || "",
          profession: professional.profession || "",
          imageUrl: professional.imageUrl || "",
          serviceIds: professional.services?.map((s: any) => s.serviceId) || [],
          weeklySchedule:
            professional.weeklySchedule?.length > 0
              ? DAYS_OF_WEEK.map((day) => {
                  const existing = professional.weeklySchedule.find(
                    (s: any) => s.dayOfWeek === day.value
                  )
                  return existing
                    ? {
                        dayOfWeek: day.value,
                        startTime: existing.startTime,
                        endTime: existing.endTime,
                        isAvailable: existing.isAvailable,
                      }
                    : {
                        dayOfWeek: day.value,
                        startTime: "08:00",
                        endTime: "18:00",
                        isAvailable: false,
                      }
                })
              : DAYS_OF_WEEK.map((day) => ({
                  dayOfWeek: day.value,
                  startTime: "08:00",
                  endTime: "18:00",
                  isAvailable: false,
                })),
        })
      } else {
        setFormData({
          name: "",
          profession: "",
          imageUrl: "",
          serviceIds: [],
          weeklySchedule: DAYS_OF_WEEK.map((day) => ({
            dayOfWeek: day.value,
            startTime: "08:00",
            endTime: "18:00",
            isAvailable: false,
          })),
        })
      }
    }
  }, [professional, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (professional?.id) {
        const result = await updateProfessional({
          id: professional.id,
          ...formData,
        })
        if (result.success) {
          toast.success("Profissional atualizado com sucesso!")
          onOpenChange(false)
          onSuccess?.()
        } else {
          toast.error(result.error || "Erro ao atualizar profissional")
        }
      } else {
        const result = await createProfessional(formData)
        if (result.success) {
          toast.success("Profissional criado com sucesso!")
          onOpenChange(false)
          onSuccess?.()
        } else {
          toast.error(result.error || "Erro ao criar profissional")
        }
      }
    } catch (error) {
      toast.error("Erro ao salvar profissional")
    } finally {
      setIsLoading(false)
    }
  }

  const updateSchedule = (dayOfWeek: number, field: string, value: any) => {
    setFormData({
      ...formData,
      weeklySchedule: formData.weeklySchedule.map((schedule) =>
        schedule.dayOfWeek === dayOfWeek
          ? { ...schedule, [field]: value }
          : schedule
      ),
    })
  }

  const toggleService = (serviceId: string) => {
    setFormData({
      ...formData,
      serviceIds: formData.serviceIds.includes(serviceId)
        ? formData.serviceIds.filter((id) => id !== serviceId)
        : [...formData.serviceIds, serviceId],
    })
  }

  const activeServices = services.filter((s) => s.isActive)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {professional?.id ? "Editar Profissional" : "Novo Profissional"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome * <span className="text-gray-400 text-xs">(Obrigatório)</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nome do profissional"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profession">
              Cargo/Profissão * <span className="text-gray-400 text-xs">(Obrigatório)</span>
            </Label>
            <Input
              id="profession"
              value={formData.profession}
              onChange={(e) =>
                setFormData({ ...formData, profession: e.target.value })
              }
              placeholder="Ex: Barbeiro, Cabeleireiro, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">
              URL da Foto * <span className="text-gray-400 text-xs">(Obrigatório)</span>
            </Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) =>
                setFormData({ ...formData, imageUrl: e.target.value })
              }
              placeholder="https://exemplo.com/foto.jpg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Serviços Ativos *</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {activeServices.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhum serviço ativo disponível
                </p>
              ) : (
                activeServices.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={formData.serviceIds.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <Label
                      htmlFor={`service-${service.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {service.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Horários de Atendimento</Label>
            <div className="space-y-3">
              {/* Botões dos dias em linha horizontal */}
              <div className="flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map((day) => {
                  const schedule = formData.weeklySchedule.find(
                    (s) => s.dayOfWeek === day.value
                  ) || {
                    dayOfWeek: day.value,
                    startTime: "08:00",
                    endTime: "18:00",
                    isAvailable: false,
                  }
                  const isSelected = schedule.isAvailable

                  return (
                    <Button
                      key={day.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-10 w-10 rounded-full p-0 ${
                        isSelected
                          ? "bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
                          : ""
                      }`}
                      onClick={() =>
                        updateSchedule(day.value, "isAvailable", !isSelected)
                      }
                    >
                      {day.short}
                    </Button>
                  )
                })}
              </div>

              {/* Campos de horário para os dias selecionados */}
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const schedule = formData.weeklySchedule.find(
                    (s) => s.dayOfWeek === day.value
                  )
                  const isSelected = schedule?.isAvailable

                  if (!isSelected) return null

                  return (
                    <div key={day.value} className="space-y-2">
                      <Label className="text-sm font-semibold">{day.label}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <Select
                            value={schedule.startTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "startTime", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <Select
                            value={schedule.endTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "endTime", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
              disabled={isLoading}
            >
              {isLoading
                ? "Salvando..."
                : professional?.id
                ? "Atualizar"
                : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AdminProfessionalDialog

