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
  const [isInputFocused, setIsInputFocused] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Debug logging (only once per step change)
    if (isActive && currentStep === step.id) {
      console.log('TutorialModal useEffect:', {
        stepId: step.id,
        isActive,
        currentStep,
        targetSelector: step.targetSelector
      })
    }

    if (!isActive || currentStep !== step.id) {
      setIsVisible(false)
      setPosition({}) // Clear position when not active
      return
    }

    // Find target element with retry mechanism
    // Sometimes the element isn't ready immediately, so we retry a few times
    let retryCount = 0
    const maxRetries = 20 // Increased retries for slower renders
    const retryDelay = 100
    let timeoutId: NodeJS.Timeout | null = null
    let cleanupTarget: HTMLElement | null = null
    let hasSetPosition = false // Prevent multiple position updates

    const updatePosition = () => {
      if (!targetRef.current) return

      const target = targetRef.current
      const rect = target.getBoundingClientRect()
      
      // Force all modals to appear below (under) their target elements
      // For fixed positioning, values are relative to viewport (not document)
      const spacing = 12
      const modalWidth = 320
      const modalHeight = 200
      const minMargin = 16
      
      // Always position below the target element
      let calculatedPosition: { top?: number; left?: number; bottom?: number; right?: number } = {
        top: rect.bottom + spacing,
        left: rect.left + rect.width / 2,
      }
      
      // Ensure modal stays within viewport horizontally
      if (calculatedPosition.left !== undefined) {
        const halfWidth = modalWidth / 2
        if (calculatedPosition.left - halfWidth < minMargin) {
          calculatedPosition.left = minMargin + halfWidth
        } else if (calculatedPosition.left + halfWidth > window.innerWidth - minMargin) {
          calculatedPosition.left = window.innerWidth - minMargin - halfWidth
        }
      }
      
      // Ensure modal stays within viewport vertically
      // If modal would go off bottom of screen, position above instead
      if (calculatedPosition.top !== undefined) {
        if (calculatedPosition.top + modalHeight > window.innerHeight - minMargin) {
          // Not enough space below, position above instead
          calculatedPosition = {
            bottom: window.innerHeight - rect.top + spacing,
            left: rect.left + rect.width / 2,
          }
          // Re-adjust horizontal position
          if (calculatedPosition.left !== undefined) {
            const halfWidth = modalWidth / 2
            if (calculatedPosition.left - halfWidth < minMargin) {
              calculatedPosition.left = minMargin + halfWidth
            } else if (calculatedPosition.left + halfWidth > window.innerWidth - minMargin) {
              calculatedPosition.left = window.innerWidth - minMargin - halfWidth
            }
          }
        } else if (calculatedPosition.top < minMargin) {
          calculatedPosition.top = minMargin
        }
      }

      setIsInputFocused(false)
      setPosition(calculatedPosition)
    }

    const findAndShowTarget = () => {
      const target = document.querySelector(step.targetSelector) as HTMLElement
      if (target) {
        // Only proceed if we haven't already set position for this step
        if (hasSetPosition) {
          return true
        }

        console.log(`✅ Found tutorial target for step "${step.id}":`, step.targetSelector, target)
        targetRef.current = target
        cleanupTarget = target
        
        // Highlight target element with subtle outline (non-blocking)
        target.style.outline = '2px solid rgba(59, 130, 246, 0.4)'
        target.style.outlineOffset = '2px'
        target.style.transition = 'outline 0.2s'
        target.style.pointerEvents = 'auto' // Ensure target remains clickable
        
        // Calculate initial position
        updatePosition()
        setIsVisible(true)
        hasSetPosition = true
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

    // Check if ANY input field is focused and if our modal would cover it
    const checkInputFocus = () => {
      const activeElement = document.activeElement
      const isAnyInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA'
      )
      
      if (isAnyInputFocused && targetRef.current) {
        // Update position which will check if modal covers the focused input
        updatePosition()
      } else {
        setIsInputFocused(false)
        // Still update position in case input was just unfocused
        if (targetRef.current) {
          updatePosition()
        }
      }
    }

    // Update position on scroll/resize so modal "sticks" to target element
    const handleScroll = () => {
      if (isActive && currentStep === step.id && targetRef.current) {
        updatePosition()
        checkInputFocus()
      }
    }

    const handleResize = () => {
      if (isActive && currentStep === step.id && targetRef.current) {
        updatePosition()
      }
    }

    const handleFocus = () => {
      if (isActive && currentStep === step.id) {
        checkInputFocus()
        // Small delay to let focus settle, then update position
        setTimeout(() => {
          if (targetRef.current) {
            updatePosition()
          }
        }, 50)
      }
    }

    const handleBlur = () => {
      if (isActive && currentStep === step.id) {
        setTimeout(() => {
          setIsInputFocused(false)
          if (targetRef.current) {
            updatePosition()
          }
        }, 100) // Small delay to check if focus moved to another input
      }
    }

    window.addEventListener('scroll', handleScroll, true) // Use capture phase to catch all scrolls
    window.addEventListener('resize', handleResize)
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (cleanupTarget) {
        cleanupTarget.style.outline = ''
        cleanupTarget.style.outlineOffset = ''
        cleanupTarget.style.pointerEvents = ''
      }
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
      hasSetPosition = false // Reset flag on cleanup
    }
  }, [isActive, currentStep, step.id, step.targetSelector, step.position])

  // Removed debug logging useEffect that was causing infinite renders

  // Hide modal if user is actively typing in the target input field
  if (!isVisible || !targetRef.current || isInputFocused) {
    return null
  }

  const handleNext = () => {
    if (step.id === 'share') {
      completeTutorial()
    } else {
      nextStep()
    }
  }

  // Calculate step index based on tutorial step order
  // When on create page, 'create-list' is skipped, so we adjust the index
  const allSteps = ['create-list', 'source-type', 'title', 'description', 'price', 'public', 'connect-spotify', 'connect-apple-music', 'music-url', 'manual-item', 'save', 'share']
  const stepIndexInAll = allSteps.indexOf(step.id) + 1
  
  // If we're on a step that comes after 'create-list' and we're on the create page,
  // subtract 1 to account for skipping 'create-list'
  // Steps on create page: source-type (1), title (2), description (3), etc.
  const isCreatePageStep = ['source-type', 'title', 'description', 'price', 'public', 'connect-spotify', 'connect-apple-music', 'music-url', 'manual-item', 'save'].includes(step.id)
  const stepIndex = isCreatePageStep ? stepIndexInAll - 1 : stepIndexInAll
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

  // Removed render logging useEffect - was causing infinite re-renders
  // Position logging is already handled in the main useEffect

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

