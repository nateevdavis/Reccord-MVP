import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { extractPlaylistId, getValidAccessToken, fetchPlaylistTracks } from '@/lib/spotify'
import { stripe } from '@/lib/stripe'

const createListSchema = z.object({
  name: z.string().min(1, 'List name is required'),
  description: z.string().optional(),
  priceCents: z.number().int().min(0, 'Price must be >= 0'),
  isPublic: z.boolean(),
  sourceType: z.enum(['MANUAL', 'SPOTIFY', 'APPLE_MUSIC']),
  playlistUrl: z.string().optional(), // For Spotify lists
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
    const validated = createListSchema.parse(body)

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
          validated.sourceType === 'MANUAL' && validated.items
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

