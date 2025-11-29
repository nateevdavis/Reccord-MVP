'use client'

import Link from 'next/link'
import Button from './ui/Button'

interface OnboardingChecklistProps {
  hasLists: boolean
  hasMusicConnection: boolean
  hasSubscribers: boolean
}

export default function OnboardingChecklist({
  hasLists,
  hasMusicConnection,
  hasSubscribers,
}: OnboardingChecklistProps) {
  const completedCount = [hasLists, hasMusicConnection, hasSubscribers].filter(
    Boolean
  ).length
  const allCompleted = completedCount === 3

  if (allCompleted) {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
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
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
        <span className="text-sm text-gray-500">
          {completedCount}/3 completed
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

