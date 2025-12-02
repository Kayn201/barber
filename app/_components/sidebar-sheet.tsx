"use client"

import { Button } from "./ui/button"
import { CalendarIcon, HomeIcon, LogOut, LogIn, CreditCard } from "lucide-react"
import { SheetClose, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import AuthDialog from "./auth-dialog"

interface Service {
  id: string
  name: string
}

const SidebarSheet = () => {
  const [services, setServices] = useState<Service[]>([])
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    // Buscar serviços do banco de dados
    const fetchServices = async () => {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    }
    fetchServices()
  }, [])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="text-left">Menu</SheetTitle>
        {session?.user?.name && (
          <p className="text-sm text-gray-400 mt-1">
            Olá, {session.user.name}
          </p>
        )}
      </SheetHeader>

      {/* Botão de Login ou Logout */}
      <div className="border-b border-solid py-3">
        {session?.user ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            Sair da conta
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-[#EE8530] hover:text-[#EE8530]/90 hover:bg-[#EE8530]/10"
            onClick={() => setAuthDialogOpen(true)}
          >
            <LogIn size={18} />
            Entrar / Criar conta
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b border-solid py-5">
        <SheetClose asChild>
          <Button className="justify-start gap-2" variant="ghost" asChild>
            <Link href="/">
              <HomeIcon size={18} />
              Início
            </Link>
          </Button>
        </SheetClose>
        <Button className="justify-start gap-2" variant="ghost" asChild>
          <Link href="/bookings">
            <CalendarIcon size={18} />
            Agendamentos
          </Link>
        </Button>
        {session?.user && (
          <Button className="justify-start gap-2" variant="ghost" asChild>
            <Link href="/subscriptions">
              <CreditCard size={18} />
              Assinaturas
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b border-solid py-5">
        {services.map((service) => (
          <SheetClose key={service.id} asChild>
            <Button className="justify-start gap-2" variant="ghost" asChild>
              <Link href={`/?service=${encodeURIComponent(service.name)}`}>
                {service.name}
              </Link>
            </Button>
          </SheetClose>
        ))}
      </div>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        isSubscription={false}
      />
    </SheetContent>
  )
}

export default SidebarSheet
