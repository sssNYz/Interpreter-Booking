"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
    <div className={cn("flex flex-col", className)} {...props}>
      <form
        method="POST"
        className="flex flex-col gap-6"
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
              empCode: user.empCode,
              name: user.name,
              email: user.email,
              phone: user.phone || null,
              // no TTL needed client-side; server cookie controls auth
            }
            localStorage.setItem("booking.user", JSON.stringify(payload))
            window.dispatchEvent(new StorageEvent("storage", { key: "booking:user-changed" }))
            if (!user.phone) {
              router.push("/setup/phone")
            } else {
              router.push("/BookingPage")
            }
          } catch {
            setError("Network error")
            setLoading(false)
          }
        }}
      >
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Interpreter Booking</h1>
          <p className="text-muted-foreground text-sm">Login to continue</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="username">User ID</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Enter your user ID"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </Button>
      </form>
    </div>
  )
}
