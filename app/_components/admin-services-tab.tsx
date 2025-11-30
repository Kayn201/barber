"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import AdminServiceDialog from "./admin-service-dialog"
import { deleteService } from "../_actions/admin/delete-service"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface AdminServicesTabProps {
  services: any[]
}

type FilterType = "all" | "one_time" | "subscription"

const AdminServicesTab = ({ services: initialServices }: AdminServicesTabProps) => {
  const [services, setServices] = useState(initialServices)
  const [filter, setFilter] = useState<FilterType>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const router = useRouter()
  const filterScrollRef = useRef<HTMLDivElement>(null)

  const filteredServices = services.filter((service) => {
    if (filter === "all") return true
    if (filter === "one_time") return !service.isSubscription
    if (filter === "subscription") return service.isSubscription
    return true
  })

  useEffect(() => {
    if (filterScrollRef.current) {
      filterScrollRef.current.scrollLeft = 0
    }
  }, [])

  const handleEdit = (service: any) => {
    const serviceData = {
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
    }
    setSelectedService(serviceData)
    setDialogOpen(true)
  }

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return

    const result = await deleteService(serviceId)
    if (result.success) {
      toast.success("Serviço excluído com sucesso!")
      setServices(services.filter((s) => s.id !== serviceId))
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir serviço")
    }
  }

  const handleNewService = () => {
    setSelectedService(null)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    router.refresh()
    setDialogOpen(false)
    setSelectedService(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Serviços</h2>
        <Button
          onClick={handleNewService}
          className="bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Novo Serviço
        </Button>
      </div>

      {/* Filtro por categoria */}
      <div 
        ref={filterScrollRef}
        className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
      >
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className={`flex-shrink-0 ${filter === "all" ? "bg-[#EE8530] text-black hover:bg-[#EE8530]/90" : ""}`}
        >
          Todos
        </Button>
        <Button
          variant={filter === "one_time" ? "default" : "outline"}
          onClick={() => setFilter("one_time")}
          className={`flex-shrink-0 ${filter === "one_time" ? "bg-[#EE8530] text-black hover:bg-[#EE8530]/90" : ""}`}
        >
          Pagamento Único
        </Button>
        <Button
          variant={filter === "subscription" ? "default" : "outline"}
          onClick={() => setFilter("subscription")}
          className={`flex-shrink-0 ${filter === "subscription" ? "bg-[#EE8530] text-black hover:bg-[#EE8530]/90" : ""}`}
        >
          Assinatura
        </Button>
      </div>

      {/* Grid de serviços */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredServices.length === 0 ? (
          <div className="col-span-full text-center text-gray-400">
            Nenhum serviço encontrado
          </div>
        ) : (
          filteredServices.map((service) => (
            <Card key={service.id} className="bg-[#1A1B1F] border-gray-800">
              <CardContent className="p-4 space-y-3">
                {/* Header com ações */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">
                      {service.name}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(service)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(service.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Informações minimalistas */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Valor:</span>
                    <span className="font-semibold text-white">
                      {Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(service.price))}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Forma de pagamento:</span>
                    <span className="font-semibold text-white">
                      {service.isSubscription ? "Assinatura" : "Único"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Duração:</span>
                    <span className="font-semibold text-white">
                      {service.duration} min
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status:</span>
                    <Badge
                      className={
                        service.isActive
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                      }
                    >
                      {service.isActive ? "Ativo" : "Desativado"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AdminServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={selectedService}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}

export default AdminServicesTab
