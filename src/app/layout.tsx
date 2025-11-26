import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Reccord',
  description: 'Create and share curated lists',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="min-h-screen bg-white">{children}</main>
        <Footer />
      </body>
    </html>
  )
}

