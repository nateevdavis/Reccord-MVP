'use client'

import { TutorialProvider } from '@/contexts/TutorialContext'

interface TutorialProviderWrapperProps {
  children: React.ReactNode
  tutorialCompleted: boolean
}

export default function TutorialProviderWrapper({
  children,
  tutorialCompleted,
}: TutorialProviderWrapperProps) {
  return (
    <TutorialProvider tutorialCompleted={tutorialCompleted}>
      {children}
    </TutorialProvider>
  )
}

