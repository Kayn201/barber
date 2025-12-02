/**
 * Obtém a URL base do sistema
 * Prioriza variáveis de ambiente de produção
 */
export function getBaseUrl(): string {
  // Em produção, sempre usar URL de produção
  const isProduction = process.env.NODE_ENV === "production"
  
  // Prioridade: NEXT_PUBLIC_BASE_URL > NEXT_PUBLIC_APP_URL > NEXTAUTH_URL
  let baseUrl =
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
  
  // Em produção, SEMPRE garantir que não use localhost
  // Mesmo que as variáveis de ambiente tenham localhost, usar fallback
  if (isProduction) {
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      console.warn("⚠️ Aviso: URL contém localhost em produção, usando fallback")
      return "https://popupsystem.com.br"
    }
    // Garantir que está usando HTTPS em produção
    if (!baseUrl.startsWith("https://")) {
      console.warn("⚠️ Aviso: URL não usa HTTPS em produção, usando fallback")
      return "https://popupsystem.com.br"
    }
  }
  
  return baseUrl
}

