'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import SpotifyConnectButton from '@/components/SpotifyConnectButton'

type ListItem = {
  name: string
  description: string
  url: string
}

type ListSourceType = 'MANUAL' | 'SPOTIFY' | 'APPLE_MUSIC'

export default function CreateForm({ listId }: { listId: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [sourceType, setSourceType] = useState<ListSourceType>('MANUAL')
  const [items, setItems] = useState<ListItem[]>([{ name: '', description: '', url: '' }])
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(!!listId)

  useEffect(() => {
    // Check Spotify connection status
    fetch('/api/auth/spotify/status')
      .then((res) => res.json())
      .then((data) => {
        setSpotifyConnected(data.connected || false)
      })
      .catch(() => {
        setSpotifyConnected(false)
      })

    // Check if we just connected (from callback)
    if (searchParams.get('spotify_connected') === '1') {
      setSpotifyConnected(true)
    }

    if (listId) {
      fetch(`/api/lists/${listId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.list) {
            setName(data.list.name)
            setDescription(data.list.description)
            setPrice((data.list.priceCents / 100).toString())
            setIsPublic(data.list.isPublic)
            setSourceType(data.list.sourceType)
            if (data.list.spotifyConfig) {
              setPlaylistUrl(data.list.spotifyConfig.playlistUrl)
              setSpotifyConnected(true)
            }
            if (data.list.items && data.list.items.length > 0) {
              setItems(
                data.list.items
                  .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                  .map((item: any) => ({
                    name: item.name || '',
                    description: item.description || '',
                    url: item.url || '',
                  }))
              )
            }
          }
          setLoadingData(false)
        })
        .catch(() => setLoadingData(false))
    }
  }, [listId, searchParams])

  const addItem = () => {
    setItems([...items, { name: '', description: '', url: '' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ListItem, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Handle empty price
    const priceValue = price.trim() === '' ? '0' : price
    const priceCents = Math.round(parseFloat(priceValue) * 100)
    
    if (isNaN(priceCents) || priceCents < 0) {
      alert('Please enter a valid price')
      setLoading(false)
      return
    }

    // Filter out empty items (items with no name)
    const validItems = sourceType === 'MANUAL' 
      ? items.filter(item => item.name.trim() !== '')
      : []

    // Validate Spotify playlist URL if needed
    if (sourceType === 'SPOTIFY') {
      if (!spotifyConnected) {
        alert('Please connect Spotify first')
        setLoading(false)
        return
      }
      if (!playlistUrl.trim()) {
        alert('Please enter a Spotify playlist URL')
        setLoading(false)
        return
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      priceCents,
      isPublic,
      sourceType,
      items: validItems,
      ...(sourceType === 'SPOTIFY' && { playlistUrl: playlistUrl.trim() }),
    }

    try {
      const url = listId ? `/api/lists/${listId}` : '/api/lists'
      const method = listId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok && data.list) {
        router.push(`/lists/${data.list.slug}`)
      } else {
        console.error('Error saving list:', data)
        alert(data.error || 'Failed to save list')
        setLoading(false)
      }
    } catch (error) {
      console.error('Error saving list:', error)
      alert('Failed to save list')
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">
        {listId ? 'Edit List' : 'Create List'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Name your list"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Describe your list"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        <Input
          label="Monthly subscription price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />
        <p className="text-sm text-gray-600">
          This is a monthly recurring subscription. A $0.50 platform fee will be added to each payment.
        </p>

        <Checkbox
          label="Make this list public"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            How do you want to make your list?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSourceType('MANUAL')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                sourceType === 'MANUAL'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setSourceType('SPOTIFY')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                sourceType === 'SPOTIFY'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Spotify
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceType('APPLE_MUSIC')
                alert('Coming soon')
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                sourceType === 'APPLE_MUSIC'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Apple Music
            </button>
          </div>
        </div>

        {sourceType === 'SPOTIFY' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Connect Spotify
              </label>
              <SpotifyConnectButton />
            </div>
            {spotifyConnected && (
              <div>
                <Input
                  label="Spotify Playlist URL"
                  type="url"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  required
                />
                <p className="mt-1 text-sm text-gray-600">
                  Enter the URL of your Spotify playlist. We'll sync the top 10 songs.
                </p>
              </div>
            )}
          </div>
        )}

        {sourceType === 'MANUAL' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                List items
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={addItem}
              >
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="space-y-3 rounded border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Item {index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  label="Name"
                  value={item.name}
                  onChange={(e) =>
                    updateItem(index, 'name', e.target.value)
                  }
                />
                <Textarea
                  label="Description"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, 'description', e.target.value)
                  }
                  rows={2}
                />
                <Input
                  label="URL"
                  type="url"
                  value={item.url}
                  onChange={(e) => updateItem(index, 'url', e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save List'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

