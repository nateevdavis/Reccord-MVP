'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Button from './ui/Button'
import { useTutorial } from '@/contexts/TutorialContext'
import TutorialModal from './TutorialModal'
import { getStepById } from '@/lib/tutorialSteps'
import NotificationDropdown from './NotificationDropdown'

export default function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentStep, isActive, startTutorial } = useTutorial()
  const [user, setUser] = useState<{ id: string; username: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

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

  const fetchNotifications = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/notifications?unread=true')
      const data = await res.json()
      if (res.ok) {
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  // Refetch user when pathname changes (e.g., after login/signup)
  useEffect(() => {
    fetchUser()
  }, [pathname])

  // Fetch notifications when user is logged in
  useEffect(() => {
    if (user) {
      fetchNotifications()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    } else {
      setUnreadCount(0)
    }
  }, [user])

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
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative text-sm text-gray-600 hover:text-gray-900"
                    aria-label="Notifications"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <NotificationDropdown
                      onClose={() => {
                        setShowNotifications(false)
                        fetchNotifications() // Refresh count after closing
                      }}
                    />
                  )}
                </div>
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
