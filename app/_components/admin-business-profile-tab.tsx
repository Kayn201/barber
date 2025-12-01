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
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

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
            // Formatar endereço completo com número (se disponível)
            const parts = []
            if (data.logradouro) {
              // Se não tiver número no logradouro, adicionar instrução
              parts.push(data.logradouro)
            }
            if (data.bairro) parts.push(data.bairro)
            if (data.localidade) parts.push(data.localidade)
            if (data.uf) parts.push(data.uf)
            if (data.cep) parts.push(`CEP: ${data.cep}`)
            
            const address = parts.join(', ')
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
            // Formatar endereço completo priorizando número
            const parts = []
            
            // Rua/Logradouro com número (prioridade)
            if (item.address?.road) {
              const road = item.address.road
              const houseNumber = item.address?.house_number
              // Se tiver número, adicionar junto com a rua
              if (houseNumber) {
                parts.push(`${road}, ${houseNumber}`)
              } else {
                parts.push(road)
              }
            }
            
            // Bairro
            if (item.address?.neighbourhood || item.address?.suburb) {
              parts.push(item.address.neighbourhood || item.address.suburb)
            }
            
            // Cidade
            if (item.address?.city || item.address?.town) {
              parts.push(item.address.city || item.address.town)
            }
            
            // Estado
            if (item.address?.state) parts.push(item.address.state)
            
            // CEP
            if (item.address?.postcode) parts.push(`CEP: ${item.address.postcode}`)
            
            // Se não conseguiu montar com address, usar display_name
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

  // Atualizar preview quando formData.imageUrl mudar
  useEffect(() => {
    if (formData.imageUrl) {
      setImagePreview(formData.imageUrl)
    }
  }, [formData.imageUrl])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append("file", file)
      uploadFormData.append("imageType", "business")

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadFormData,
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
            <div className="flex items-center gap-4">
              {formData.imageUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={formData.imageUrl}
                    alt={formData.name}
                    className="w-16 h-16 object-cover rounded-full border border-gray-800"
                  />
                </div>
              )}
              <CardTitle className="text-white">{formData.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.businessNumber && (
              <div>
                <p className="text-sm text-gray-400">CNPJ</p>
                <p className="text-white font-semibold break-words break-all">{formData.businessNumber}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400">Endereço Completo</p>
              <p className="text-white font-semibold">{formData.address}</p>
              {formData.address && !/\d/.test(formData.address) && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠️ Adicione o número do endereço para que os mapas funcionem corretamente
                </p>
              )}
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
            <CardTitle className="text-white flex-1">
              {hasData ? "Editar Informações da Empresa" : "Informações da Empresa"}
            </CardTitle>
          </div>
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
                className="bg-background w-full min-w-0"
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
                className="bg-background w-full min-w-0"
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
                placeholder="Ex: Rua Exemplo, 123 - Bairro, Cidade - Estado, CEP 01234-567"
                required
                className="bg-background w-full min-w-0"
              />
              <div className="space-y-1">
                <p className="text-xs text-amber-400 font-medium">
                  📍 Importante: Inclua o número do endereço para que os mapas (Waze e Google Maps) funcionem corretamente!
                </p>
                <p className="text-xs text-gray-500">
                  💡 Dica: Digite um CEP de 8 dígitos ou um endereço completo (com número) para ver sugestões automáticas
                </p>
              </div>
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
                    className="bg-background w-full min-w-0 flex-1"
                  />
                  {formData.phones.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removePhone(index)}
                      className="flex-shrink-0"
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
              <Label htmlFor="image">Logo da Empresa</Label>
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
                  className="bg-background flex-1 cursor-default w-full min-w-0"
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
                      className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-2 md:p-3 rounded-md border border-gray-800 bg-background"
                    >
                      <div className="flex items-center gap-2 md:min-w-[140px] flex-shrink-0">
                        <Switch
                          checked={schedule?.isAvailable || false}
                          onCheckedChange={(checked) =>
                            updateSchedule(day.value, "isAvailable", checked)
                          }
                        />
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap">{day.label}</span>
                      </div>

                      {schedule?.isAvailable && (
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
                          <Select
                            value={schedule.startTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "startTime", value)
                            }
                          >
                            <SelectTrigger className="w-[90px] md:w-[120px] bg-background flex-shrink-0 text-xs md:text-sm h-9 md:h-10">
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

                          <span className="text-gray-400 whitespace-nowrap text-xs md:text-sm">até</span>

                          <Select
                            value={schedule.endTime}
                            onValueChange={(value) =>
                              updateSchedule(day.value, "endTime", value)
                            }
                          >
                            <SelectTrigger className="w-[90px] md:w-[120px] bg-background flex-shrink-0 text-xs md:text-sm h-9 md:h-10">
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
                        <span className="text-xs md:text-sm text-gray-500 md:ml-auto">Fechado</span>
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

