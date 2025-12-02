import { authOptions } from "@/app/_lib/auth"
import NextAuth from "next-auth"
import { getBaseUrl } from "@/app/_lib/get-base-url"

// Usar URL de produção
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = getBaseUrl()
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
