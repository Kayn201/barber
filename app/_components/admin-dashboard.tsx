"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Plus, Users, Calendar, CreditCard, Settings, ChevronLeft, ChevronRight, Building2 } from "lucide-react"
import AdminServicesTab from "./admin-services-tab"
import AdminProfessionalsTab from "./admin-professionals-tab"
import AdminSubscriptionsTab from "./admin-subscriptions-tab"
import AdminBookingsTab from "./admin-bookings-tab"
import AdminBusinessProfileTab from "./admin-business-profile-tab"

interface AdminDashboardProps {
  services: any[]
  professionals: any[]
  subscriptions: any[]
  bookings: any[]
  barbershop: any
}

const AdminDashboard = ({
  services,
  professionals,
  subscriptions,
  bookings,
  barbershop,
}: AdminDashboardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const tabs = [
    { value: "business", label: "Perfil Empresarial", icon: Building2 },
    { value: "services", label: "Serviços", icon: Settings },
    { value: "professionals", label: "Profissionais", icon: Users },
    { value: "subscriptions", label: "Assinaturas", icon: CreditCard },
    { value: "bookings", label: "Agendamentos", icon: Calendar },
  ]
  
  const itemsPerPage = 2
  const maxIndex = Math.max(0, tabs.length - itemsPerPage)
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }
  
  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))
  }
  
  const visibleTabs = tabs.slice(currentIndex, currentIndex + itemsPerPage)

  return (
    <div className="min-h-screen bg-background p-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-gray-400">Gerencie serviços, profissionais e agendamentos</p>
        </div>

        <Tabs defaultValue="business" className="w-full">
          <TabsList className="relative flex items-center gap-2 overflow-hidden !p-0 md:overflow-x-auto md:gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="h-10 w-10 flex-shrink-0 md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 flex gap-2 overflow-hidden md:flex-none md:overflow-visible md:gap-3">
              {(visibleTabs.length > 0 ? visibleTabs : tabs).map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-1 min-w-0 basis-[calc(50%-0.25rem)] md:basis-auto md:flex-shrink-0 data-[state=active]:bg-[#EE8530] data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:scale-95 data-[state=active]:px-2.5 data-[state=active]:py-1.5"
                  >
                    <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                )
              })}
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

          <TabsContent value="business" className="mt-6">
            <AdminBusinessProfileTab barbershop={barbershop} />
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <AdminServicesTab services={services} />
          </TabsContent>

          <TabsContent value="professionals" className="mt-6">
            <AdminProfessionalsTab professionals={professionals} services={services} />
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

