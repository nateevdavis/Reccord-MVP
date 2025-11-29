'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from './ui/Button'

export default function SpotifyConnectButton() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()

    // Check if we just connected (from callback) - check this first
    if (searchParams.get('spotify_connected') === '1') {
      setIsConnected(true)
      return
    }

    // Check if Spotify is connected
    fetch('/api/auth/spotify/status', { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!abortController.signal.aborted) {
          setIsConnected(data.connected || false)
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setIsConnected(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [searchParams])

  const handleConnect = () => {
    setLoading(true)
    const currentUrl = window.location.href
    const returnUrl = new URL(currentUrl).pathname + new URL(currentUrl).search
    // Use window.location.href for OAuth redirects to avoid CORS issues with router.push()
    window.location.href = `/api/auth/spotify/authorize?returnUrl=${encodeURIComponent(returnUrl)}`
  }

  if (isConnected) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-800">✓ Spotify connected</p>
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
      {loading ? 'Connecting...' : 'Connect Spotify'}
    </Button>
  )
}

