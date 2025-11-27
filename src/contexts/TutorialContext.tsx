'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TutorialStepId, getStepById, getNextStep } from '@/lib/tutorialSteps'

interface TutorialContextType {
  currentStep: TutorialStepId | null
  isActive: boolean
  isCompleted: boolean
  startTutorial: () => void
  nextStep: (context?: any) => void
  skipTutorial: () => void
  completeTutorial: () => Promise<void>
  setContext: (context: any) => void
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

const STORAGE_KEY = 'reccord_tutorial_progress'

interface TutorialProviderProps {
  children: ReactNode
  tutorialCompleted: boolean
}

export function TutorialProvider({
  children,
  tutorialCompleted: serverTutorialCompleted,
}: TutorialProviderProps) {
  const [currentStep, setCurrentStep] = useState<TutorialStepId | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isCompleted, setIsCompleted] = useState(serverTutorialCompleted)
  const [context, setContextState] = useState<any>({})

  useEffect(() => {
    // Check localStorage for progress
    if (typeof window !== 'undefined' && !isCompleted) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const progress = JSON.parse(stored)
          if (progress.currentStep && !progress.skipped) {
            setCurrentStep(progress.currentStep)
            setIsActive(true)
          }
        } catch (e) {
          // Invalid storage, clear it
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
  }, [isCompleted])

  const startTutorial = () => {
    if (isCompleted) return
    setCurrentStep('create-list')
    setIsActive(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStep: 'create-list', started: true, skipped: false })
      )
    }
  }

  const nextStep = (stepContext?: any) => {
    if (!currentStep) return

    const mergedContext = { ...context, ...stepContext }
    setContextState(mergedContext)

    const next = getNextStep(currentStep, mergedContext)
    if (next) {
      setCurrentStep(next.id)
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ currentStep: next.id, started: true, skipped: false })
        )
      }
    } else {
      // No more steps, complete tutorial
      completeTutorial()
    }
  }

  const skipTutorial = () => {
    setIsActive(false)
    setCurrentStep(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ skipped: true })
      )
    }
  }

  const completeTutorial = async () => {
    setIsActive(false)
    setCurrentStep(null)
    setIsCompleted(true)

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }

    // Update server
    try {
      await fetch('/api/tutorial/complete', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to mark tutorial as complete:', error)
    }
  }

  const setContext = (newContext: any) => {
    setContextState((prev: any) => ({ ...prev, ...newContext }))
  }

  return (
    <TutorialContext.Provider
      value={{
        currentStep,
        isActive,
        isCompleted,
        startTutorial,
        nextStep,
        skipTutorial,
        completeTutorial,
        setContext,
      }}
    >
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider')
  }
  return context
}

