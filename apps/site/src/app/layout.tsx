import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import { ThemeProvider } from "@euaggelion/ui/shell/theme-provider"
import { Toaster } from "@euaggelion/ui/components/sonner"
import { TooltipProvider } from "@euaggelion/ui/components/tooltip"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Projeto Euaggelion", template: "%s · Euaggelion" },
  description: "Materiais de estudo bíblico do Projeto Euaggelion",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
