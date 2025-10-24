import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"

export default async function WathefniLanding() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    return redirect('/career/dashboard')
  }
  return redirect('/start')
}
