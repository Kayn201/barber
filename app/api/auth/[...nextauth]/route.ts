import { authOptions } from "@/app/_lib/auth"
import NextAuth from "next-auth"

// Em desenvolvimento, forçar uso de localhost
if (process.env.NODE_ENV === "development") {
  // Sobrescrever NEXTAUTH_URL se estiver definido com domínio de produção
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")) {
    process.env.NEXTAUTH_URL = "http://localhost:3000"
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
