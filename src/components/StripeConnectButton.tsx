'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Button from './ui/Button'

type StripeConnectButtonProps = {
  returnUrl?: string
}

export default function StripeConnectButton(props: StripeConnectButtonProps = {}) {
  const { returnUrl } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<string>('not_connected')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const abortController = new AbortController()

    // Check if we just connected (from callback) - check this first
    if (searchParams.get('stripe_connect_success') === '1') {
      setIsConnected(true)
      setStatus('active')
      setChecking(false)
      return
    }

    // Check if Stripe Connect is connected
    fetch('/api/stripe-connect/status', { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!abortController.signal.aborted) {
          setIsConnected(data.connected || false)
          setStatus(data.status || 'not_connected')
          setChecking(false)
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setIsConnected(false)
          setStatus('not_connected')
          setChecking(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [searchParams])

  const handleConnect = async () => {
    setLoading(true)
    try {
      const currentReturnUrl = returnUrl || pathname || '/create'
      const response = await fetch('/api/stripe-connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: currentReturnUrl }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create onboarding link')
        setLoading(false)
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error)
      alert('Failed to connect Stripe account')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="text-sm text-gray-600">Checking connection...</div>
    )
  }

  if (isConnected && status === 'active') {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-800">✓ Stripe account connected</p>
      </div>
    )
  }

  if (isConnected && status === 'pending') {
    return (
      <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
        <p className="text-sm text-yellow-800">
          ⚠ Stripe account setup in progress. Please complete the onboarding process.
        </p>
        <Button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          variant="secondary"
          className="mt-2"
        >
          {loading ? 'Loading...' : 'Complete Setup'}
        </Button>
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
      {loading ? 'Connecting...' : 'Connect Stripe Account'}
    </Button>
  )
}

