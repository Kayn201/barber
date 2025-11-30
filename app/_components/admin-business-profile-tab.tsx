"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
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
import { updateBusinessProfile } from "../_actions/admin/update-business-profile"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Edit } from "lucide-react"

interface BusinessHours {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface BusinessProfile {
  id: string
  name: string
  address: string
  phones: string[]
  description: string
  imageUrl: string
  businessNumber?: string
  businessHours: BusinessHours[]
}

interface AdminBusinessProfileTabProps {
  barbershop: any
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

const AdminBusinessProfileTab = ({ barbershop }: AdminBusinessProfileTabProps) => {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<BusinessProfile>({
    id: barbershop?.id || "",
    name: barbershop?.name || "",
    address: barbershop?.address || "",
    phones: barbershop?.phones?.length > 0 ? barbershop.phones : [""],
    description: barbershop?.description || "",
    imageUrl: barbershop?.imageUrl || "",
    businessNumber: barbershop?.businessNumber || "",
    businessHours:
      barbershop?.businessHours?.length > 0
        ? DAYS_OF_WEEK.map((day) => {
            const existing = barbershop.businessHours.find(
              (h: any) => h.dayOfWeek === day.value
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
            isAvailable: day.value !== 0, // Domingo fechado por padrão
          })),
  })
  const [isLoading, setIsLoading] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Buscar endereços usando APIs gratuitas
  const handleAddressChange = (value: string) => {
    setFormData({ ...formData, address: value })
    
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    // Se o texto for muito curto, limpar sugestões
    if (value.length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      return
    }
    
    // Se parece ser um CEP (apenas números, 8 dígitos), usar ViaCEP
    const cepOnly = value.replace(/\D/g, '')
    if (cepOnly.length === 8) {
      const timeout = setTimeout(async () => {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cepOnly}/json/`)
          if (response.ok) {
            const data = await response.json()
            if (!data.erro) {
              const address = `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || ''} - ${data.uf || ''}, CEP: ${data.cep || ''}`
                .replace(/^,\s*|,\s*$/g, '') // Remove vírgulas no início/fim
                .replace(/,\s*,/g, ',') // Remove vírgulas duplas
              setAddressSuggestions([address])
              setShowSuggestions(true)
              return
            }
          }
        } catch (error) {
          console.error("Erro ao buscar CEP:", error)
        }
      }, 300)
      setSearchTimeout(timeout)
      return
    }
    
    // Para outros casos, usar Nominatim (OpenStreetMap) - completamente gratuito
    // Debounce: aguardar 800ms antes de buscar (Nominatim tem rate limit de 1 req/seg)
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&countrycodes=br&limit=5&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'BarbershopApp/1.0', // Nominatim requer User-Agent
            },
          }
        )
        
        if (response.ok) {
          const data = await response.json()
          const suggestions = data.map((item: any) => {
            // Formatar endereço completo
            const parts = []
            if (item.address?.road) parts.push(item.address.road)
            if (item.address?.house_number) parts.push(item.address.house_number)
            if (item.address?.neighbourhood || item.address?.suburb) {
              parts.push(item.address.neighbourhood || item.address.suburb)
            }
            if (item.address?.city || item.address?.town) {
              parts.push(item.address.city || item.address.town)
            }
            if (item.address?.state) parts.push(item.address.state)
            if (item.address?.postcode) parts.push(`CEP: ${item.address.postcode}`)
            
            return parts.length > 0 ? parts.join(', ') : item.display_name
          })
          
          setAddressSuggestions(suggestions)
          setShowSuggestions(true)
        } else {
          setAddressSuggestions([])
          setShowSuggestions(false)
        }
      } catch (error) {
        console.error("Erro ao buscar endereço:", error)
        setAddressSuggestions([])
        setShowSuggestions(false)
      }
    }, 800) // Aumentado para respeitar rate limit do Nominatim
    
    setSearchTimeout(timeout)
  }

  const handleSelectAddress = (address: string) => {
    setFormData({ ...formData, address })
    setShowSuggestions(false)
    setAddressSuggestions([])
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.id) {
      toast.error("ID da barbearia não encontrado. Por favor, recarregue a página.")
      return
    }
    
    setIsLoading(true)

    try {
      const result = await updateBusinessProfile(formData.id, {
        name: formData.name,
        address: formData.address,
        phones: formData.phones.filter((p) => p.trim() !== ""),
        description: formData.description,
        imageUrl: formData.imageUrl,
        businessNumber: formData.businessNumber,
        businessHours: formData.businessHours,
      })

      if (result.success) {
        toast.success("Perfil empresarial atualizado com sucesso!")
        setIsEditing(false)
        router.refresh()
      } else {
        toast.error(result.error || "Erro ao atualizar perfil empresarial")
      }
    } catch (error) {
      console.error("Erro ao salvar perfil empresarial:", error)
      toast.error("Erro ao salvar perfil empresarial")
    } finally {
      setIsLoading(false)
    }
  }

  const updateSchedule = (dayOfWeek: number, field: string, value: any) => {
    setFormData({
      ...formData,
      businessHours: formData.businessHours.map((schedule) =>
        schedule.dayOfWeek === dayOfWeek
          ? { ...schedule, [field]: value }
          : schedule
      ),
    })
  }

  const addPhone = () => {
    setFormData({
      ...formData,
      phones: [...formData.phones, ""],
    })
  }

  const removePhone = (index: number) => {
    setFormData({
      ...formData,
      phones: formData.phones.filter((_, i) => i !== index),
    })
  }

  const updatePhone = (index: number, value: string) => {
    const newPhones = [...formData.phones]
    newPhones[index] = value
    setFormData({ ...formData, phones: newPhones })
  }

  // Verificar se já tem dados salvos
  const hasData = barbershop?.id && barbershop?.name

  // Se não está editando e tem dados, mostrar card resumido
  if (!isEditing && hasData) {
    const activeDays = formData.businessHours.filter((h) => h.isAvailable)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Perfil Empresarial</h2>
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar Perfil
          </Button>
        </div>

        <Card className="bg-[#1A1B1F] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">{formData.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.businessNumber && (
              <div>
                <p className="text-sm text-gray-400">CNPJ</p>
                <p className="text-white font-semibold">{formData.businessNumber}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400">Endereço</p>
              <p className="text-white font-semibold">{formData.address}</p>
            </div>

            {formData.phones.length > 0 && formData.phones[0] && (
              <div>
                <p className="text-sm text-gray-400">Telefones</p>
                <div className="flex flex-wrap gap-2">
                  {formData.phones.filter((p) => p.trim()).map((phone, index) => (
                    <p key={index} className="text-white font-semibold">
                      {phone}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {formData.description && (
              <div>
                <p className="text-sm text-gray-400">Descrição</p>
                <p className="text-white">{formData.description}</p>
              </div>
            )}

            {activeDays.length > 0 && (
              <div>
                <p className="text-sm text-gray-400">Horário de Funcionamento</p>
                <div className="space-y-2 mt-2">
                  {activeDays.map((schedule) => {
                    const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)
                    return (
                      <div key={schedule.dayOfWeek} className="flex items-center gap-2">
                        <span className="text-white font-semibold min-w-[120px]">
                          {day?.label}:
                        </span>
                        <span className="text-white">
                          {schedule.startTime} - {schedule.endTime}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Perfil Empresarial</h2>
        {hasData && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
          >
            Cancelar Edição
          </Button>
        )}
      </div>

      <Card className="bg-[#1A1B1F] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">
            {hasData ? "Editar Informações da Empresa" : "Informações da Empresa"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome da Empresa * <span className="text-gray-400 text-xs">(Obrigatório)</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nome da barbearia"
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessNumber">Número da Empresa (CNPJ)</Label>
              <Input
                id="businessNumber"
                value={formData.businessNumber || ""}
                onChange={(e) =>
                  setFormData({ ...formData, businessNumber: e.target.value })
                }
                placeholder="00.000.000/0000-00"
                className="bg-background"
              />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="address">
                Endereço Completo * <span className="text-gray-400 text-xs">(Obrigatório)</span>
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onFocus={() => {
                  if (addressSuggestions.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => {
                  // Aguardar um pouco antes de fechar para permitir clique na sugestão
                  setTimeout(() => setShowSuggestions(false), 200)
                }}
                placeholder="Digite o CEP (ex: 01310-100) ou endereço (ex: Rua Augusta, São Paulo)"
                required
                className="bg-background"
              />
              <p className="text-xs text-gray-500">
                💡 Dica: Digite um CEP de 8 dígitos ou um endereço para ver sugestões
              </p>
              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-gray-800 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {addressSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectAddress(suggestion)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-800 text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Telefones *</Label>
              {formData.phones.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => updatePhone(index, e.target.value)}
                    placeholder="(00) 00000-0000"
                    required
                    className="bg-background"
                  />
                  {formData.phones.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removePhone(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhone}
              >
                + Adicionar Telefone
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descrição da empresa"
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL da Imagem</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="https://exemplo.com/imagem.jpg"
                className="bg-background"
              />
            </div>

            {/* Horário de Funcionamento */}
            <div className="space-y-4 border-t border-gray-800 pt-4">
              <Label className="text-lg font-semibold">Horário de Funcionamento</Label>
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const schedule = formData.businessHours.find(
                    (s) => s.dayOfWeek === day.value
                  )
                  return (
                    <div
                      key={day.value}
                      className="flex items-center gap-4 p-3 rounded-md border border-gray-800 bg-background"
                    >
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Switch
                          checked={schedule?.isAvailable || false}
                          onCheckedChange={(checked) =>
                            updateSchedule(day.value, "isAvailable", checked)
                          }
                        />
                        <span className="text-sm font-medium">{day.label}</span>
                      </div>

                      {schedule?.isAvailable && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={schedule.startTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "startTime", value)
                            }
                          >
                            <SelectTrigger className="w-[120px] bg-background">
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

                          <span className="text-gray-400">até</span>

                          <Select
                            value={schedule.endTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "endTime", value)
                            }
                          >
                            <SelectTrigger className="w-[120px] bg-background">
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
                      )}

                      {!schedule?.isAvailable && (
                        <span className="text-sm text-gray-500">Fechado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
            >
              {isLoading ? "Salvando..." : "Salvar Perfil Empresarial"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminBusinessProfileTab

