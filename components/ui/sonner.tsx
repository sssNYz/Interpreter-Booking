"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-black dark:group-[.toast]:text-white group-[.toast]:font-medium",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toast]:border-green-500/20 group-[.toast]:bg-green-50 dark:group-[.toast]:bg-green-950/20",
          error: "group-[.toast]:border-red-500/20 group-[.toast]:bg-red-50 dark:group-[.toast]:bg-red-950/20",
          warning: "group-[.toast]:border-amber-500/20 group-[.toast]:bg-amber-50 dark:group-[.toast]:bg-amber-950/20",
          info: "group-[.toast]:border-blue-500/20 group-[.toast]:bg-blue-50 dark:group-[.toast]:bg-blue-950/20",
        },
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
