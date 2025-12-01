import { format } from "date-fns"
import { Card, CardContent } from "./ui/card"
import { Barbershop, BarbershopService } from "@prisma/client"
import { ptBR } from "date-fns/locale"

interface BookingSummaryProps {
  service: Pick<BarbershopService, "name" | "price">
  barbershop: Pick<Barbershop, "name">
  selectedDate: Date
}

const BookingSummary = ({
  service,
  barbershop,
  selectedDate,
}: BookingSummaryProps) => {
  return (
    <Card>
      <CardContent className="space-y-2 md:space-y-3 p-3 md:p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm md:text-base truncate flex-1 min-w-0 pr-2">{service.name}</h2>
          <p className="text-xs md:text-sm font-bold flex-shrink-0">
            {Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(service.price))}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[10px] md:text-sm text-gray-400">Data</h2>
          <p className="text-[10px] md:text-sm truncate ml-2 text-right">{format(selectedDate, "d 'de' MMMM", {
            locale: ptBR,
          })}</p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[10px] md:text-sm text-gray-400">Horário</h2>
          <p className="text-[10px] md:text-sm">{format(selectedDate, "HH:mm")}</p>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[10px] md:text-sm text-gray-400">Estabelecimento</h2>
          <p className="text-[10px] md:text-sm truncate ml-2 text-right">{barbershop.name}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default BookingSummary
