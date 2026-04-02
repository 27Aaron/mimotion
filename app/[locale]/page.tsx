import { redirect } from "@/i18n/routing"
import { getCurrentUser } from "@/lib/auth"

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()

  if (user) {
    redirect({ href: "/dashboard", locale })
  } else {
    redirect({ href: "/login", locale })
  }
}
