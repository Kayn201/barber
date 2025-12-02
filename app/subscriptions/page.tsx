import { getServerSession } from "next-auth"
import Header from "../_components/header"
import { authOptions } from "../_lib/auth"
import { redirect } from "next/navigation"
import { getUserSubscriptions } from "../_data/get-user-subscriptions"
import SubscriptionsList from "../_components/subscriptions-list"

const Subscriptions = async () => {
  const session = await getServerSession(authOptions)
  
  // Redirecionar se não estiver logado
  if (!session?.user) {
    redirect("/")
  }

  const subscriptions = await getUserSubscriptions()

  return (
    <>
      <Header />
      <div className="space-y-3 p-5">
        <h1 className="text-xl font-bold">Assinaturas</h1>
        <SubscriptionsList subscriptions={JSON.parse(JSON.stringify(subscriptions))} />
      </div>
    </>
  )
}

export default Subscriptions

