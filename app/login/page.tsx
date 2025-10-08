import { LoginForm } from "@/components/LoginForm/login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; returnUrl?: string }>
}) {
  const sp = await searchParams
  const expired = sp?.expired === "1"

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-background">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
        linear-gradient(to right, #e7e5e4 1px, transparent 1px),
        linear-gradient(to bottom, #e7e5e4 1px, transparent 1px)
      `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 0",
          maskImage: `
        repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)
      `,
          WebkitMaskImage: `
 repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)
      `,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />
      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4">
          {expired ? (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              Your session expired due to inactivity. Please sign in to
              continue.
            </div>
          ) : null}
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
