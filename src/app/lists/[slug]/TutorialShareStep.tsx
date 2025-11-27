'use client'

import { useEffect } from 'react'
import { useTutorial } from '@/contexts/TutorialContext'
import TutorialModal from '@/components/TutorialModal'
import { getStepById } from '@/lib/tutorialSteps'

export default function TutorialShareStep() {
  const { currentStep, isActive, nextStep } = useTutorial()

  useEffect(() => {
    // If tutorial is active and we just saved (currentStep might be 'save'), advance to share
    if (isActive && currentStep === 'save') {
      nextStep()
    }
  }, [isActive, currentStep, nextStep])

  if (!isActive || currentStep !== 'share') return null

  const step = getStepById('share')
  if (!step) return null

  return <TutorialModal step={step} />
}

