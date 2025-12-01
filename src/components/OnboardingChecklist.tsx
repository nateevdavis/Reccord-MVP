'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Button from './ui/Button'

interface OnboardingChecklistProps {
  hasLists: boolean
  hasMusicConnection: boolean
  hasSubscribers: boolean
  hasSubscriptions: boolean
}

const DISMISSED_STORAGE_KEY = 'onboarding_checklist_dismissed'

export default function OnboardingChecklist({
  hasLists,
  hasMusicConnection,
  hasSubscribers,
  hasSubscriptions,
}: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if checklist was previously dismissed
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(DISMISSED_STORAGE_KEY)
      setIsDismissed(dismissed === 'true')
    }
  }, [])

  const completedCount = [hasLists, hasMusicConnection, hasSubscribers, hasSubscriptions].filter(
    Boolean
  ).length
  const allCompleted = completedCount === 4

  const handleDismiss = () => {
    setIsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_STORAGE_KEY, 'true')
    }
  }

  // If dismissed, don't show anything
  if (isDismissed) {
    return null
  }

  // If all completed, show completion message with dismiss button
  if (allCompleted) {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-sm font-medium text-gray-900">
              Onboarding Completed
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss checklist"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
        <span className="text-sm text-gray-500">
          {completedCount}/4 completed
        </span>
      </div>

      <div className="space-y-4">
        {/* Create first list */}
        <div className="flex items-center justify-between rounded border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {hasLists ? (
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  hasLists ? 'text-gray-900' : 'text-gray-700'
                }`}
              >
                Create your first list
              </p>
            </div>
          </div>
          {!hasLists && (
            <Link href="/create?tutorial=start">
              <Button variant="secondary" className="text-sm">
                Create a List
              </Button>
            </Link>
          )}
        </div>

        {/* Connect music service */}
        <div className="flex items-center justify-between rounded border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {hasMusicConnection ? (
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  hasMusicConnection ? 'text-gray-900' : 'text-gray-700'
                }`}
              >
                Connect Spotify or Apple Music
              </p>
            </div>
          </div>
          {!hasMusicConnection && (
            <Link href="/profile">
              <Button variant="secondary" className="text-sm">
                Connect
              </Button>
            </Link>
          )}
        </div>

        {/* Subscribe to a list */}
        <div className="flex items-center justify-between rounded border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {hasSubscriptions ? (
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  hasSubscriptions ? 'text-gray-900' : 'text-gray-700'
                }`}
              >
                Subscribe to a list
              </p>
            </div>
          </div>
          {!hasSubscriptions && (
            <Link href="/explore">
              <Button variant="secondary" className="text-sm">
                Explore Lists
              </Button>
            </Link>
          )}
        </div>

        {/* Get first subscriber */}
        <div className="flex items-center justify-between rounded border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {hasSubscribers ? (
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  hasSubscribers ? 'text-gray-900' : 'text-gray-700'
                }`}
              >
                Get your first subscriber
              </p>
            </div>
          </div>
          {!hasSubscribers && (
            <Link href="/create">
              <Button variant="secondary" className="text-sm">
                Create a List
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

