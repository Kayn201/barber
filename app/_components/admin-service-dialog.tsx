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
import DurationSelector from "./duration-selector"
import PriceInput from "./price-input"
import TimeSelector from "./time-selector"
import { createService } from "../_actions/admin/create-service"
import { updateService } from "../_actions/admin/update-service"
import { toast } from "sonner"

interface Service {
  id?: string
  name: string
  description: string
  imageUrl: string
  price: number
  duration: number
  isSubscription: boolean
  subscriptionInterval?: string | null
  isActive?: boolean
  cancellationTimeMinutes?: number
  maxReschedules?: number
}

interface AdminServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: Service | null
  onSuccess?: () => void
}

const AdminServiceDialog = ({
  open,
  onOpenChange,
  service,
  onSuccess,
}: AdminServiceDialogProps) => {
  const [formData, setFormData] = useState<Service>({
    name: "",
    description: "",
    imageUrl: "",
    price: 0,
    duration: 30,
    isSubscription: false,
    subscriptionInterval: null,
    isActive: true,
    cancellationTimeMinutes: 1440, // 24 horas padrão
    maxReschedules: 1,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (open) {
      if (service) {
        setFormData({
          id: service.id,
          name: service.name || "",
          description: service.description || "",
          imageUrl: service.imageUrl || "",
          price: service.price ? Number(service.price) : 0,
          duration: service.duration || 30,
          isSubscription: service.isSubscription || false,
          subscriptionInterval: service.subscriptionInterval || null,
          isActive: service.isActive ?? true,
          cancellationTimeMinutes: service.cancellationTimeMinutes ?? 1440,
          maxReschedules: service.maxReschedules ?? 1,
        })
        setImagePreview(service.imageUrl || "")
      } else {
        setFormData({
          name: "",
          description: "",
          imageUrl: "",
          price: 0,
          duration: 30,
          isSubscription: false,
          subscriptionInterval: null,
          isActive: true,
          cancellationTimeMinutes: 1440,
          maxReschedules: 1,
        })
        setImagePreview("")
      }
    }
  }, [service, open])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("imageType", "service")

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
      if (service?.id) {
        const result = await updateService({
          id: service.id,
          ...formData,
          subscriptionInterval: formData.subscriptionInterval || undefined,
        })
        if (result.success) {
          toast.success("Serviço atualizado com sucesso!")
          onOpenChange(false)
          onSuccess?.()
        } else {
          toast.error(result.error || "Erro ao atualizar serviço")
        }
      } else {
        const result = await createService({
          ...formData,
          subscriptionInterval: formData.subscriptionInterval || undefined,
        })
        if (result.success) {
          toast.success("Serviço criado com sucesso!")
          onOpenChange(false)
          onSuccess?.()
        } else {
          toast.error(result.error || "Erro ao criar serviço")
        }
      }
    } catch (error) {
      toast.error("Erro ao salvar serviço")
    } finally {
      setIsLoading(false)
    }
  }

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
              {service?.id ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Serviço *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Imagem do Serviço</Label>
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
              O sistema redimensiona automaticamente imagens grandes (como 1080x1080) para o tamanho ideal. Formatos aceitos: JPG, PNG, WEBP, GIF. Tamanho máximo: 10MB.
            </p>
          </div>

          <div className="space-y-2">
            <PriceInput
              value={formData.price}
              onChange={(value) =>
                setFormData({ ...formData, price: value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DurationSelector
              value={formData.duration}
              onChange={(minutes) =>
                setFormData({ ...formData, duration: minutes })
              }
            />

            <TimeSelector
              value={formData.cancellationTimeMinutes || 1440}
              onChange={(minutes) =>
                setFormData({ ...formData, cancellationTimeMinutes: minutes })
              }
              label="Tempo para Cancelamento *"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxReschedules">
              Quantidade de Reagendamentos *
            </Label>
            <Input
              id="maxReschedules"
              type="number"
              min="0"
              value={formData.maxReschedules}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxReschedules: parseInt(e.target.value) || 0,
                })
              }
              required
              className="w-32"
            />
            <p className="text-xs text-gray-500">
              Padrão: 1. Quantidade máxima de vezes que o cliente pode reagendar este serviço.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="isSubscription">Tipo de Pagamento *</Label>
            <Select
              value={formData.isSubscription ? "subscription" : "one_time"}
              onValueChange={(value) => {
                const isSub = value === "subscription"
                setFormData({
                  ...formData,
                  isSubscription: isSub,
                  subscriptionInterval: isSub
                    ? formData.subscriptionInterval || "month"
                    : null,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">Pagamento Único</SelectItem>
                <SelectItem value="subscription">Assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.isSubscription && (
            <div className="space-y-2">
              <Label htmlFor="subscriptionInterval">
                Intervalo de Recorrência *
              </Label>
              <Select
                value={formData.subscriptionInterval || "month"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    subscriptionInterval: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o intervalo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive" className="cursor-pointer">
              Serviço Ativo
            </Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: checked })
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
              disabled={isLoading}
            >
              {isLoading ? "Salvando..." : service?.id ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AdminServiceDialog

