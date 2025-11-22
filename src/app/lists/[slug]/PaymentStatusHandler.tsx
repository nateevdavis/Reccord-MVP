'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function PaymentStatusHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showSuccess, setShowSuccess] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)
  const hasRefreshed = useRef(false)

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')

    if (success === 'true' && !hasRefreshed.current) {
      setShowSuccess(true)
      hasRefreshed.current = true
      // Refresh the page to update subscription status
      router.refresh()
      // Remove query parameter from URL after a short delay
      setTimeout(() => {
        router.replace(window.location.pathname)
        setShowSuccess(false)
      }, 5000)
    }

    if (canceled === 'true') {
      setShowCanceled(true)
      // Remove query parameter from URL after a short delay
      setTimeout(() => {
        router.replace(window.location.pathname)
        setShowCanceled(false)
      }, 5000)
    }
  }, [searchParams, router])

  if (showSuccess) {
    return (
      <div className="mb-4 rounded border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">
          ✅ Payment successful! Your subscription is now active.
        </p>
      </div>
    )
  }

  if (showCanceled) {
    return (
      <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800">
          Payment was canceled. You can try again when you're ready.
        </p>
      </div>
    )
  }

  return null
}

