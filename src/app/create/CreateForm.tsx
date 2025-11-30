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
  const [hasExistingLists, setHasExistingLists] = useState(false)

  // Form state persistence key
  const FORM_STATE_KEY = 'reccord_create_form_state'

  // Extract specific params outside useEffect to avoid infinite loops
  const spotifyConnectedParam = searchParams.get('spotify_connected')
  const appleMusicConnectedParam = searchParams.get('apple_music_connected')
  const stripeSuccessParam = searchParams.get('stripe_connect_success')
  const tutorialParam = searchParams.get('tutorial')

  useEffect(() => {
    const abortController = new AbortController()
    
    // Restore form state from localStorage if coming back from Spotify/Apple Music connection
    if ((spotifyConnectedParam === '1' || appleMusicConnectedParam === '1') && !listId) {
      try {
        const savedState = localStorage.getItem(FORM_STATE_KEY)
        if (savedState) {
          const parsed = JSON.parse(savedState)
          setName(parsed.name || '')
          setDescription(parsed.description || '')
          setPrice(parsed.price || '')
          setIsPublic(parsed.isPublic || false)
          setSourceType(parsed.sourceType || 'MANUAL')
          setItems(parsed.items || [{ name: '', description: '', url: '' }])
          setPlaylistUrl(parsed.playlistUrl || '')
          // Clear saved state after restoring
          localStorage.removeItem(FORM_STATE_KEY)
        }
      } catch (error) {
        console.error('Error restoring form state:', error)
        // Clear invalid state
        localStorage.removeItem(FORM_STATE_KEY)
      }
    }
    
    // Check if we just connected (from callback) - check this first
    if (spotifyConnectedParam === '1') {
      setSpotifyConnected(true)
      // Advance tutorial if waiting for connection
      if (isActive && (currentStep === 'connect-spotify')) {
        setTimeout(() => {
          setContext({ sourceType, spotifyConnected: true, appleMusicConnected })
          nextStep({ sourceType, spotifyConnected: true, appleMusicConnected })
        }, 300)
      }
    }
    if (appleMusicConnectedParam === '1') {
      setAppleMusicConnected(true)
      // Advance tutorial if waiting for connection
      if (isActive && (currentStep === 'connect-apple-music')) {
        setTimeout(() => {
          setContext({ sourceType, spotifyConnected, appleMusicConnected: true })
          nextStep({ sourceType, spotifyConnected, appleMusicConnected: true })
        }, 300)
      }
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
    // IMPORTANT: Check if tutorial is already active from localStorage resume
    // If it is, don't try to start it again
    // Also check if user already has lists - if they do, don't start tutorial
    if (!listId && !isCompleted && !hasExistingLists) {
      const hasVisitedCreateKey = 'reccord_has_visited_create'
      
      // Check if user has visited /create before
      const hasVisitedCreate = typeof window !== 'undefined' 
        ? localStorage.getItem(hasVisitedCreateKey) === 'true'
        : false
      
      // Start tutorial if:
      // 1. Tutorial is not already active (from localStorage resume)
      // 2. AND (URL has ?tutorial=start param OR it's their first visit to /create)
      const shouldStart = !isActive && (tutorialParam === 'start' || !hasVisitedCreate)
      
      // Debug logging - always log to help diagnose
      if (typeof window !== 'undefined') {
        console.log('Tutorial Start Check:', {
          listId,
          isActive,
          isCompleted,
          tutorialParam,
          hasVisitedCreate,
          shouldStart,
          willStart: shouldStart && !isCompleted,
          currentStep
        })
      }
      
      if (shouldStart && !isCompleted) {
        // Mark that user has visited /create (even if tutorial doesn't start)
        if (typeof window !== 'undefined') {
          localStorage.setItem(hasVisitedCreateKey, 'true')
        }
        
        // Small delay to ensure page is rendered and context is ready
        setTimeout(() => {
          // Double-check conditions before starting
          if (isCompleted) {
            console.warn('Tutorial marked as completed, not starting')
            return
          }
          
          if (isActive) {
            console.log('Tutorial already active, not starting again', { currentStep })
            return
          }
          
          if (tutorialParam === 'start') {
            // If we're already on /create page with ?tutorial=start, skip 'create-list' step
            // and start directly at 'source-type' step since user already clicked "Create"
            console.log('🚀 Starting tutorial at source-type step (from ?tutorial=start)')
            startTutorial('source-type')
          } else {
            // Normal flow: start with 'create-list' step (which shows in Nav)
            console.log('🚀 Starting tutorial at create-list step (first visit)')
            startTutorial()
          }
          
          // Verify tutorial started after a short delay
          setTimeout(() => {
            console.log('Tutorial state after start:', {
              isActive: true, // We just set it, so check context
              currentStep: tutorialParam === 'start' ? 'source-type' : 'create-list' // Should be set by startTutorial
            })
          }, 100)
        }, 500) // Increased delay to ensure DOM is ready
      } else {
        // Debug logging
        if (typeof window !== 'undefined') {
          console.log('❌ Tutorial not starting:', {
            listId,
            isActive,
            isCompleted,
            tutorialParam,
            hasVisitedCreate,
            shouldStart,
            currentStep,
            reason: isCompleted 
              ? 'already completed' 
              : isActive 
              ? 'already active (resumed from localStorage?)' 
              : !shouldStart 
              ? 'conditions not met' 
              : 'unknown'
          })
        }
      }
    }

    return () => {
      abortController.abort()
    }
    // Only depend on specific param values, not the whole searchParams object
    // This prevents infinite loops when searchParams object reference changes
    // Note: startTutorial is intentionally omitted from deps to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, spotifyConnectedParam, appleMusicConnectedParam, stripeSuccessParam, tutorialParam, isActive, isCompleted])


  // Update tutorial context when sourceType or connection status changes
  useEffect(() => {
    if (isActive) {
      setContext({ 
        sourceType,
        spotifyConnected,
        appleMusicConnected
      })
    }
  }, [sourceType, spotifyConnected, appleMusicConnected, isActive, setContext])

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

    const payload: any = {
      name: name.trim(),
      description: description.trim(),
      priceCents,
      isPublic,
      sourceType,
      ...((sourceType === 'SPOTIFY' || sourceType === 'APPLE_MUSIC') && { playlistUrl: playlistUrl.trim() }),
    }
    
    // Only include items if sourceType is MANUAL and we have valid items
    // Don't send empty array - either send items or omit the field
    if (sourceType === 'MANUAL' && validItems.length > 0) {
      payload.items = validItems
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
        console.error('Payload sent:', JSON.stringify(payload, null, 2))
        console.error('Response status:', res.status)
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

  // Debug: Log tutorial state on render and handle stale localStorage
  useEffect(() => {
    // Only log if we're on the create page (not editing)
    if (!listId) {
      console.log('CreateForm render - Tutorial state:', {
        currentStep,
        isActive,
        isCompleted,
        tutorialParam,
        hasDataAttribute: typeof document !== 'undefined' ? !!document.querySelector('[data-tutorial="title"]') : false,
        localStorageProgress: typeof window !== 'undefined' ? localStorage.getItem('reccord_tutorial_progress') : null
      })
      
      // If tutorial is active but on a step that doesn't exist on this page (like 'create-list' or 'share'),
      // it's probably stale data - clear it and restart
      if (isActive && currentStep && typeof window !== 'undefined') {
        const validStepsForCreatePage = ['source-type', 'title', 'description', 'price', 'public', 'connect-spotify', 'connect-apple-music', 'music-url', 'manual-item', 'save']
        if (!validStepsForCreatePage.includes(currentStep)) {
          console.warn(`Tutorial step "${currentStep}" is not valid for /create page, clearing stale localStorage`)
          localStorage.removeItem('reccord_tutorial_progress')
          // Don't restart here - let the normal flow handle it
        }
      }
    }
  }, [currentStep, isActive, isCompleted, tutorialParam, listId])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">
        {listId ? 'Edit List' : 'Create List'}
      </h1>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 rounded bg-gray-100 p-2 text-xs">
          <div>Tutorial State: {isActive ? 'ACTIVE' : 'INACTIVE'}</div>
          <div>Current Step: {currentStep || 'none'}</div>
          <div>Completed: {isCompleted ? 'YES' : 'NO'}</div>
          <div>Tutorial Param: {tutorialParam || 'none'}</div>
          {!isActive && !isCompleted && (
            <button
              onClick={() => {
                console.log('Manual tutorial start triggered')
                startTutorial('source-type')
              }}
              className="mt-2 rounded bg-blue-500 px-2 py-1 text-white"
            >
              Force Start Tutorial
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  setTimeout(() => {
                    setContext({ sourceType: 'SPOTIFY', spotifyConnected, appleMusicConnected })
                    nextStep({ sourceType: 'SPOTIFY', spotifyConnected, appleMusicConnected })
                  }, 300)
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
                  setTimeout(() => {
                    setContext({ sourceType: 'APPLE_MUSIC', spotifyConnected, appleMusicConnected })
                    nextStep({ sourceType: 'APPLE_MUSIC', spotifyConnected, appleMusicConnected })
                  }, 300)
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

        {sourceType === 'SPOTIFY' && (
          <div className="space-y-4">
            {isActive && currentStep === 'connect-spotify' && getStepById('connect-spotify') && (
              <TutorialModal step={getStepById('connect-spotify')!} />
            )}
            <div data-tutorial="connect-spotify">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Connect Spotify
              </label>
              <SpotifyConnectButton 
                onBeforeConnect={() => {
                  // Save form state before redirecting
                  const formState = {
                    name,
                    description,
                    price,
                    isPublic,
                    sourceType: 'SPOTIFY',
                    items,
                    playlistUrl,
                  }
                  localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState))
                }}
              />
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
            {isActive && currentStep === 'connect-apple-music' && getStepById('connect-apple-music') && (
              <TutorialModal step={getStepById('connect-apple-music')!} />
            )}
            <div data-tutorial="connect-apple-music">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Connect Apple Music
              </label>
              <AppleMusicConnectButton 
                onBeforeConnect={() => {
                  // Save form state before connecting
                  const formState = {
                    name,
                    description,
                    price,
                    isPublic,
                    sourceType: 'APPLE_MUSIC',
                    items,
                    playlistUrl,
                  }
                  localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState))
                }}
              />
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
            {/* Render tutorial modal after items are rendered so target element exists */}
            {isActive && currentStep === 'manual-item' && getStepById('manual-item') && (
              <TutorialModal step={getStepById('manual-item')!} />
            )}
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

