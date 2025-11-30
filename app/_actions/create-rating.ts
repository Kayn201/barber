"use server"

import { revalidatePath } from "next/cache"
import { db } from "../_lib/prisma"

interface CreateRatingParams {
  bookingId: string
  professionalId: string
  score: number
  comment?: string
}

export const createRating = async (params: CreateRatingParams) => {
  // Verificar se já existe avaliação para este booking
  const existingRating = await db.rating.findUnique({
    where: {
      bookingId: params.bookingId,
    },
  })

  if (existingRating) {
    throw new Error("Este agendamento já foi avaliado")
  }

  // Criar avaliação
  const rating = await db.rating.create({
    data: {
      bookingId: params.bookingId,
      professionalId: params.professionalId,
      score: params.score,
      comment: params.comment,
    },
  })

  // Atualizar status do booking para completed se ainda não estiver e vincular rating
  await db.booking.update({
    where: {
      id: params.bookingId,
    },
    data: {
      status: "completed",
      ratingId: rating.id,
    },
  })

  revalidatePath("/")
  revalidatePath("/bookings")
  revalidatePath("/admin")
}

