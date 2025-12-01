'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Button from './ui/Button'
import { useTutorial } from '@/contexts/TutorialContext'
import TutorialModal from './TutorialModal'
import { getStepById } from '@/lib/tutorialSteps'

export default function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentStep, isActive, startTutorial } = useTutorial()
  const [user, setUser] = useState<{ id: string; username: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  // Refetch user when pathname changes (e.g., after login/signup)
  useEffect(() => {
    fetchUser()
  }, [pathname])

  // Listen for custom event to refresh user (for immediate updates)
  useEffect(() => {
    const handleAuthChange = () => {
      fetchUser()
    }
    window.addEventListener('auth-change', handleAuthChange)
    return () => window.removeEventListener('auth-change', handleAuthChange)
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.dispatchEvent(new Event('auth-change'))
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-2xl px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-gray-900">
            Reccord
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Home
            </Link>
            {user && (
              <>
                <Link
                  href="/explore"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Explore
                </Link>
                {isActive && currentStep === 'create-list' && getStepById('create-list') && (
                  <TutorialModal step={getStepById('create-list')!} />
                )}
                <Link
                  href="/create?tutorial=start"
                  className="text-sm text-gray-600 hover:text-gray-900"
                  data-tutorial="create-link"
                  onClick={(e) => {
                    if (!isActive) {
                      startTutorial()
                    }
                  }}
                >
                  Create
                </Link>
                <Link
                  href="/profile"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Profile
                </Link>
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  className="text-sm"
                >
                  Log out
                </Button>
              </>
            )}
            {!loading && !user && (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Log in
                </Link>
                <Link href="/signup">
                  <Button variant="primary" className="text-sm">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
