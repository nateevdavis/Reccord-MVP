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
    // Debug logging
    console.log('TutorialModal useEffect:', {
      stepId: step.id,
      isActive,
      currentStep,
      shouldShow: isActive && currentStep === step.id,
      targetSelector: step.targetSelector
    })

    if (!isActive || currentStep !== step.id) {
      setIsVisible(false)
      return
    }

    // Find target element with retry mechanism
    // Sometimes the element isn't ready immediately, so we retry a few times
    let retryCount = 0
    const maxRetries = 20 // Increased retries for slower renders
    const retryDelay = 100
    let timeoutId: NodeJS.Timeout | null = null
    let cleanupTarget: HTMLElement | null = null

    const findAndShowTarget = () => {
      const target = document.querySelector(step.targetSelector) as HTMLElement
      if (target) {
        console.log(`✅ Found tutorial target for step "${step.id}":`, step.targetSelector, target)
        targetRef.current = target
        cleanupTarget = target
        
        // Calculate position with viewport boundary checks
        const rect = target.getBoundingClientRect()
        const scrollY = window.scrollY
        const scrollX = window.scrollX
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const modalWidth = 320 // w-80 = 320px
        const modalHeight = 200 // Approximate height
        const spacing = 12

        // Calculate positions with viewport boundary checks
        let calculatedPosition: { top?: number; left?: number; bottom?: number; right?: number } = {}

        if (step.position === 'top') {
          // Position above, but check if there's enough space
          const spaceAbove = rect.top
          if (spaceAbove >= modalHeight + spacing) {
            calculatedPosition = {
              bottom: viewportHeight - rect.top + scrollY + spacing,
              left: rect.left + scrollX + rect.width / 2,
            }
          } else {
            // Not enough space above, position below instead
            calculatedPosition = {
              top: rect.bottom + scrollY + spacing,
              left: rect.left + scrollX + rect.width / 2,
            }
          }
        } else if (step.position === 'bottom') {
          // Position below, but check if there's enough space
          const spaceBelow = viewportHeight - rect.bottom
          if (spaceBelow >= modalHeight + spacing) {
            calculatedPosition = {
              top: rect.bottom + scrollY + spacing,
              left: rect.left + scrollX + rect.width / 2,
            }
          } else {
            // Not enough space below, position above instead
            calculatedPosition = {
              bottom: viewportHeight - rect.top + scrollY + spacing,
              left: rect.left + scrollX + rect.width / 2,
            }
          }
        } else if (step.position === 'left') {
          calculatedPosition = {
            top: rect.top + scrollY + rect.height / 2,
            right: viewportWidth - rect.left + scrollX + spacing,
          }
        } else if (step.position === 'right') {
          calculatedPosition = {
            top: rect.top + scrollY + rect.height / 2,
            left: rect.right + scrollX + spacing,
          }
        } else {
          // Default to bottom
          calculatedPosition = {
            top: rect.bottom + scrollY + spacing,
            left: rect.left + scrollX + rect.width / 2,
          }
        }

        // Ensure modal stays within viewport horizontally
        if (calculatedPosition.left !== undefined) {
          const leftValue = calculatedPosition.left - modalWidth / 2 // Account for translateX(-50%)
          if (leftValue < spacing) {
            calculatedPosition.left = spacing + modalWidth / 2
          } else if (leftValue + modalWidth > viewportWidth - spacing) {
            calculatedPosition.left = viewportWidth - spacing - modalWidth / 2
          }
        }

        console.log(`📍 Position calculated for step "${step.id}":`, {
          position: calculatedPosition,
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          viewport: { width: viewportWidth, height: viewportHeight },
          scroll: { x: scrollX, y: scrollY }
        })

        setPosition(calculatedPosition)

        // Highlight target element with subtle outline (non-blocking)
        target.style.outline = '2px solid rgba(59, 130, 246, 0.4)'
        target.style.outlineOffset = '2px'
        target.style.transition = 'outline 0.2s'
        target.style.pointerEvents = 'auto' // Ensure target remains clickable

        setIsVisible(true)
        console.log(`✅ Tutorial modal visible for step "${step.id}"`)
        return true
      } else if (retryCount < maxRetries) {
        retryCount++
        if (retryCount % 5 === 0) {
          console.log(`⏳ Retrying to find target (attempt ${retryCount}/${maxRetries}):`, step.targetSelector)
        }
        timeoutId = setTimeout(findAndShowTarget, retryDelay)
        return false
      } else {
        // Element not found after retries - log for debugging
        console.error(`❌ Tutorial target not found after ${maxRetries} retries:`, step.targetSelector)
        console.log('Available elements with data-tutorial:', 
          Array.from(document.querySelectorAll('[data-tutorial]')).map(el => ({
            selector: el.getAttribute('data-tutorial'),
            tag: el.tagName,
            className: el.className
          }))
        )
        setIsVisible(false)
        return false
      }
    }

    findAndShowTarget()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (cleanupTarget) {
        cleanupTarget.style.outline = ''
        cleanupTarget.style.outlineOffset = ''
        cleanupTarget.style.pointerEvents = ''
      }
    }
  }, [isActive, currentStep, step.id, step.targetSelector, step.position])

  // Debug: Log render state
  useEffect(() => {
    if (isVisible && targetRef.current) {
      console.log(`🎨 TutorialModal rendering for step "${step.id}"`, {
        isVisible,
        hasTarget: !!targetRef.current,
        position,
        targetElement: targetRef.current
      })
    } else {
      console.log(`🚫 TutorialModal NOT rendering for step "${step.id}"`, {
        isVisible,
        hasTarget: !!targetRef.current,
        reason: !isVisible ? 'not visible' : 'no target ref'
      })
    }
  }, [isVisible, step.id, position])

  if (!isVisible || !targetRef.current) {
    return null
  }

  const handleNext = () => {
    if (step.id === 'share') {
      completeTutorial()
    } else {
      nextStep()
    }
  }

  const stepIndex = ['create-list', 'title', 'description', 'price', 'public', 'source-type', 'music-url', 'manual-item', 'save', 'share'].indexOf(step.id) + 1
  const totalSteps = 10

  // Ensure position values are valid numbers
  const validPosition = {
    ...position,
    // Ensure all position values are numbers, not NaN or undefined
    top: position.top !== undefined && !isNaN(position.top) ? position.top : undefined,
    left: position.left !== undefined && !isNaN(position.left) ? position.left : undefined,
    bottom: position.bottom !== undefined && !isNaN(position.bottom) ? position.bottom : undefined,
    right: position.right !== undefined && !isNaN(position.right) ? position.right : undefined,
  }

  // Log final render with position
  console.log(`🎨 Rendering TutorialModal for step "${step.id}"`, {
    validPosition,
    originalPosition: position,
    hasAllValues: Object.values(validPosition).some(v => v !== undefined)
  })

  return (
    <>
      {/* Modal positioned near target - non-blocking, no backdrop */}
      <div
        className="fixed z-[9999] w-80 rounded-lg bg-white p-6 shadow-xl transition-all pointer-events-auto border-2 border-blue-500"
        style={{
          ...validPosition,
          maxWidth: 'calc(100vw - 2rem)',
          transform:
            step.position === 'top' || step.position === 'bottom'
              ? 'translateX(-50%)'
              : step.position === 'left' || step.position === 'right'
              ? 'translateY(-50%)'
              : undefined,
          // Ensure visibility
          visibility: 'visible',
          opacity: 1,
          display: 'block',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        data-tutorial-modal={step.id}
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

