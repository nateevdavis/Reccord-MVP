import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { extractPlaylistId, getValidAccessToken, fetchPlaylistTracks, fetchListeningHistory } from '@/lib/spotify'
import { extractPlaylistId as extractApplePlaylistId, getUserToken, getDeveloperToken, fetchPlaylistTracks as fetchApplePlaylistTracks, fetchListeningHistory as fetchAppleListeningHistory } from '@/lib/apple-music'
import { processTopSongs } from '@/lib/top-songs'
import { stripe } from '@/lib/stripe'

const createListSchema = z.object({
  name: z.string().min(1, 'List name is required'),
  description: z.string().optional(),
  priceCents: z.number().int().min(0, 'Price must be >= 0'),
  isPublic: z.boolean(),
  sourceType: z.enum(['MANUAL', 'SPOTIFY', 'APPLE_MUSIC', 'TOP_SONGS']),
  playlistUrl: z.string().optional(), // For Spotify/Apple Music lists
  timeWindow: z.enum(['THIS_WEEK', 'THIS_MONTH', 'PAST_6_MONTHS', 'PAST_YEAR', 'ALL_TIME']).optional(), // For TOP_SONGS
  sources: z.array(z.enum(['SPOTIFY', 'APPLE_MUSIC'])).optional(), // For TOP_SONGS
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Item name is required'),
        description: z.string().optional(),
        url: z
          .string()
          .optional()
          .refine(
            (val) => !val || val === '' || z.string().url().safeParse(val).success,
            { message: 'URL must be a valid URL' }
          ),
      })
    )
    .optional(),
})

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const random = Math.random().toString(36).substring(2, 8)
  return `${base}-${random}`
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 0
  while (true) {
    const existing = await prisma.list.findUnique({ where: { slug } })
    if (!existing) return slug
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await request.json()
    console.log('Creating list with payload:', JSON.stringify(body, null, 2))
    
    // Validate the request body
    let validated
    try {
      validated = createListSchema.parse(body)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error('Validation error details:', JSON.stringify(validationError.errors, null, 2))
        console.error('Received body:', JSON.stringify(body, null, 2))
        return NextResponse.json(
          { 
            error: validationError.errors[0].message,
            details: validationError.errors 
          },
          { status: 400 }
        )
      }
      throw validationError
    }

    const baseSlug = generateSlug(validated.name)
    const slug = await ensureUniqueSlug(baseSlug)

    // Validate Stripe Connect account if making list public
    if (validated.isPublic) {
      const stripeConnectAccount = await prisma.stripeConnectAccount.findUnique({
        where: { userId },
      })

      if (!stripeConnectAccount) {
        return NextResponse.json(
          { error: 'You must connect your Stripe account before making a list public. Please connect your Stripe account first.' },
          { status: 400 }
        )
      }

      // Verify the account is active and can receive payments
      try {
        const connectAccount = await stripe.accounts.retrieve(
          stripeConnectAccount.stripeAccountId
        )

        if (!connectAccount.charges_enabled) {
          return NextResponse.json(
            { error: 'Your Stripe account is not ready to receive payments. Please complete the onboarding process.' },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('Error verifying Stripe Connect account:', error)
        return NextResponse.json(
          { error: 'Unable to verify Stripe account. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Handle Spotify list creation
    if (validated.sourceType === 'SPOTIFY') {
      if (!validated.playlistUrl) {
        return NextResponse.json(
          { error: 'Playlist URL is required for Spotify lists' },
          { status: 400 }
        )
      }

      // Check if user has Spotify connection
      const spotifyConnection = await prisma.spotifyConnection.findUnique({
        where: { userId },
      })

      if (!spotifyConnection) {
        return NextResponse.json(
          { error: 'Spotify not connected. Please connect Spotify first.' },
          { status: 400 }
        )
      }

      // Extract playlist ID from URL
      const playlistId = extractPlaylistId(validated.playlistUrl)
      if (!playlistId) {
        return NextResponse.json(
          { error: 'Invalid Spotify playlist URL' },
          { status: 400 }
        )
      }

      // Get valid access token
      const accessToken = await getValidAccessToken(userId)

      // Fetch playlist tracks
      const tracks = await fetchPlaylistTracks(accessToken, playlistId)

      // Create list with Spotify config and items
      const list = await prisma.list.create({
        data: {
          ownerId: userId,
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
          sourceType: validated.sourceType,
          slug,
          spotifyConfig: {
            create: {
              playlistId,
              playlistUrl: validated.playlistUrl,
              lastSyncedAt: new Date(),
            },
          },
          items: {
            create: tracks.map((track, index) => ({
              name: track.name,
              description: track.description || null,
              url: track.url || null,
              sortOrder: index,
            })),
          },
        },
        include: {
          items: true,
          spotifyConfig: true,
        },
      })

      return NextResponse.json({ list }, { status: 201 })
    }

    // Handle Apple Music list creation
    if (validated.sourceType === 'APPLE_MUSIC') {
      if (!validated.playlistUrl) {
        return NextResponse.json(
          { error: 'Playlist URL is required for Apple Music lists' },
          { status: 400 }
        )
      }

      // Check if user has Apple Music connection
      const appleMusicConnection = await prisma.appleMusicConnection.findUnique({
        where: { userId },
      })

      if (!appleMusicConnection) {
        return NextResponse.json(
          { error: 'Apple Music not connected. Please connect Apple Music first.' },
          { status: 400 }
        )
      }

      // Extract playlist ID from URL
      const playlistId = extractApplePlaylistId(validated.playlistUrl)
      if (!playlistId) {
        return NextResponse.json(
          { error: 'Invalid Apple Music playlist URL' },
          { status: 400 }
        )
      }

      // Get developer token and user token
      const developerToken = await getDeveloperToken()
      const userToken = await getUserToken(userId)

      // Fetch playlist tracks
      const tracks = await fetchApplePlaylistTracks(developerToken, userToken, playlistId)

      // Create list with Apple Music config and items
      const list = await prisma.list.create({
        data: {
          ownerId: userId,
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
          sourceType: validated.sourceType,
          slug,
          appleMusicConfig: {
            create: {
              playlistId,
              playlistUrl: validated.playlistUrl,
              lastSyncedAt: new Date(),
            },
          },
          items: {
            create: tracks.map((track, index) => ({
              name: track.name,
              description: track.description || null,
              url: track.url || null,
              sortOrder: index,
            })),
          },
        },
        include: {
          items: true,
          appleMusicConfig: true,
        },
      })

      return NextResponse.json({ list }, { status: 201 })
    }

    // Handle Top Songs list creation
    if (validated.sourceType === 'TOP_SONGS') {
      if (!validated.timeWindow) {
        return NextResponse.json(
          { error: 'Time window is required for Top Songs lists' },
          { status: 400 }
        )
      }

      if (!validated.sources || validated.sources.length === 0) {
        return NextResponse.json(
          { error: 'At least one source (Spotify or Apple Music) is required' },
          { status: 400 }
        )
      }

      // Check which services are connected
      const spotifyConnection = await prisma.spotifyConnection.findUnique({
        where: { userId },
      })
      const appleMusicConnection = await prisma.appleMusicConnection.findUnique({
        where: { userId },
      })

      // Validate that requested sources are actually connected
      const connectedSources: string[] = []
      if (validated.sources.includes('SPOTIFY')) {
        if (!spotifyConnection) {
          return NextResponse.json(
            { error: 'Spotify not connected. Please connect Spotify first.' },
            { status: 400 }
          )
        }
        connectedSources.push('SPOTIFY')
      }
      if (validated.sources.includes('APPLE_MUSIC')) {
        if (!appleMusicConnection) {
          return NextResponse.json(
            { error: 'Apple Music not connected. Please connect Apple Music first.' },
            { status: 400 }
          )
        }
        connectedSources.push('APPLE_MUSIC')
      }

      // Fetch tracks from selected sources
      let spotifyTracks: any[] = []
      let appleMusicTracks: any[] = []
      let spotifyError: string | null = null
      let appleMusicError: string | null = null

      if (connectedSources.includes('SPOTIFY')) {
        try {
          const accessToken = await getValidAccessToken(userId)
          spotifyTracks = await fetchListeningHistory(accessToken, validated.timeWindow)
          console.log(`Fetched ${spotifyTracks.length} Spotify tracks for time window ${validated.timeWindow}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('Error fetching Spotify listening history:', error)
          console.error('Error details:', errorMessage)
          spotifyError = errorMessage
          // Continue with other sources even if one fails
        }
      }

      if (connectedSources.includes('APPLE_MUSIC')) {
        try {
          const developerToken = await getDeveloperToken()
          const userToken = await getUserToken(userId)
          appleMusicTracks = await fetchAppleListeningHistory(developerToken, userToken, validated.timeWindow)
          console.log(`Fetched ${appleMusicTracks.length} Apple Music tracks for time window ${validated.timeWindow}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('Error fetching Apple Music listening history:', error)
          console.error('Error details:', errorMessage)
          appleMusicError = errorMessage
          // Continue with other sources even if one fails
        }
      }

      // Process and deduplicate tracks
      const topTracks = processTopSongs(spotifyTracks, appleMusicTracks)

      if (topTracks.length === 0) {
        // Build a more helpful error message
        const errorMessages: string[] = []
        if (spotifyError) {
          errorMessages.push(`Spotify: ${spotifyError}`)
        }
        if (appleMusicError) {
          errorMessages.push(`Apple Music: ${appleMusicError}`)
        }
        
        const errorDetails = errorMessages.length > 0 
          ? ` Errors: ${errorMessages.join('; ')}.` 
          : ''
        
        return NextResponse.json(
          { 
            error: `No listening history found for the selected time window. Try a different time range or ensure you have played music recently.${errorDetails}`,
            details: {
              spotifyTracksCount: spotifyTracks.length,
              appleMusicTracksCount: appleMusicTracks.length,
              spotifyError,
              appleMusicError,
            }
          },
          { status: 400 }
        )
      }

      // Create list with Top Songs config and items
      const list = await prisma.list.create({
        data: {
          ownerId: userId,
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
          sourceType: validated.sourceType,
          slug,
          topSongsConfig: {
            create: {
              timeWindow: validated.timeWindow,
              sources: connectedSources,
              lastSyncedAt: new Date(),
            },
          },
          items: {
            create: topTracks.map((track, index) => ({
              name: track.name,
              description: track.artist,
              url: track.url || null,
              sortOrder: index,
              isrc: track.isrc || null,
              albumName: track.album || null,
              sourceService: track.sourceServices.join(','), // Store comma-separated services
            })),
          },
        },
        include: {
          items: true,
          topSongsConfig: true,
        },
      })

      return NextResponse.json({ list }, { status: 201 })
    }

    // Handle manual list creation
    const list = await prisma.list.create({
      data: {
        ownerId: userId,
        name: validated.name,
        description: validated.description || '',
        priceCents: validated.priceCents,
        isPublic: validated.isPublic,
        sourceType: validated.sourceType,
        slug,
        items:
          validated.sourceType === 'MANUAL' && validated.items && validated.items.length > 0
            ? {
                create: validated.items
                  .filter((item) => item.name && item.name.trim() !== '')
                  .map((item, index) => ({
                    name: item.name.trim(),
                    description: item.description?.trim() || null,
                    url: item.url?.trim() || null,
                    sortOrder: index,
                  })),
              }
            : undefined,
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ list }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors)
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating list:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: `Failed to create list: ${errorMessage}` },
      { status: 500 }
    )
  }
}

