"use client"

import { useLocale } from "next-intl"
import { useRouter, usePathname } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale() {
    const next = locale === "zh" ? "en" : "zh"
    router.replace(pathname, { locale: next })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={switchLocale}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      <Languages className="h-4 w-4" />
    </Button>
  )
}
