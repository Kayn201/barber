/**
 * Obtém a URL base do sistema
 * Prioriza variáveis de ambiente de produção
 */
export function getBaseUrl(): string {
  // Em produção, sempre usar URL de produção
  const isProduction = process.env.NODE_ENV === "production"
  
  // Prioridade: NEXT_PUBLIC_BASE_URL > NEXT_PUBLIC_APP_URL > NEXTAUTH_URL
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://popupsystem.com.br" // Fallback para URL de produção
  
  // Em desenvolvimento, forçar localhost
  const isDevelopment = process.env.NODE_ENV === "development" ||
                        process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ||
                        process.env.NEXTAUTH_URL?.includes("localhost")
  
  if (isDevelopment) {
    return "http://localhost:3000"
  }
  
  // Em produção, garantir que não use localhost
  if (isProduction && baseUrl.includes("localhost")) {
    console.warn("⚠️ Aviso: URL contém localhost em produção, usando fallback")
    return "https://popupsystem.com.br"
  }
  
  return baseUrl
}

