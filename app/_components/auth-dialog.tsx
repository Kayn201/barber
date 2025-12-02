"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import Image from "next/image"
import { register } from "../_actions/register"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubscription?: boolean
}

const AuthDialog = ({ open, onOpenChange, isSubscription = false }: AuthDialogProps) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Detectar se é iOS
  const isIOS =
    typeof window !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Email ou senha incorretos")
      } else {
        toast.success("Login realizado com sucesso!")
        onOpenChange(false)
        // Aguardar um pouco para a sessão ser atualizada
        setTimeout(() => {
          router.refresh()
        }, 500)
      }
    } catch (error) {
      toast.error("Erro ao fazer login. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await register({
        name,
        email,
        password,
        confirmPassword,
      })

      if (result.success) {
        toast.success("Conta criada com sucesso! Fazendo login...")
        // Fazer login automaticamente após criar conta
        const loginResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (loginResult?.error) {
          toast.error("Conta criada, mas erro ao fazer login. Faça login manualmente.")
          setIsLogin(true)
          setPassword("")
          setConfirmPassword("")
        } else {
          toast.success("Login realizado com sucesso!")
          onOpenChange(false)
          setTimeout(() => {
            router.refresh()
          }, 500)
        }
      } else {
        toast.error(result.error || "Erro ao criar conta")
      }
    } catch (error) {
      toast.error("Erro ao criar conta. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    // Usar URL de produção
    const callbackUrl = window.location.origin
    signIn("google", { callbackUrl })
  }

  const handleAppleSignIn = () => {
    // Usar URL de produção
    const callbackUrl = window.location.origin
    signIn("apple", { callbackUrl })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSubscription
              ? "Crie uma conta para assinatura"
              : isLogin
                ? "Faça login"
                : "Crie sua conta"}
          </DialogTitle>
          <DialogDescription>
            {isSubscription
              ? "Para assinaturas, é necessário criar uma conta para gerenciar seus pagamentos recorrentes."
              : isLogin
                ? "Entre com sua conta para continuar"
                : "Crie uma conta para continuar"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formulário de Email/Senha */}
          <form
            onSubmit={isLogin ? handleEmailLogin : handleRegister}
            className="space-y-4"
          >
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#EE8530] text-black hover:bg-[#EE8530]/90"
              disabled={isLoading}
            >
              {isLoading
                ? "Carregando..."
                : isLogin
                  ? "Entrar"
                  : "Criar Conta"}
            </Button>
          </form>

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou continue com
              </span>
            </div>
          </div>

          {/* Botões de Login Social */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleSignIn}
            >
              <Image
                src="/google.svg"
                alt="Google"
                width={20}
                height={20}
              />
              Google
            </Button>

            {isIOS && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleAppleSignIn}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
              </Button>
            )}
          </div>

          {/* Toggle Login/Registro */}
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setPassword("")
                setConfirmPassword("")
              }}
              className="text-[#EE8530] hover:underline"
            >
              {isLogin
                ? "Não tem uma conta? Criar conta"
                : "Já tem uma conta? Fazer login"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthDialog

