import { LoginForm } from "@/components/LoginForm/login-form"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; returnUrl?: string }> }) {
  const sp = await searchParams;
  const expired = sp?.expired === "1";
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-3xl">
        {expired ? (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 p-3 text-sm">
            Your session expired due to inactivity. Please sign in to continue.
          </div>
        ) : null}
        <LoginForm />
      </div>
    </div>
  )
}
