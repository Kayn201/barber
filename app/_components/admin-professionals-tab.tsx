"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Plus, Edit, Trash2, Star } from "lucide-react"
import Image from "next/image"
import AdminProfessionalDialog from "./admin-professional-dialog"
import { deleteProfessional } from "../_actions/admin/delete-professional"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface AdminProfessionalsTabProps {
  professionals: any[]
  services: any[]
  barbershop: any
}

const AdminProfessionalsTab = ({ professionals, services, barbershop }: AdminProfessionalsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null)
  const router = useRouter()

  const handleEdit = (professional: any) => {
    setSelectedProfessional(professional)
    setDialogOpen(true)
  }

  const handleDelete = async (professionalId: string) => {
    if (!confirm("Tem certeza que deseja excluir este profissional?")) return

    const result = await deleteProfessional(professionalId)
    if (result.success) {
      toast.success("Profissional excluído com sucesso!")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir profissional")
    }
  }

  const handleNewProfessional = () => {
    setSelectedProfessional(null)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    router.refresh()
    setDialogOpen(false)
    setSelectedProfessional(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Profissionais</h2>
        <Button
          onClick={handleNewProfessional}
          className="bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {professionals.length === 0 ? (
          <div className="col-span-full text-center text-gray-400">
            Nenhum profissional cadastrado
          </div>
        ) : (
          professionals.map((professional) => {
            const averageRating =
              professional.ratings.length > 0
                ? professional.ratings.reduce(
                    (sum: number, r: any) => sum + r.score,
                    0
                  ) / professional.ratings.length
                : 0

            return (
              <Card key={professional.id} className="bg-[#1A1B1F] border-gray-800">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <Image
                        src={professional.imageUrl}
                        alt={professional.name}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg text-white">{professional.name}</CardTitle>
                      <p className="text-sm text-gray-400">{professional.profession}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(professional)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(professional.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-[#EE8530] text-[#EE8530]" />
                      <span className="text-sm font-semibold text-white">
                        {averageRating > 0 ? averageRating.toFixed(1) : "Sem avaliações"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {professional._count?.bookings || 0} agendamentos
                    </p>
                    <p className="text-xs text-gray-400">
                      {professional.services?.length || 0} serviços oferecidos
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AdminProfessionalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        professional={selectedProfessional}
        services={services}
        barbershop={barbershop}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}

export default AdminProfessionalsTab

