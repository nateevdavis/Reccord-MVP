'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function SubscribeButton({ 
  listId, 
  priceCents 
}: { 
  listId: string
  priceCents: number 
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lists/${listId}/subscribe`, {
        method: 'POST',
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        if (res.status === 401) {
          // Redirect to login if unauthorized, preserving current path
          router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
        } else if (res.status === 402 || data.requiresPayment) {
          // Payment required - redirect to checkout
          const checkoutRes = await fetch('/api/payments/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listId }),
          })
          const checkoutData = await checkoutRes.json()
          if (checkoutData.url) {
            window.location.href = checkoutData.url
          } else {
            alert('Failed to create checkout session')
            setLoading(false)
          }
        } else {
          alert(data.error || 'Failed to subscribe')
          setLoading(false)
        }
      }
    } catch (error) {
      alert('Failed to subscribe')
      setLoading(false)
    }
  }

  const priceDisplay = priceCents > 0 
    ? `Subscribe for $${(priceCents / 100).toFixed(2)}/month`
    : 'Subscribe to unlock'

  return (
    <Button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Processing...' : priceDisplay}
    </Button>
  )
}

