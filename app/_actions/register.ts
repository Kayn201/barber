"use server"

import { db } from "../_lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
})

export const register = async (data: {
  name: string
  email: string
  password: string
  confirmPassword: string
}) => {
  try {
    const validatedData = registerSchema.parse(data)

    // Verificar se o email já existe
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return {
        success: false,
        error: "Este email já está cadastrado",
      }
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Criar usuário
    const newUser = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
      },
    })

    // Migrar dados do Client para o User (se existir Client com mesmo email)
    const existingClient = await db.client.findFirst({
      where: { email: validatedData.email },
      include: {
        bookings: true,
        subscriptions: true,
      },
    })

    if (existingClient) {
      // Migrar bookings
      await db.booking.updateMany({
        where: {
          clientId: existingClient.id,
          userId: null, // Apenas migrar os que não têm userId
        },
        data: {
          userId: newUser.id,
        },
      })

      // Migrar subscriptions (atualizar para associar ao userId via clientId)
      // As subscriptions continuam com clientId, mas os bookings já foram migrados
      // Se necessário, podemos criar uma tabela de associação no futuro
    }

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      }
    }

    return {
      success: false,
      error: "Erro ao criar conta. Tente novamente.",
    }
  }
}

