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

// Mark layout as dynamic since it uses cookies for session checking
// This prevents static generation errors
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get tutorial completion status - make it completely non-blocking
  // If this fails, the app should still render
  let tutorialCompleted = false
  
  try {
    // Skip session check during build time
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      tutorialCompleted = false
    } else {
      const userId = await Promise.race([
        getSession(),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 1000))
      ])
      
      if (userId) {
        // Add timeout to prevent hanging - use Promise.race
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 1500) // 1.5 second timeout
        })
        
        const dbPromise = prisma.user.findUnique({
          where: { id: userId },
          select: { tutorialCompleted: true },
        }).then((user) => user?.tutorialCompleted || false).catch(() => false)
        
        // Race between database query and timeout
        tutorialCompleted = await Promise.race([dbPromise, timeoutPromise])
      }
    }
  } catch (error) {
    // If anything fails, default to false - never crash the app
    // Silently fail to ensure the app always renders
    tutorialCompleted = false
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

