import { PrismaAdapter } from "@auth/prisma-adapter"
import { AuthOptions } from "next-auth"
import { db } from "./prisma"
import { Adapter } from "next-auth/adapters"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Em desenvolvimento, SEMPRE usar localhost, ignorando NEXTAUTH_URL se for de produção
if (process.env.NODE_ENV === "development") {
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")) {
    // Se NEXTAUTH_URL está definido com domínio de produção, ignorar em desenvolvimento
    delete process.env.NEXTAUTH_URL
  }
  // Forçar localhost em desenvolvimento
  if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = "http://localhost:3000"
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID as string,
      clientSecret: process.env.APPLE_SECRET as string,
    }),
    CredentialsProvider({
      name: "Email e Senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha são obrigatórios")
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error("Credenciais inválidas")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Credenciais inválidas")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signIn({ user, account }) {
      // Quando usuário faz login (OAuth ou Credentials), migrar dados do Client
      if (user?.email) {
        const existingClient = await db.client.findFirst({
          where: { email: user.email },
        })

        if (existingClient && user.id) {
          // Migrar bookings do Client para o User
          await db.booking.updateMany({
            where: {
              clientId: existingClient.id,
              userId: null, // Apenas migrar os que não têm userId
            },
            data: {
              userId: user.id,
            },
          })
        }
      }
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Sempre usar localhost em desenvolvimento, mesmo que baseUrl seja de produção
      const isDevelopment = process.env.NODE_ENV === "development"
      const localhostUrl = "http://localhost:3000"
      
      if (isDevelopment) {
        // Se a URL é relativa, adicionar localhost
        if (url.startsWith("/")) {
          return `${localhostUrl}${url}`
        }
        // Se a URL já é localhost, manter
        if (url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
          return url
        }
        // Se a URL contém domínio de produção, substituir por localhost
        if (url.includes("popupsystem.com.br") || url.includes("seu-dominio.com") || url.includes("://")) {
          // Extrair apenas o path da URL e adicionar localhost
          try {
            const urlObj = new URL(url)
            return `${localhostUrl}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
          } catch {
            // Se não conseguir fazer parse, substituir o domínio
            return url.replace(/https?:\/\/[^/]+/, localhostUrl)
          }
        }
        // Para outras URLs, usar localhost como base
        return `${localhostUrl}${url.replace(baseUrl, "")}`
      }
      // Em produção, usar comportamento padrão
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`
      }
      if (new URL(url).origin === baseUrl) {
        return url
      }
      return baseUrl
    },
    async session({ session, user, token }) {
      if (session.user) {
        session.user = {
          ...session.user,
          id: (user?.id || token.id || token.sub) as string,
          name: (user?.name || token.name || session.user.name) as string,
        } as any
      }
      return session
    },
    async jwt({ token, user, account }) {
      // Para OAuth providers, usar o adapter
      if (account && user) {
        token.id = user.id
        token.name = user.name
        
        // Migrar dados do Client quando faz login com OAuth
        if (user.email) {
          const existingClient = await db.client.findFirst({
            where: { email: user.email },
          })

          if (existingClient) {
            await db.booking.updateMany({
              where: {
                clientId: existingClient.id,
                userId: null,
              },
              data: {
                userId: user.id,
              },
            })
          }
        }
      }
      // Para credentials, o user já vem no primeiro callback
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
  },
  session: {
    strategy: "jwt", // Usar JWT para suportar tanto OAuth quanto Credentials
    maxAge: 365 * 24 * 60 * 60, // 1 ano - sessão infinita
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // 1 ano - token JWT
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.NEXT_AUTH_SECRET,
  // Forçar localhost em desenvolvimento, ignorando NEXTAUTH_URL se estiver definido
  ...(process.env.NODE_ENV === "development" ? {
    url: "http://localhost:3000",
  } : {}),
}
