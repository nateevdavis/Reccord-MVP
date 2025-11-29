'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import SpotifyConnectButton from '@/components/SpotifyConnectButton'
import AppleMusicConnectButton from '@/components/AppleMusicConnectButton'
import StripeConnectButton from '@/components/StripeConnectButton'
import { useTutorial } from '@/contexts/TutorialContext'
import TutorialModal from '@/components/TutorialModal'
import { getStepById } from '@/lib/tutorialSteps'

type ListItem = {
  name: string
  description: string
  url: string
}

type ListSourceType = 'MANUAL' | 'SPOTIFY' | 'APPLE_MUSIC'

export default function CreateForm({ listId }: { listId: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentStep, isActive, isCompleted, startTutorial, nextStep, setContext } = useTutorial()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [sourceType, setSourceType] = useState<ListSourceType>('MANUAL')
  const [items, setItems] = useState<ListItem[]>([{ name: '', description: '', url: '' }])
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [appleMusicConnected, setAppleMusicConnected] = useState(false)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<string>('not_connected')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(!!listId)

  // Extract specific params outside useEffect to avoid infinite loops
  const spotifyConnectedParam = searchParams.get('spotify_connected')
  const appleMusicConnectedParam = searchParams.get('apple_music_connected')
  const stripeSuccessParam = searchParams.get('stripe_connect_success')
  const tutorialParam = searchParams.get('tutorial')

  useEffect(() => {
    const abortController = new AbortController()
    
    // Check if we just connected (from callback) - check this first
    if (spotifyConnectedParam === '1') {
      setSpotifyConnected(true)
    }
    if (appleMusicConnectedParam === '1') {
      setAppleMusicConnected(true)
    }
    if (stripeSuccessParam === '1') {
      setStripeConnected(true)
      setStripeStatus('active')
    }

    // Only check status via API if we don't have URL params indicating connection
    // This prevents unnecessary API calls when we already know the status
    const shouldCheckStatus = !spotifyConnectedParam && !appleMusicConnectedParam && !stripeSuccessParam

    if (shouldCheckStatus) {
      // Batch status checks with small delays to avoid overwhelming the browser
      const checkStatus = async () => {
        try {
          // Check Spotify connection status
          const spotifyRes = await fetch('/api/auth/spotify/status', {
            signal: abortController.signal,
          })
          if (!abortController.signal.aborted) {
            const spotifyData = await spotifyRes.json()
            setSpotifyConnected(spotifyData.connected || false)
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            setSpotifyConnected(false)
          }
        }

        // Small delay before next request
        await new Promise(resolve => setTimeout(resolve, 100))

        try {
          // Check Apple Music connection status
          const appleRes = await fetch('/api/auth/apple-music/status', {
            signal: abortController.signal,
          })
          if (!abortController.signal.aborted) {
            const appleData = await appleRes.json()
            setAppleMusicConnected(appleData.connected || false)
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            setAppleMusicConnected(false)
          }
        }

        // Small delay before next request
        await new Promise(resolve => setTimeout(resolve, 100))

        try {
          // Check Stripe Connect connection status
          const stripeRes = await fetch('/api/stripe-connect/status', {
            signal: abortController.signal,
          })
          if (!abortController.signal.aborted) {
            const stripeData = await stripeRes.json()
            setStripeConnected(stripeData.connected || false)
            setStripeStatus(stripeData.status || 'not_connected')
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            setStripeConnected(false)
            setStripeStatus('not_connected')
          }
        }
      }

      checkStatus()
    }

    if (listId) {
      fetch(`/api/lists/${listId}`, { signal: abortController.signal })
        .then((res) => res.json())
        .then((data) => {
          if (!abortController.signal.aborted && data.list) {
            setName(data.list.name)
            setDescription(data.list.description)
            setPrice((data.list.priceCents / 100).toString())
            setIsPublic(data.list.isPublic)
            setSourceType(data.list.sourceType)
            if (data.list.spotifyConfig) {
              setPlaylistUrl(data.list.spotifyConfig.playlistUrl)
              setSpotifyConnected(true)
            }
            if (data.list.appleMusicConfig) {
              setPlaylistUrl(data.list.appleMusicConfig.playlistUrl)
              setAppleMusicConnected(true)
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
            setLoadingData(false)
          }
        })
        .catch(() => {
          if (!abortController.signal.aborted) {
            setLoadingData(false)
          }
        })
    }

    // Start tutorial if on create page (not edit) and tutorial hasn't started
    if (!listId && !isActive && !isCompleted) {
      const hasVisitedCreateKey = 'reccord_has_visited_create'
      
      // Check if user has visited /create before
      const hasVisitedCreate = typeof window !== 'undefined' 
        ? localStorage.getItem(hasVisitedCreateKey) === 'true'
        : false
      
      // Start tutorial if:
      // 1. URL has ?tutorial=start param (explicit trigger from Nav or OnboardingChecklist)
      // 2. OR it's their first visit to /create (haven't visited before)
      const shouldStart = tutorialParam === 'start' || !hasVisitedCreate
      
      if (shouldStart && !isCompleted) {
        // Mark that user has visited /create (even if tutorial doesn't start)
        if (typeof window !== 'undefined') {
          localStorage.setItem(hasVisitedCreateKey, 'true')
        }
        
        // Small delay to ensure page is rendered and context is ready
        setTimeout(() => {
          if (tutorialParam === 'start') {
            // If we're already on /create page with ?tutorial=start, skip 'create-list' step
            // and start directly at 'title' step since user already clicked "Create"
            startTutorial('title')
          } else {
            // Normal flow: start with 'create-list' step (which shows in Nav)
            startTutorial()
          }
        }, 300)
      }
    }

    return () => {
      abortController.abort()
    }
    // Include tutorialParam in dependencies so tutorial starts when URL param changes
    // Only depend on specific param values, not the whole searchParams object
    // This prevents infinite loops when searchParams object reference changes
  }, [listId, spotifyConnectedParam, appleMusicConnectedParam, stripeSuccessParam, tutorialParam, isActive, isCompleted, startTutorial])


  // Update tutorial context when sourceType changes
  useEffect(() => {
    if (isActive) {
      setContext({ sourceType })
    }
  }, [sourceType, isActive, setContext])

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

    // Validate Apple Music playlist URL if needed
    if (sourceType === 'APPLE_MUSIC') {
      if (!appleMusicConnected) {
        alert('Please connect Apple Music first')
        setLoading(false)
        return
      }
      if (!playlistUrl.trim()) {
        alert('Please enter an Apple Music playlist URL')
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
      ...((sourceType === 'SPOTIFY' || sourceType === 'APPLE_MUSIC') && { playlistUrl: playlistUrl.trim() }),
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
        // Advance to share step if in tutorial
        if (isActive && currentStep === 'save') {
          nextStep()
        }
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
        {isActive && currentStep === 'title' && getStepById('title') && (
          <TutorialModal step={getStepById('title')!} />
        )}
        <div data-tutorial="title">
          <Input
            label="Name your list"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              // Advance tutorial if on title step
              if (isActive && currentStep === 'title' && e.target.value.trim()) {
                setTimeout(() => nextStep(), 300)
              }
            }}
            required
          />
        </div>

        {isActive && currentStep === 'description' && getStepById('description') && (
          <TutorialModal step={getStepById('description')!} />
        )}
        <div data-tutorial="description">
          <Textarea
            label="Describe your list"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              // Advance tutorial if on description step
              if (isActive && currentStep === 'description' && e.target.value.trim()) {
                setTimeout(() => nextStep(), 300)
              }
            }}
            rows={4}
          />
        </div>

        {isActive && currentStep === 'price' && getStepById('price') && (
          <TutorialModal step={getStepById('price')!} />
        )}
        <div data-tutorial="price">
          <Input
            label="Monthly subscription price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              // Advance tutorial if on price step
              if (isActive && currentStep === 'price' && e.target.value.trim()) {
                setTimeout(() => nextStep(), 300)
              }
            }}
            placeholder="0.00"
          />
        </div>
        <p className="text-sm text-gray-600">
          This is a monthly recurring subscription. A $0.50 platform fee will be added to each payment.
        </p>

        {isActive && currentStep === 'public' && getStepById('public') && (
          <TutorialModal step={getStepById('public')!} />
        )}
        <div data-tutorial="public">
          <Checkbox
            label="Make this list public"
            checked={isPublic}
            onChange={(e) => {
              setIsPublic(e.target.checked)
              // Advance tutorial if on public step
              if (isActive && currentStep === 'public') {
                setTimeout(() => nextStep(), 300)
              }
            }}
          />
        </div>
        {isPublic && (!stripeConnected || stripeStatus !== 'active') && (
          <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="mb-2 text-sm text-yellow-800">
              You must connect your Stripe account to make a list public. This allows you to receive payments from subscribers.
            </p>
            <StripeConnectButton />
          </div>
        )}

        {isActive && currentStep === 'source-type' && getStepById('source-type') && (
          <TutorialModal step={getStepById('source-type')!} />
        )}
        <div data-tutorial="source-type">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            How do you want to make your list?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceType('MANUAL')
                // Advance tutorial if on source-type step
                if (isActive && currentStep === 'source-type') {
                  setTimeout(() => nextStep({ sourceType: 'MANUAL' }), 300)
                }
              }}
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
              onClick={() => {
                setSourceType('SPOTIFY')
                // Advance tutorial if on source-type step
                if (isActive && currentStep === 'source-type') {
                  setTimeout(() => nextStep({ sourceType: 'SPOTIFY' }), 300)
                }
              }}
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
                // Advance tutorial if on source-type step
                if (isActive && currentStep === 'source-type') {
                  setTimeout(() => nextStep({ sourceType: 'APPLE_MUSIC' }), 300)
                }
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
                {isActive && currentStep === 'music-url' && getStepById('music-url') && (
                  <TutorialModal step={getStepById('music-url')!} />
                )}
                <div data-tutorial="music-url">
                  <Input
                    label="Spotify Playlist URL"
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => {
                      setPlaylistUrl(e.target.value)
                      // Auto-advance when URL is entered
                      if (isActive && currentStep === 'music-url' && e.target.value.trim()) {
                        setTimeout(() => nextStep(), 300)
                      }
                    }}
                    placeholder="https://open.spotify.com/playlist/..."
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Enter the URL of your Spotify playlist. We'll sync the top 10 songs.
                </p>
              </div>
            )}
          </div>
        )}

        {sourceType === 'APPLE_MUSIC' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Connect Apple Music
              </label>
              <AppleMusicConnectButton />
            </div>
            {appleMusicConnected && (
              <div>
                {isActive && currentStep === 'music-url' && getStepById('music-url') && (
                  <TutorialModal step={getStepById('music-url')!} />
                )}
                <div data-tutorial="music-url">
                  <Input
                    label="Apple Music Playlist URL"
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => {
                      setPlaylistUrl(e.target.value)
                      // Auto-advance when URL is entered
                      if (isActive && currentStep === 'music-url' && e.target.value.trim()) {
                        setTimeout(() => nextStep(), 300)
                      }
                    }}
                    placeholder="https://music.apple.com/us/playlist/..."
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Enter the URL of your Apple Music playlist. We'll sync the top 10 songs.
                </p>
              </div>
            )}
          </div>
        )}

        {sourceType === 'MANUAL' && (
          <div className="space-y-4">
            {isActive && currentStep === 'manual-item' && getStepById('manual-item') && (
              <TutorialModal step={getStepById('manual-item')!} />
            )}
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
                data-tutorial={index === 0 ? 'manual-item' : undefined}
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
                  onChange={(e) => {
                    updateItem(index, 'name', e.target.value)
                    // Auto-advance when first item name is entered
                    if (isActive && currentStep === 'manual-item' && index === 0 && e.target.value.trim()) {
                      setTimeout(() => nextStep(), 300)
                    }
                  }}
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

        {isActive && currentStep === 'save' && getStepById('save') && (
          <TutorialModal step={getStepById('save')!} />
        )}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading} data-tutorial="save">
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

