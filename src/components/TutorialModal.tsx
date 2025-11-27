'use client'

import { useEffect, useState, useRef } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { TutorialStep, getStepById } from '@/lib/tutorialSteps'
import { useTutorial } from '@/contexts/TutorialContext'

interface TutorialModalProps {
  step: TutorialStep
}

export default function TutorialModal({ step }: TutorialModalProps) {
  const { currentStep, nextStep, skipTutorial, completeTutorial, isActive } =
    useTutorial()
  const [position, setPosition] = useState<{
    top?: number
    left?: number
    bottom?: number
    right?: number
  }>({})
  const [isVisible, setIsVisible] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || currentStep !== step.id) {
      setIsVisible(false)
      return
    }

    // Find target element
    const target = document.querySelector(step.targetSelector) as HTMLElement
    if (!target) {
      setIsVisible(false)
      return
    }

    targetRef.current = target
    setIsVisible(true)

    // Calculate position
    const rect = target.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    const positions: Record<string, { top?: number; left?: number; bottom?: number; right?: number }> = {
      top: {
        bottom: window.innerHeight - rect.top - scrollY + 12,
        left: rect.left + scrollX + rect.width / 2,
      },
      bottom: {
        top: rect.bottom + scrollY + 12,
        left: rect.left + scrollX + rect.width / 2,
      },
      left: {
        top: rect.top + scrollY + rect.height / 2,
        right: window.innerWidth - rect.left - scrollX + 12,
      },
      right: {
        top: rect.top + scrollY + rect.height / 2,
        left: rect.right + scrollX + 12,
      },
    }

    setPosition(positions[step.position] || positions.bottom)

    // Highlight target element
    target.style.outline = '2px solid rgba(59, 130, 246, 0.5)'
    target.style.outlineOffset = '4px'
    target.style.transition = 'outline 0.2s'

    return () => {
      if (target) {
        target.style.outline = ''
        target.style.outlineOffset = ''
      }
    }
  }, [isActive, currentStep, step.id, step.targetSelector, step.position])

  if (!isVisible || !targetRef.current) return null

  const handleNext = () => {
    if (step.id === 'share') {
      completeTutorial()
    } else {
      nextStep()
    }
  }

  const stepIndex = ['create-list', 'title', 'description', 'price', 'public', 'source-type', 'music-url', 'manual-item', 'save', 'share'].indexOf(step.id) + 1
  const totalSteps = 10

  return (
    <>
      {/* Backdrop with cutout */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal positioned near target */}
      <div
        className="fixed z-50 w-80 rounded-lg bg-white p-6 shadow-xl transition-all"
        style={{
          ...position,
          maxWidth: 'calc(100vw - 2rem)',
          transform:
            step.position === 'top' || step.position === 'bottom'
              ? 'translateX(-50%)'
              : step.position === 'left' || step.position === 'right'
              ? 'translateY(-50%)'
              : undefined,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            Step {stepIndex} of {totalSteps}
          </span>
          <button
            onClick={skipTutorial}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Skip tutorial
          </button>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-gray-900">
          {step.copy}
        </p>

        <div className="flex gap-2">
          {step.cta && (
            <Button onClick={handleNext} variant="primary" className="flex-1">
              {step.cta}
            </Button>
          )}
          {!step.cta && (
            <Button onClick={handleNext} variant="primary" className="flex-1">
              Next
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

