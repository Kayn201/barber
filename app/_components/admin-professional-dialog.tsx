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
  barbershop?: any | null
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
  barbershop,
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
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

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
        setImagePreview(professional.imageUrl || "")
      } else {
        // Novo profissional: usar horários da empresa como padrão
        const defaultSchedule = barbershop?.businessHours?.length > 0
          ? DAYS_OF_WEEK.map((day) => {
              const businessDay = barbershop.businessHours.find(
                (h: any) => h.dayOfWeek === day.value
              )
              return businessDay
                ? {
                    dayOfWeek: day.value,
                    startTime: businessDay.startTime,
                    endTime: businessDay.endTime,
                    isAvailable: businessDay.isAvailable,
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
            }))
        
        setFormData({
          name: "",
          profession: "",
          imageUrl: "",
          serviceIds: [],
          weeklySchedule: defaultSchedule,
        })
        setImagePreview("")
      }
    }
  }, [professional, open])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("imageType", "professional")

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl }))
        setImagePreview(data.imageUrl)
        toast.success("Imagem carregada e otimizada com sucesso!")
      } else {
        toast.error(data.error || "Erro ao carregar imagem")
      }
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast.error("Erro ao fazer upload da imagem")
    } finally {
      setIsUploading(false)
    }
  }

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
    // Se tentando ativar um dia, verificar se a empresa está aberta nesse dia
    if (field === "isAvailable" && value === true && barbershop?.businessHours) {
      const businessDay = barbershop.businessHours.find(
        (h: any) => h.dayOfWeek === dayOfWeek
      )
      if (!businessDay || !businessDay.isAvailable) {
        toast.error("Verifique o Horário de Funcionamento definido na aba Perfil Empresarial")
        return
      }
    }
    
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
          <div className="flex items-start gap-4">
            {imagePreview && (
              <div className="flex-shrink-0 mt-1">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-full border border-gray-800"
                />
              </div>
            )}
            <DialogTitle className="flex-1">
              {professional?.id ? "Editar Profissional" : "Novo Profissional"}
            </DialogTitle>
          </div>
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
            <Label htmlFor="image">Imagem do Profissional</Label>
            <div className="flex gap-2">
              <Input
                id="image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="hidden"
              />
              <Input
                type="text"
                value={imagePreview ? "Imagem selecionada" : "Nenhuma imagem selecionada"}
                readOnly
                className="bg-background flex-1 cursor-default"
                placeholder="Selecione uma imagem"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("image")?.click()}
                disabled={isUploading}
                className="flex-shrink-0"
              >
                {isUploading ? "Carregando..." : "Escolher Arquivo"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              O sistema redimensiona automaticamente imagens grandes (como 1080x1080) para o tamanho ideal. A imagem será exibida em formato circular. Formatos aceitos: JPG, PNG, WEBP, GIF. Tamanho máximo: 10MB.
            </p>
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
                  <div key={service.id} className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`service-${service.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {service.name}
                    </Label>
                    <Switch
                      id={`service-${service.id}`}
                      checked={formData.serviceIds.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
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

