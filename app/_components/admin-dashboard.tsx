"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Plus, Users, Calendar, CreditCard, Settings, ChevronLeft, ChevronRight, Building2, BarChart3 } from "lucide-react"
import AdminServicesTab from "./admin-services-tab"
import AdminProfessionalsTab from "./admin-professionals-tab"
import AdminSubscriptionsTab from "./admin-subscriptions-tab"
import AdminBookingsTab from "./admin-bookings-tab"
import AdminBusinessProfileTab from "./admin-business-profile-tab"
import AdminOverviewTab from "./admin-overview-tab"

interface AdminDashboardProps {
  services: any[]
  professionals: any[]
  subscriptions: any[]
  bookings: any[]
  barbershop: any
  monthlyStats: any[]
  yearlyStats: any[]
}

const AdminDashboard = ({
  services,
  professionals,
  subscriptions,
  bookings,
  barbershop,
  monthlyStats,
  yearlyStats,
}: AdminDashboardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const tabs = [
    { value: "overview", label: "Visão geral", icon: BarChart3 },
    { value: "business", label: "Perfil Empresarial", icon: Building2 },
    { value: "services", label: "Serviços", icon: Settings },
    { value: "professionals", label: "Profissionais", icon: Users },
    { value: "subscriptions", label: "Assinaturas", icon: CreditCard },
    { value: "bookings", label: "Agendamentos", icon: Calendar },
  ]
  
  // Em mobile: mostrar 2 por vez, em desktop: mostrar todos
  const itemsPerPage = 2
  const maxIndex = Math.max(0, tabs.length - itemsPerPage)
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }
  
  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))
  }
  
  // Em mobile: mostrar apenas os tabs visíveis, em desktop: mostrar todos
  const visibleTabs = tabs.slice(currentIndex, currentIndex + itemsPerPage)

  return (
    <div className="min-h-screen bg-background p-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-gray-400">Gerencie serviços, profissionais e agendamentos</p>
        </div>

        <Tabs defaultValue="overview" className="w-full" onValueChange={(value) => {
          // Quando muda para uma aba, disparar evento para forçar atualização
          if (value === "overview") {
            window.dispatchEvent(new CustomEvent("overview-tab-activated"))
          } else if (value === "bookings") {
            window.dispatchEvent(new CustomEvent("bookings-tab-activated"))
          }
        }}>
          <TabsList className="relative flex items-center gap-2 overflow-hidden !p-0 md:flex-wrap md:overflow-visible md:gap-3">
            {/* Botões de navegação - apenas em mobile */}
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="h-10 w-10 flex-shrink-0 md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Tabs - em mobile mostra apenas os visíveis, em desktop mostra todos */}
            <div className="flex-1 flex gap-2 overflow-hidden md:flex-1 md:flex-wrap md:overflow-visible md:gap-3">
              {/* Em mobile: mostrar apenas visibleTabs, em desktop: mostrar todos */}
              <div className="hidden md:flex md:flex-wrap md:gap-3 md:w-full">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="md:flex-shrink-0 data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:scale-95 data-[state=active]:px-2.5 data-[state=active]:py-1.5"
                    >
                      <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  )
                })}
              </div>
              
              {/* Versão mobile: mostrar apenas visibleTabs com paginação */}
              <div className="flex gap-2 md:hidden w-full">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-1 min-w-0 basis-[calc(50%-0.25rem)] data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:scale-95 data-[state=active]:px-2.5 data-[state=active]:py-1.5"
                    >
                      <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  )
                })}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="h-10 w-10 flex-shrink-0 md:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AdminOverviewTab monthlyStats={monthlyStats} yearlyStats={yearlyStats} allBookings={bookings} />
          </TabsContent>

          <TabsContent value="business" className="mt-6">
            <AdminBusinessProfileTab barbershop={barbershop} />
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <AdminServicesTab services={services} />
          </TabsContent>

          <TabsContent value="professionals" className="mt-6">
            <AdminProfessionalsTab professionals={professionals} services={services} barbershop={barbershop} />
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-6">
            <AdminSubscriptionsTab subscriptions={subscriptions} />
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            <AdminBookingsTab bookings={bookings} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default AdminDashboard

