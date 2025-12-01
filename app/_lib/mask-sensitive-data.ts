/**
 * Funções para mascarar dados sensíveis antes de enviar para o cliente
 * Isso garante que mesmo se alguém interceptar os dados, informações sensíveis estarão protegidas
 */

/**
 * Mascara um email, mostrando apenas as primeiras letras e o domínio
 * Exemplo: "joao@example.com" -> "jo***@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "N/A"
  
  const [localPart, domain] = email.split("@")
  if (!localPart || !domain) return email
  
  // Se o local part tem 2 ou menos caracteres, mostrar apenas o primeiro
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`
  }
  
  // Mostrar primeiros 2 caracteres e mascarar o resto
  const visible = localPart.substring(0, 2)
  return `${visible}***@${domain}`
}

/**
 * Mascara um ID do Stripe, mostrando apenas os primeiros e últimos caracteres
 * Exemplo: "pi_1234567890abcdef" -> "pi_12***cdef"
 */
export function maskStripeId(stripeId: string | null | undefined): string {
  if (!stripeId) return "N/A"
  
  if (stripeId.length <= 8) return "***"
  
  const prefix = stripeId.substring(0, 4)
  const suffix = stripeId.substring(stripeId.length - 4)
  return `${prefix}***${suffix}`
}

/**
 * Mascara um número de telefone, mostrando apenas os últimos 4 dígitos
 * Exemplo: "(11) 98765-4321" -> "***-4321"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "N/A"
  
  // Remover caracteres não numéricos
  const digits = phone.replace(/\D/g, "")
  
  if (digits.length <= 4) return "***"
  
  const lastFour = digits.substring(digits.length - 4)
  return `***-${lastFour}`
}

