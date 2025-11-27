import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TutorialProviderWrapper from '@/components/TutorialProviderWrapper'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Reccord',
  description: 'Create and share curated lists',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get tutorial completion status
  const userId = await getSession()
  let tutorialCompleted = false
  
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tutorialCompleted: true },
      })
      tutorialCompleted = user?.tutorialCompleted || false
    } catch (error) {
      // If database connection fails, default to false (tutorial not completed)
      // This prevents the app from crashing if database is unavailable
      console.error('Failed to fetch tutorial status:', error)
      tutorialCompleted = false
    }
  }

  return (
    <html lang="en">
      <body>
        <TutorialProviderWrapper tutorialCompleted={tutorialCompleted}>
          <Nav />
          <main className="min-h-screen bg-white">{children}</main>
          <Footer />
        </TutorialProviderWrapper>
      </body>
    </html>
  )
}

