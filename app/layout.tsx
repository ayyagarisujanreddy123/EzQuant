import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans-family',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-family',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SignalTracer',
  description: 'Visual quant pipeline builder — trace every signal from data to backtest.',
}

// Workaround for a Next.js 16.2.4 bug where the internal `/_global-error`
// prerender throws "Cannot read properties of null (reading 'useContext')"
// during `next build`. Marking the root as fully dynamic skips that static
// prerender step — every page is rendered per-request instead, which is
// what this app does anyway (canvas + copilot are all client/streaming).
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased h-full">{children}</body>
    </html>
  )
}
