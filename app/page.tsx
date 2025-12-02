import Header from "./_components/header"
import { Button } from "./_components/ui/button"
import { Card, CardContent } from "./_components/ui/card"
import { db } from "./_lib/prisma"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cookies } from "next/headers"
import ProfessionalItem from "./_components/professional-item"
import ActiveBookingsSection from "./_components/active-bookings-section"
import RatingCheck from "./_components/rating-check"
import AddToWalletButton from "./_components/add-to-wallet-button"
import BookingPolling from "./_components/booking-polling"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "./_lib/auth"
import { Prisma } from "@prisma/client"
import { redirect } from "next/navigation"

interface HomeProps {
  searchParams: {
    service?: string
    clientId?: string
  }
}

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    service: true
    professional: true
    client: true
  }
}>

const Home = async ({ searchParams }: HomeProps) => {
  // Buscar todos os serviços
  const services = await db.barbershopService.findMany({
    orderBy: {
      name: "asc",
    },
  })

  // Encontrar o serviço selecionado pelo nome
  const selectedService = searchParams.service
    ? await db.barbershopService.findFirst({
        where: {
          name: {
            equals: searchParams.service,
            mode: "insensitive",
          },
        },
      })
    : null

  // Buscar profissionais (filtrar por serviço se fornecido)
  const professionals = await db.professional.findMany({
    where: selectedService
      ? {
          services: {
            some: {
              serviceId: selectedService.id,
            },
          },
        }
      : undefined,
    include: {
      ratings: true,
      services: {
        include: {
          service: true,
        },
      },
    },
  })

  // Calcular média de avaliações para cada profissional
  const professionalsWithRating = professionals.map((professional) => {
    const ratings = professional.ratings
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : 0

    return {
      ...professional,
      averageRating,
    }
  })

  // Buscar barbearia para pegar a logo e informações
  const barbershop = await db.barbershop.findFirst({
    select: {
      id: true,
      name: true,
      address: true,
      imageUrl: true,
      phones: true,
    },
  })

  // Buscar usuário logado
  const session = await getServerSession(authOptions)
  const user = session?.user

  // Buscar agendamento ativo (priorizar usuário logado, depois cliente via cookie ou URL)
  const clientIdFromUrl = searchParams.clientId
  const clientIdFromCookie = cookies().get("clientId")?.value
  const clientEmailFromCookie = cookies().get("clientEmail")?.value
  
  let clientId = clientIdFromUrl || clientIdFromCookie
  
  // Se não tem clientId mas tem email no cookie, buscar clientId pelo email
  if (!clientId && clientEmailFromCookie) {
    const clientByEmail = await db.client.findFirst({
      where: { email: clientEmailFromCookie },
      select: { id: true },
    })
    if (clientByEmail) {
      clientId = clientByEmail.id
      // Redirecionar para route handler que salva o cookie
      redirect(`/api/save-client-cookie?clientId=${clientByEmail.id}`)
    }
  }
  
  // Se veio clientId na URL, redirecionar para route handler que salva o cookie
  if (clientIdFromUrl) {
    // Buscar email do cliente para salvar também
    const clientForEmail = await db.client.findUnique({
      where: { id: clientIdFromUrl },
      select: { email: true },
    })
    
    if (clientForEmail?.email) {
      redirect(`/api/save-client-cookie?clientId=${clientIdFromUrl}`)
    } else {
      redirect(`/api/save-client-cookie?clientId=${clientIdFromUrl}`)
    }
  }
  
  let client = null
  const now = new Date()
  let upcomingBookings: BookingWithRelations[] = []

  const bookingInclude = {
    service: true,
    professional: true,
    client: true,
    payment: true,
  }

  if (user && (user as any).id) {
    upcomingBookings = await db.booking.findMany({
      where: {
        userId: (user as any).id,
        status: "confirmed",
        isRefunded: false,
        date: {
          gte: now,
        },
      },
      include: bookingInclude,
      orderBy: {
        date: "asc",
      },
    })
  }

  if (!upcomingBookings.length && clientId) {
    upcomingBookings = await db.booking.findMany({
      where: {
        clientId,
        status: "confirmed",
        isRefunded: false,
        date: {
          gte: now,
        },
      },
      include: bookingInclude,
      orderBy: {
        date: "asc",
      },
    })

    client = await db.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    })
  }

  // Se ainda não encontrou agendamentos e tem email no cookie, tentar buscar pelo email
  // (pode ser que o webhook já tenha criado o cliente mas ainda não temos o clientId salvo)
  if (!upcomingBookings.length && !clientId && clientEmailFromCookie) {
    // Primeiro tentar buscar cliente pelo email
    const clientByEmail = await db.client.findFirst({
      where: { email: clientEmailFromCookie },
      include: {
        bookings: {
          where: {
            status: "confirmed",
            isRefunded: false,
            date: {
              gte: now,
            },
          },
          include: bookingInclude,
          orderBy: {
            date: "asc",
          },
        },
      },
    })

    if (clientByEmail) {
      if (clientByEmail.bookings.length > 0) {
        upcomingBookings = clientByEmail.bookings as BookingWithRelations[]
        client = { name: clientByEmail.name }
        // Redirecionar para salvar o clientId no cookie
        redirect(`/api/save-client-cookie?clientId=${clientByEmail.id}`)
      } else {
        // Cliente existe mas não tem bookings ainda - salvar clientId mesmo assim
        redirect(`/api/save-client-cookie?clientId=${clientByEmail.id}`)
      }
    } else {
      // Cliente não existe ainda - pode ser que o webhook ainda não processou
      // Buscar bookings diretamente pelo email do client (join)
      const bookingsByClientEmail = await db.booking.findMany({
        where: {
          client: {
            email: clientEmailFromCookie,
          },
          status: "confirmed",
          isRefunded: false,
          date: {
            gte: now,
          },
        },
        include: bookingInclude,
        orderBy: {
          date: "asc",
        },
      })

      if (bookingsByClientEmail.length > 0) {
        upcomingBookings = bookingsByClientEmail as BookingWithRelations[]
        // Buscar cliente do primeiro booking
        if (bookingsByClientEmail[0].clientId) {
          const foundClient = await db.client.findUnique({
            where: { id: bookingsByClientEmail[0].clientId },
            select: { name: true },
          })
          if (foundClient) {
            client = { name: foundClient.name }
          }
          redirect(`/api/save-client-cookie?clientId=${bookingsByClientEmail[0].clientId}`)
        }
      }
    }
  }

  // Determinar saudação - priorizar nome do usuário logado
  const greeting = user?.name 
    ? `Olá, ${user.name}!` 
    : client?.name 
      ? `Olá, ${client.name}!` 
      : "Olá!"

  // Verificar se tem email mas não tem bookings (webhook pode estar processando)
  const hasEmail = !!(clientEmailFromCookie || user?.email)
  const hasBookings = upcomingBookings.length > 0

  return (
    <div>
      <Header />
      <RatingCheck />
      <BookingPolling hasEmail={hasEmail} hasBookings={hasBookings} />
      <div className="p-3 md:p-5">
        {/* SAUDAÇÃO */}
        <p className="mb-1.5 md:mb-2 text-lg md:text-xl font-bold text-white">
          {greeting}
        </p>

        {/* DATA */}
        <p className="text-xs md:text-sm text-gray-400">
          <span className="capitalize">
            {format(new Date(), "EEEE, dd", { locale: ptBR })}
          </span>
          <span>&nbsp;de&nbsp;</span>
          <span className="capitalize">
            {format(new Date(), "MMMM", { locale: ptBR })}
          </span>
        </p>

        {/* TEXTO PRINCIPAL */}
        <p className="mt-1.5 md:mt-2 text-xs md:text-sm text-gray-400">
          Agende e pague em segundos. Sem burocracia!
        </p>

        {/* SEÇÃO DE AGENDAMENTOS */}
        <div className="mt-4 md:mt-6">
          {/* Linha separadora acima de AGENDAMENTOS */}
          <div className="mb-2 md:mb-3 border-b border-solid"></div>
          <div className="mb-2 md:mb-3 flex items-center justify-between">
            <h2 className="text-[10px] md:text-xs font-bold uppercase text-gray-400">
              AGENDAMENTOS
            </h2>
            {/* Botão Wallet - somente iPhone, somente se tiver agendamento confirmado */}
            {upcomingBookings.length > 0 && upcomingBookings[0].status === "confirmed" && (
              <AddToWalletButton
                bookingId={upcomingBookings[0].id}
                hasWalletPass={!!upcomingBookings[0].walletPassUrl}
              />
            )}
          </div>
          
          {upcomingBookings.length > 0 ? (
            <ActiveBookingsSection
              bookings={JSON.parse(JSON.stringify(upcomingBookings))}
              barbershop={barbershop ? JSON.parse(JSON.stringify(barbershop)) : undefined}
            />
          ) : (
            <Card className="bg-[#1A1B1F] rounded-xl md:rounded-2xl border border-gray-800">
              <CardContent className="p-3 md:p-4">
                {/* Badge Sem agendamento */}
                <div className="mb-3 md:mb-4">
                  <span className="inline-block rounded-full bg-[#EE8530] px-2.5 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold text-white shadow-sm">
                    Sem agendamento
                  </span>
                </div>

                {/* Conteúdo principal */}
                <p className="text-sm md:text-base font-semibold text-white leading-relaxed">
                  Nenhum agendamento, vamos agendar?
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Linha separadora abaixo do card de agendamentos */}
          <div className="mt-4 md:mt-6 border-b border-solid"></div>
        </div>

        {/* BOTÕES DE SERVIÇOS - Filtros */}
        {services.length > 0 && (
          <div className="mt-4 md:mt-6 flex gap-2 md:gap-3 overflow-x-scroll [&::-webkit-scrollbar]:hidden">
            {services.map((service) => {
              const isActive = searchParams.service === service.name
              return (
                <Card
                  key={service.id}
                  className={`min-w-[75px] md:min-w-[90px] rounded-lg md:rounded-xl flex-shrink-0 ${
                    isActive ? "bg-[#EE8530]" : "bg-[#1A1B1F]"
                  }`}
                >
                  <CardContent className="px-3 md:px-4 py-1.5 md:py-2">
                    <Button
                      variant="ghost"
                      className={`h-auto p-0 text-xs md:text-sm font-bold hover:bg-transparent w-full text-center ${
                        isActive ? "text-black" : "text-white"
                      }`}
                      size="sm"
                      asChild
                    >
                      <Link
                        href={
                          isActive
                            ? "/"
                            : `/?service=${encodeURIComponent(service.name)}`
                        }
                      >
                        {service.name}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* PROFISSIONAIS */}
        <h2 className="mb-2 md:mb-3 mt-4 md:mt-6 text-[10px] md:text-xs font-bold uppercase text-gray-400">
          Nossos profissionais
        </h2>
        <div className="flex gap-3 md:gap-4 overflow-auto [&::-webkit-scrollbar]:hidden">
          {professionalsWithRating.map((professional) => (
            <ProfessionalItem
              key={professional.id}
              professional={JSON.parse(JSON.stringify(professional))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home

