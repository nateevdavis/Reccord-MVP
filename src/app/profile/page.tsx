'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import StripeConnectButton from '@/components/StripeConnectButton'
import AppleMusicConnectButton from '@/components/AppleMusicConnectButton'
import OnboardingChecklist from '@/components/OnboardingChecklist'

type LinkItem = {
  label: string
  url: string
}

type List = {
  id: string
  name: string
  description: string
  slug: string
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([{ label: '', url: '' }])
  const [myLists, setMyLists] = useState<List[]>([])
  const [subscriptions, setSubscriptions] = useState<List[]>([])
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [appleMusicConnected, setAppleMusicConnected] = useState(false)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<string>('not_connected')
  const [disconnectingSpotify, setDisconnectingSpotify] = useState(false)
  const [disconnectingAppleMusic, setDisconnectingAppleMusic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [onboarding, setOnboarding] = useState<{
    hasLists: boolean
    hasMusicConnection: boolean
    hasSubscribers: boolean
  }>({
    hasLists: false,
    hasMusicConnection: false,
    hasSubscribers: false,
  })

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setDisplayName(data.user.displayName || '')
          setUsername(data.user.username || '')
          setBio(data.user.bio || '')
          if (data.user.links && Array.isArray(data.user.links)) {
            setLinks(
              data.user.links.length > 0
                ? data.user.links
                : [{ label: '', url: '' }]
            )
          }
        }
        if (data.myLists) {
          setMyLists(data.myLists)
        }
        if (data.subscriptions) {
          setSubscriptions(data.subscriptions)
        }
        if (data.spotifyConnected !== undefined) {
          setSpotifyConnected(data.spotifyConnected)
        }
        if (data.appleMusicConnected !== undefined) {
          setAppleMusicConnected(data.appleMusicConnected)
        }
        if (data.onboarding) {
          setOnboarding(data.onboarding)
        }
        setLoading(false)
        
        // Fetch Stripe Connect status
        fetch('/api/stripe-connect/status')
          .then((res) => res.json())
          .then((data) => {
            setStripeConnected(data.connected || false)
            setStripeStatus(data.status || 'not_connected')
          })
          .catch(() => {
            setStripeConnected(false)
            setStripeStatus('not_connected')
          })
      })
      .catch(() => setLoading(false))
  }, [])

  // Check if we just connected Stripe (from callback)
  useEffect(() => {
    if (searchParams.get('stripe_connect_success') === '1') {
      fetch('/api/stripe-connect/status')
        .then((res) => res.json())
        .then((data) => {
          setStripeConnected(data.connected || false)
          setStripeStatus(data.status || 'not_connected')
        })
        .catch(() => {
          setStripeConnected(false)
          setStripeStatus('not_connected')
        })
    }
  }, [searchParams])

  const addLink = () => {
    setLinks([...links, { label: '', url: '' }])
  }

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index))
  }

  const updateLink = (index: number, field: keyof LinkItem, value: string) => {
    const newLinks = [...links]
    newLinks[index] = { ...newLinks[index], [field]: value }
    setLinks(newLinks)
  }

  const handleSave = async () => {
    setSaving(true)
    
    // Validate required fields
    if (!displayName.trim()) {
      alert('Display name is required')
      setSaving(false)
      return
    }
    
    if (!username.trim()) {
      alert('Username is required')
      setSaving(false)
      return
    }
    
    // Filter and validate links
    const invalidLinks: string[] = []
    const filteredLinks = links.filter((link) => {
      const hasLabel = link.label && link.label.trim() !== ''
      const hasUrl = link.url && link.url.trim() !== ''
      
      // Basic URL validation
      if (hasLabel && hasUrl) {
        try {
          new URL(link.url.trim())
          return true
        } catch {
          invalidLinks.push(link.label || 'Unnamed link')
          return false
        }
      }
      return false
    })
    
    if (invalidLinks.length > 0) {
      alert(`Invalid URLs for: ${invalidLinks.join(', ')}`)
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          links: filteredLinks.length > 0 ? filteredLinks : null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        router.refresh()
        alert('Profile saved!')
      } else {
        console.error('Error saving profile:', data)
        alert(data.error || 'Failed to save profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnectSpotify = async () => {
    if (!confirm('Are you sure you want to disconnect Spotify? Your Spotify lists will stop syncing.')) {
      return
    }

    setDisconnectingSpotify(true)
    try {
      const res = await fetch('/api/auth/spotify/disconnect', {
        method: 'POST',
      })

      if (res.ok) {
        setSpotifyConnected(false)
        alert('Spotify disconnected successfully')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to disconnect Spotify')
      }
    } catch (error) {
      alert('Failed to disconnect Spotify')
    } finally {
      setDisconnectingSpotify(false)
    }
  }

  const handleDisconnectAppleMusic = async () => {
    if (!confirm('Are you sure you want to disconnect Apple Music? Your Apple Music lists will stop syncing.')) {
      return
    }

    setDisconnectingAppleMusic(true)
    try {
      const res = await fetch('/api/auth/apple-music/disconnect', {
        method: 'POST',
      })

      if (res.ok) {
        setAppleMusicConnected(false)
        alert('Apple Music disconnected successfully')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to disconnect Apple Music')
      }
    } catch (error) {
      alert('Failed to disconnect Apple Music')
    } finally {
      setDisconnectingAppleMusic(false)
    }
  }

  const handleManagePaymentMethods = async () => {
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to open payment portal')
      }
    } catch (error) {
      alert('Failed to open payment portal')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Profile</h1>

      <OnboardingChecklist
        hasLists={onboarding.hasLists}
        hasMusicConnection={onboarding.hasMusicConnection}
        hasSubscribers={onboarding.hasSubscribers}
      />

      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Profile Information
          </h2>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Links
              </label>
              <Button type="button" variant="secondary" onClick={addLink}>
                Add Link
              </Button>
            </div>

            {links.map((link, index) => (
              <div
                key={index}
                className="flex gap-2 rounded border border-gray-200 p-3"
              >
                <input
                  type="text"
                  placeholder="Label"
                  value={link.label}
                  onChange={(e) => updateLink(index, 'label', e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                <input
                  type="url"
                  placeholder="URL"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-gray-200 p-4">
              <div>
                <h3 className="font-medium text-gray-900">Spotify</h3>
                <p className="text-sm text-gray-600">
                  {spotifyConnected
                    ? 'Connected - Your playlists can sync to lists'
                    : 'Not connected'}
                </p>
              </div>
              {spotifyConnected ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDisconnectSpotify}
                  disabled={disconnectingSpotify}
                >
                  {disconnectingSpotify ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : (
                <a
                  href="/api/auth/spotify/authorize?returnUrl=/profile"
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Connect
                </a>
              )}
            </div>

            <div className="flex items-center justify-between rounded border border-gray-200 p-4">
              <div>
                <h3 className="font-medium text-gray-900">Apple Music</h3>
                <p className="text-sm text-gray-600">
                  {appleMusicConnected
                    ? 'Connected - Your playlists can sync to lists'
                    : 'Not connected'}
                </p>
              </div>
              {appleMusicConnected ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDisconnectAppleMusic}
                  disabled={disconnectingAppleMusic}
                >
                  {disconnectingAppleMusic ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : (
                <AppleMusicConnectButton />
              )}
            </div>
            
            <div className="rounded border border-gray-200 p-4">
              <div className="mb-3">
                <h3 className="font-medium text-gray-900">Stripe</h3>
                <p className="text-sm text-gray-600">
                  {stripeConnected && stripeStatus === 'active'
                    ? 'Connected - You can receive payments from list subscriptions'
                    : stripeConnected && stripeStatus === 'pending'
                    ? 'Setup in progress - Complete onboarding to receive payments'
                    : 'Not connected - Required to make lists public and receive payments'}
                </p>
              </div>
              <StripeConnectButton />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
          <div className="rounded border border-gray-200 p-4">
            <p className="mb-4 text-sm text-gray-600">
              Manage your payment methods and billing information for subscriptions.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleManagePaymentMethods}
            >
              Manage Payment Methods
            </Button>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">My Lists</h2>
          {myLists.length === 0 ? (
            <p className="text-gray-600">No lists yet.</p>
          ) : (
            <div className="space-y-2">
              {myLists.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.slug}`}
                  className="block rounded border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {list.name}
                      </h3>
                      <p className="text-sm text-gray-600">{list.description}</p>
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Lists I Subscribe To
          </h2>
          {subscriptions.length === 0 ? (
            <p className="text-gray-600">No subscriptions yet.</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.slug}`}
                  className="block rounded border border-gray-200 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {list.name}
                      </h3>
                      <p className="text-sm text-gray-600">{list.description}</p>
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  )
}

