"use client"

import { useState, useEffect } from "react"
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
  LinkAuthenticationElement,
} from "@stripe/react-stripe-js"
import type { StripeElementsOptions } from "@stripe/stripe-js"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card, CardContent } from "./ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { signIn, useSession } from "next-auth/react"
import { CreditCard, Smartphone, Apple, Chrome } from "lucide-react"

interface CheckoutFormProps {
  professional: {
    id: string
    name: string
    profession: string
    imageUrl: string
  }
  service: {
    id: string
    name: string
    price: number
    duration: number
    isSubscription: boolean
  }
  date: Date
  amount: number
  stripePromise: Promise<any>
}

const CheckoutFormInner = ({
  professional,
  service,
  date,
  amount,
  clientSecret,
  isIPhone,
  isAndroid,
  isSubscription,
  onBack,
}: {
  professional: CheckoutFormProps["professional"]
  service: CheckoutFormProps["service"]
  date: Date
  amount: number
  clientSecret: string
  isIPhone: boolean
  isAndroid: boolean
  isSubscription: boolean
  onBack: () => void
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [showAuth, setShowAuth] = useState(isSubscription && !session)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)

  useEffect(() => {
    // Se o usuário fizer login, esconder a seção de autenticação
    if (session && isSubscription) {
      setShowAuth(false)
    }
  }, [session, isSubscription])

  useEffect(() => {
    console.log("CheckoutFormInner - Estado:", {
      stripe: !!stripe,
      elements: !!elements,
      clientSecret: !!clientSecret,
    })
  }, [stripe, elements, clientSecret])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setIsLoading(true)

    try {
      // Usar o email do estado (o LinkAuthenticationElement gerencia internamente)
      // O Stripe Elements gerencia os billing details automaticamente
      let customerEmail = email
      let customerName = ""

      // Confirmar pagamento
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
          payment_method_data: {
            billing_details: {
              name: customerName,
              email: customerEmail,
            },
          },
        },
        redirect: "if_required",
      })

      if (error) {
        toast.error(error.message || "Erro ao processar pagamento")
        setIsLoading(false)
        return
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Criar booking via API
        const response = await fetch("/api/create-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            professionalId: professional.id,
            serviceId: service.id,
            date: date.toISOString(),
            paymentIntentId: paymentIntent.id,
            clientName: customerName || (typeof paymentIntent.payment_method === 'object' && paymentIntent.payment_method?.billing_details?.name) || "",
            clientEmail: customerEmail || (typeof paymentIntent.payment_method === 'object' && paymentIntent.payment_method?.billing_details?.email) || "",
            clientPhone: (typeof paymentIntent.payment_method === 'object' && paymentIntent.payment_method?.billing_details?.phone) || "",
          }),
        })

        if (response.ok) {
          toast.success("Pagamento confirmado! Redirecionando...")
          router.push(`/success?payment_intent=${paymentIntent.id}`)
        } else {
          toast.error("Erro ao criar agendamento")
          setIsLoading(false)
        }
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Erro ao processar pagamento:", error)
      toast.error("Erro ao processar pagamento")
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: "google" | "apple") => {
    try {
      // Usar URL de produção
      const callbackUrl = window.location.origin
      await signIn(provider, {
        callbackUrl,
      })
    } catch (error) {
      console.error(`Erro ao fazer login com ${provider}:`, error)
      toast.error(`Erro ao fazer login com ${provider}`)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authEmail || !authPassword) {
      toast.error("Preencha email e senha")
      return
    }

    setIsCreatingAccount(true)
    try {
      // Criar conta via API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
        }),
      })

      if (response.ok) {
        // Fazer login após criar conta
        const result = await signIn("credentials", {
          email: authEmail,
          password: authPassword,
          redirect: false,
        })

        if (result?.ok) {
          setShowAuth(false)
          toast.success("Conta criada e login realizado com sucesso!")
        } else {
          toast.error("Conta criada, mas erro ao fazer login. Tente fazer login manualmente.")
        }
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao criar conta")
      }
    } catch (error) {
      console.error("Erro ao criar conta:", error)
      toast.error("Erro ao criar conta")
    } finally {
      setIsCreatingAccount(false)
    }
  }

  if (!stripe || !elements) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-400">Carregando formulário de pagamento...</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Botão Voltar */}
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className="w-full mb-4"
      >
        ← Voltar
      </Button>

      {/* Informações do Agendamento */}
      <Card className="bg-[#1A1B1F]">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-lg font-bold text-white">Resumo do Agendamento</h3>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              <img
                src={professional.imageUrl}
                alt={professional.name}
                className="rounded-full object-cover w-full h-full"
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">{professional.name}</p>
              <p className="text-sm text-gray-400">{professional.profession}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between">
              <span className="text-gray-400">Serviço:</span>
              <span className="text-white font-semibold">{service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data:</span>
              <span className="text-white font-semibold">
                {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duração:</span>
              <span className="text-white font-semibold">{service.duration} minutos</span>
            </div>
            {isSubscription && (
              <div className="flex justify-between">
                <span className="text-gray-400">Tipo:</span>
                <span className="text-white font-semibold">Assinatura Recorrente</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-800">
              <span className="text-lg font-bold text-white">Total:</span>
              <span className="text-lg font-bold text-[#EE8530]">
                R$ {amount.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autenticação para Assinaturas */}
      {isSubscription && showAuth && !session && (
        <Card className="bg-[#1A1B1F]">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-lg font-bold text-white">Criar Conta</h3>
            <p className="text-sm text-gray-400">
              Para assinaturas recorrentes, é necessário criar uma conta
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-white">
                  E-mail
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-background text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password" className="text-white">
                  Senha
                </Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  className="bg-background text-white"
                />
              </div>

              <Button
                type="submit"
                disabled={isCreatingAccount}
                className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
              >
                {isCreatingAccount ? "Criando..." : "Criar Conta"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1A1B1F] px-2 text-gray-400">Ou continue com</span>
              </div>
            </div>

            <div className={`grid gap-3 ${isIPhone ? "grid-cols-2" : "grid-cols-1"}`}>
              {isIPhone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("apple")}
                  className="flex items-center justify-center gap-2"
                >
                  <Apple className="h-5 w-5" />
                  <span>Apple</span>
                </Button>
              )}
              {(!isAndroid || isIPhone) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("google")}
                  className="flex items-center justify-center gap-2"
                >
                  <Chrome className="h-5 w-5" />
                  <span>Google</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Elementos de Pagamento do Stripe */}
      <Card className="bg-[#1A1B1F]">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-lg font-bold text-white">Seus Dados e Pagamento</h3>

          <div className="space-y-4" id="stripe-elements">
            {/* Link Authentication para email (com autocomplete) */}
            <div id="link-authentication-element">
              <LinkAuthenticationElement
                options={{
                  defaultValues: {
                    email: email,
                  },
                }}
                onChange={(e) => {
                  if (e.complete && e.value.email) {
                    setEmail(e.value.email)
                  }
                }}
              />
            </div>

            {/* Payment Element com PIX, cartão e métodos de pagamento */}
            <div id="payment-element">
              <PaymentElement
                options={{
                  layout: "tabs",
                  fields: {
                    billingDetails: {
                      name: "auto", // Nome com autocomplete
                      email: "never", // Email já vem do LinkAuthenticationElement
                      phone: "auto", // Telefone com autocomplete
                      address: "never", // Não pedir endereço
                    },
                  },
                  wallets: {
                    applePay: isIPhone ? "auto" : "never",
                    googlePay: isAndroid ? "auto" : "never",
                  },
                }}
              />
            </div>
          </div>

          {/* Métodos de Pagamento Disponíveis */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 mb-2">Métodos de pagamento disponíveis:</p>
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/50">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-400">Cartão</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/50">
                <Smartphone className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-400">PIX</span>
              </div>
              {isIPhone && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/50">
                  <Apple className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">Apple Pay</span>
                </div>
              )}
              {isAndroid && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/50">
                  <Chrome className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">Google Pay</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Pagamento */}
      <Button
        type="submit"
        disabled={!stripe || isLoading || (isSubscription && showAuth && !session)}
        className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90 font-bold text-lg py-6"
      >
        {isLoading ? "Processando..." : `Pagar R$ ${amount.toFixed(2).replace(".", ",")}`}
      </Button>
    </form>
  )
}

const CheckoutForm = ({
  professional,
  service,
  date,
  amount,
  stripePromise,
}: CheckoutFormProps) => {
  const router = useRouter()
  const [isIPhone, setIsIPhone] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isCreatingIntent, setIsCreatingIntent] = useState(false)

  useEffect(() => {
    // Detectar dispositivo
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
    const isAndroidDevice = /android/i.test(userAgent)

    setIsIPhone(isIOS)
    setIsAndroid(isAndroidDevice)
  }, [])

  const handleContinueToPayment = async () => {
    setIsCreatingIntent(true)

    try {
      // Verificar se há sessão ativa (para assinaturas)
      const sessionResponse = await fetch("/api/auth/session")
      const sessionData = await sessionResponse.json()
      const userId = sessionData?.user?.id || null

      console.log("🔄 Criando Payment Intent...")
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          professionalId: professional.id,
          serviceId: service.id,
          date: date.toISOString(),
          amount,
          clientName: "",
          clientEmail: "",
          clientPhone: "",
          userId: service.isSubscription ? userId : null, // Só enviar userId se for assinatura
        }),
      })

      console.log("📡 Response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ Erro na resposta:", errorData)
        throw new Error(errorData.error || "Erro ao criar Payment Intent")
      }

      const data = await response.json()
      console.log("✅ Payment Intent criado:", {
        hasClientSecret: !!data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      })

      setClientSecret(data.clientSecret)
      setShowPayment(true)
    } catch (error) {
      console.error("❌ Erro ao criar Payment Intent:", error)
      toast.error("Erro ao preparar pagamento. Tente novamente.")
    } finally {
      setIsCreatingIntent(false)
    }
  }

  if (!showPayment || !clientSecret) {
    return (
      <div className="space-y-6">
        {/* Botão Voltar */}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/")}
          className="w-full mb-4"
        >
          ← Voltar
        </Button>

        {/* Informações do Agendamento */}
        <Card className="bg-[#1A1B1F]">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-lg font-bold text-white">Resumo do Agendamento</h3>

            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0">
                <img
                  src={professional.imageUrl}
                  alt={professional.name}
                  className="rounded-full object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">{professional.name}</p>
                <p className="text-sm text-gray-400">{professional.profession}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-400">Serviço:</span>
                <span className="text-white font-semibold">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Data:</span>
                <span className="text-white font-semibold">
                  {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duração:</span>
                <span className="text-white font-semibold">{service.duration} minutos</span>
              </div>
              {service.isSubscription && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo:</span>
                  <span className="text-white font-semibold">Assinatura Recorrente</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-lg font-bold text-white">Total:</span>
                <span className="text-lg font-bold text-[#EE8530]">
                  R$ {amount.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão Continuar para Pagamento */}
        <Button
          type="button"
          onClick={handleContinueToPayment}
          disabled={isCreatingIntent}
          className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90 font-bold text-lg py-6"
        >
          {isCreatingIntent ? "Carregando..." : "Continuar para Pagamento"}
        </Button>
      </div>
    )
  }

  const handleBackFromPayment = () => {
    setShowPayment(false)
    setClientSecret(null)
  }

  if (!clientSecret) {
    return null
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#EE8530",
        colorBackground: "#1A1B1F",
        colorText: "#FFFFFF",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
      },
    },
  }

  if (!stripePromise) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <p className="text-red-400">Erro: Stripe não está configurado corretamente</p>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <CheckoutFormInner
        professional={professional}
        service={service}
        date={date}
        amount={amount}
        clientSecret={clientSecret}
        isIPhone={isIPhone}
        isAndroid={isAndroid}
        isSubscription={service.isSubscription}
        onBack={handleBackFromPayment}
      />
    </Elements>
  )
}

export default CheckoutForm

