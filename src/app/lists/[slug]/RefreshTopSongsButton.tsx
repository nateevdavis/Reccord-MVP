'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

export default function RefreshTopSongsButton({ listId }: { listId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/lists/${listId}/refresh-top-songs`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh list')
      }

      setSuccess(true)
      // Reload the page to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh list')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleRefresh}
        disabled={loading}
        variant="secondary"
        className="text-sm"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </Button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-600">Refreshed successfully!</p>
      )}
    </div>
  )
}

