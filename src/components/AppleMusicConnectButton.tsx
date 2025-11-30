'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from './ui/Button'

declare global {
  interface Window {
    MusicKit?: any
  }
}

interface AppleMusicConnectButtonProps {
  onBeforeConnect?: () => void
}

export default function AppleMusicConnectButton({ onBeforeConnect }: AppleMusicConnectButtonProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [hasChecked, setHasChecked] = useState(false)

  // Extract param value outside useEffect to prevent infinite loops
  const appleMusicConnectedParam = searchParams.get('apple_music_connected')

  useEffect(() => {
    const abortController = new AbortController()

    // Check if we just connected (from callback) - check this first
    if (appleMusicConnectedParam === '1') {
      setIsConnected(true)
      setInitializing(false)
      setHasChecked(true)
      return () => {
        abortController.abort()
      }
    }

    // Only check status once to prevent infinite loops
    if (hasChecked) {
      return () => {
        abortController.abort()
      }
    }

    // Check if Apple Music is connected
    fetch('/api/auth/apple-music/status', { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!abortController.signal.aborted) {
          setIsConnected(data.connected || false)
          setInitializing(false)
          setHasChecked(true)
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setIsConnected(false)
          setInitializing(false)
          setHasChecked(true)
        }
      })

    return () => {
      abortController.abort()
    }
    // Only depend on the specific param value, not the whole searchParams object
  }, [appleMusicConnectedParam, hasChecked])

  const handleConnect = async () => {
    setLoading(true)
    try {
      // Get developer token from server
      const devTokenResponse = await fetch('/api/auth/apple-music/developer-token')
      if (!devTokenResponse.ok) {
        throw new Error('Failed to get developer token')
      }
      const { developerToken } = await devTokenResponse.json()

      // Load MusicKit JS if not already loaded
      if (!window.MusicKit) {
        await loadMusicKit()
      }

      // Initialize MusicKit
      const musicKit = await window.MusicKit.configure({
        developerToken,
        app: {
          name: 'Reccord',
          build: '1.0.0',
        },
      })

      // Authorize user
      const userToken = await musicKit.authorize()
      
      if (!userToken) {
        throw new Error('Failed to authorize with Apple Music')
      }

      // Send user token to server
      const connectResponse = await fetch('/api/auth/apple-music/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userToken,
          expiresIn: 6 * 30 * 24 * 60 * 60, // 6 months in seconds
        }),
      })

      if (!connectResponse.ok) {
        const error = await connectResponse.json()
        throw new Error(error.error || 'Failed to connect Apple Music')
      }

      setIsConnected(true)
      
      // Refresh the page to show connected state
      const currentUrl = window.location.href
      const url = new URL(currentUrl)
      url.searchParams.set('apple_music_connected', '1')
      router.push(url.toString())
    } catch (error) {
      console.error('Error connecting Apple Music:', error)
      alert(error instanceof Error ? error.message : 'Failed to connect Apple Music')
      setLoading(false)
    }
  }

  const loadMusicKit = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.MusicKit) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load MusicKit'))
      document.head.appendChild(script)
    })
  }

  if (initializing) {
    return (
      <Button type="button" disabled variant="secondary">
        Loading...
      </Button>
    )
  }

  if (isConnected) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-800">✓ Apple Music connected</p>
      </div>
    )
  }

  return (
    <Button
      type="button"
      onClick={handleConnect}
      disabled={loading}
      variant="secondary"
    >
      {loading ? 'Connecting...' : 'Connect Apple Music'}
    </Button>
  )
}

