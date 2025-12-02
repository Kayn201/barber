/**
 * Obtém a URL base do sistema
 * Prioriza variáveis de ambiente de produção
 */
export function getBaseUrl(): string {
  // Prioridade: NEXT_PUBLIC_BASE_URL > NEXT_PUBLIC_APP_URL > NEXTAUTH_URL
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://popupsystem.com.br"
  )
}

