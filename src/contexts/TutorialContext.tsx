'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TutorialStepId, getStepById, getNextStep } from '@/lib/tutorialSteps'

interface TutorialContextType {
  currentStep: TutorialStepId | null
  isActive: boolean
  isCompleted: boolean
  startTutorial: (initialStep?: TutorialStepId) => void
  nextStep: (context?: any) => void
  skipTutorial: () => Promise<void>
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
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      const currentPath = window.location.pathname
      
      console.log('TutorialContext: Checking localStorage', { 
        stored, 
        isCompleted, 
        serverTutorialCompleted,
        currentPath,
        willResume: !isCompleted && stored 
      })
      
      // If server says tutorial is completed, clear any stale localStorage
      if (serverTutorialCompleted && stored) {
        console.log('TutorialContext: Server says completed, clearing stale localStorage')
        localStorage.removeItem(STORAGE_KEY)
        setIsCompleted(true)
        return
      }
      
      // Only resume if not completed and we have valid progress
      if (!isCompleted && stored) {
        try {
          const progress = JSON.parse(stored)
          // Only resume if we have a valid step and it wasn't skipped
          if (progress.currentStep && !progress.skipped) {
            // Check if the step makes sense for the current page
            // 'create-list' should only be active on home page, not /create
            // 'share' should only be active on list detail page
            const step = progress.currentStep
            const isStepValidForPage = 
              (step === 'create-list' && currentPath === '/') ||
              (step === 'share' && currentPath.startsWith('/lists/')) ||
              (['title', 'description', 'price', 'public', 'source-type', 'connect-spotify', 'connect-apple-music', 'music-url', 'manual-item', 'save'].includes(step) && currentPath === '/create')
            
            if (isStepValidForPage) {
              console.log('TutorialContext: Resuming tutorial from localStorage', progress)
              setCurrentStep(progress.currentStep)
              setIsActive(true)
            } else {
              // Step doesn't match current page - clear stale data
              console.log(`TutorialContext: Step "${step}" doesn't match current page "${currentPath}", clearing stale localStorage`)
              localStorage.removeItem(STORAGE_KEY)
            }
          } else {
            // Stale or invalid progress, clear it
            console.log('TutorialContext: Clearing stale/invalid progress', progress)
            localStorage.removeItem(STORAGE_KEY)
          }
        } catch (e) {
          // Invalid storage, clear it
          console.warn('TutorialContext: Invalid localStorage data, clearing', e)
          localStorage.removeItem(STORAGE_KEY)
        }
      } else if (!stored && !isCompleted) {
        console.log('TutorialContext: No localStorage data, tutorial can start fresh')
      }
    }
  }, [isCompleted, serverTutorialCompleted])

  const startTutorial = (initialStep: TutorialStepId = 'create-list') => {
    if (isCompleted) {
      console.warn('Cannot start tutorial: already completed', { isCompleted, initialStep })
      return
    }
    console.log('🎯 TutorialContext.startTutorial called', { initialStep, isCompleted })
    setCurrentStep(initialStep)
    setIsActive(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStep: initialStep, started: true, skipped: false })
      )
      console.log('✅ Tutorial started and saved to localStorage', { initialStep })
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

  const skipTutorial = async () => {
    setIsActive(false)
    setCurrentStep(null)
    setIsCompleted(true)
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }

    // Mark as completed on server
    try {
      await fetch('/api/tutorial/complete', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to mark tutorial as skipped:', error)
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

