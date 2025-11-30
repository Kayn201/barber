import { Professional, Rating } from "@prisma/client"
import { Card, CardContent } from "./ui/card"
import Image from "next/image"
import { Button } from "./ui/button"
import { StarIcon } from "lucide-react"
import Link from "next/link"

interface ProfessionalItemProps {
  professional: Professional & {
    ratings: Rating[]
    averageRating: number
  }
}

const ProfessionalItem = ({ professional }: ProfessionalItemProps) => {
  const averageRating = professional.averageRating || 0

  return (
    <Card className="min-w-[167px] rounded-2xl bg-[#1A1B1F]">
      <CardContent className="p-0 px-1 pt-1">
        {/* IMAGEM */}
        <div className="relative h-[159px] w-full">
          <Image
            alt={professional.name}
            fill
            className="rounded-2xl object-cover"
            src={professional.imageUrl}
          />

          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1">
            <StarIcon size={12} className="fill-[#EE8530] text-[#EE8530]" />
            <p className="text-xs font-semibold text-white">
              {averageRating > 0 ? averageRating.toFixed(1) : "Novo"}
            </p>
          </div>
        </div>

        {/* TEXTO */}
        <div className="px-1 py-3">
          <h3 className="truncate font-semibold">{professional.name}</h3>
          <p className="truncate text-sm text-gray-400">
            {professional.profession}
          </p>
          <Button
            className="mt-3 w-full bg-[#EE8530] text-white hover:bg-[#EE8530]/90"
            asChild
          >
            <Link href={`/book?professional=${professional.id}`}>
              Reservar
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProfessionalItem

