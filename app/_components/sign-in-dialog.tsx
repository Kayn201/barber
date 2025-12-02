import { signIn } from "next-auth/react"
import { Button } from "./ui/button"
import { DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import Image from "next/image"
import { Josefin_Sans } from "next/font/google"

const SignInDialog = () => {
  const handleLoginWithGoogleClick = () => {
    // Sempre usar localhost em desenvolvimento, mesmo que window.location seja diferente
    const isDevelopment = process.env.NODE_ENV === "development" || 
                         window.location.hostname === "localhost" ||
                         window.location.hostname === "127.0.0.1"
    
    const callbackUrl = isDevelopment 
      ? "http://localhost:3000" 
      : window.location.origin
    
    signIn("google", { 
      callbackUrl,
      redirect: true,
    })
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Faça login na plataforma</DialogTitle>
        <DialogDescription>
          Conecte-se usando sua conta do Google.
        </DialogDescription>
      </DialogHeader>

      <Button
        variant="outline"
        className="gap-1 font-bold"
        onClick={handleLoginWithGoogleClick}
      >
        <Image
          alt="Fazer login com o Google"
          src="/google.svg"
          width={18}
          height={18}
        />
        Google
      </Button>
    </>
  )
}

export default SignInDialog
