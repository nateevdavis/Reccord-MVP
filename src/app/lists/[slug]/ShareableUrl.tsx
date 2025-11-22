'use client'

import { useState, useEffect } from 'react'

export default function ShareableUrl({ slug }: { slug: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Get the full URL on the client side
    const fullUrl = `${window.location.origin}/lists/${slug}`
    setUrl(fullUrl)
  }, [slug])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-sm font-medium text-gray-700">
        Share this list
      </p>
      <p className="mb-3 text-xs text-gray-600">
        Share this URL with others. They'll see the list name and description, but items will be blurred until they subscribe.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
        <button
          onClick={handleCopy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}








