"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <form
            className="p-6 md:p-8"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              setLoading(true)
              const form = e.currentTarget as HTMLFormElement
              const formData = new FormData(form)
              const empCode = String(formData.get("username") || "").trim()
              const oldPassword = String(formData.get("password") || "")
              try {
                console.log("[LoginForm] sending payload", { empCode, passwordLength: oldPassword.length })
                const res = await fetch("/api/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ empCode, oldPassword }),
                })
                const j = await res.json().catch(() => ({}))
                if (!res.ok || !j.ok) {
                  setError(j.message || "Invalid credentials")
                  setLoading(false)
                  return
                }
                const user = j.user
                const payload = {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone || null,
                  emp_code: user.empCode || null,
                  timestamp: Date.now(),
                  ttl: 1000 * 60 * 60 * 24 * 14,
                }
                localStorage.setItem("booking.user", JSON.stringify(payload))
                window.dispatchEvent(new StorageEvent("storage", { key: "booking:user-changed" }))
                router.push("/BookingPage")
              } catch {
                setError("Network error")
                setLoading(false)
              }
            }}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to continue
                </p>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" type="text" placeholder="your employee code or email" required />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
