import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoMark } from "@/components/common/logo"
import { LoginForm } from "@/features/auth/login-form"
import { getSession, initSession } from "@/features/auth/session"
import { safeRedirect } from "@/lib/redirect"

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    await initSession()
    if (getSession().status === "authenticated") throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <LogoMark />
        Metalix
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Log in</CardTitle>
          <CardDescription>Use the email and password the owner set up for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => navigate({ href: safeRedirect(target), replace: true })} />
        </CardContent>
      </Card>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Forgot your password? Ask the owner of the business.
      </p>
    </main>
  )
}
