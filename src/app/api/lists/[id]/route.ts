import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { extractPlaylistId, getValidAccessToken, fetchPlaylistTracks } from '@/lib/spotify'
import { stripe } from '@/lib/stripe'

const updateListSchema = z.object({
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth()
    const { id } = await params
    const list = await prisma.list.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
        spotifyConfig: true,
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.ownerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ list })
  } catch (error) {
    console.error('Error fetching list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth()
    const { id } = await params
    const list = await prisma.list.findUnique({
      where: { id },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.ownerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    console.log('Updating list with payload:', JSON.stringify(body, null, 2))
    const validated = updateListSchema.parse(body)

    // Validate Stripe Connect account if making list public (or if it's already public and staying public)
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

    // Handle Spotify list updates
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

      // Delete existing items
      await prisma.listItem.deleteMany({
        where: { listId: id },
      })

      // Update or create Spotify config
      const existingConfig = await prisma.spotifyListConfig.findUnique({
        where: { listId: id },
      })

      if (existingConfig) {
        await prisma.spotifyListConfig.update({
          where: { id: existingConfig.id },
          data: {
            playlistId,
            playlistUrl: validated.playlistUrl,
            lastSyncedAt: new Date(),
          },
        })
      } else {
        await prisma.spotifyListConfig.create({
          data: {
            listId: id,
            playlistId,
            playlistUrl: validated.playlistUrl,
            lastSyncedAt: new Date(),
          },
        })
      }

      // Update list and create new items
      const updatedList = await prisma.list.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
          sourceType: validated.sourceType,
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

      return NextResponse.json({ list: updatedList })
    }

    // Handle manual list updates
    // Delete existing items
    await prisma.listItem.deleteMany({
      where: { listId: id },
    })

    // Update list and create new items
    const updatedList = await prisma.list.update({
      where: { id },
      data: {
        name: validated.name,
        description: validated.description || '',
        priceCents: validated.priceCents,
        isPublic: validated.isPublic,
        sourceType: validated.sourceType,
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

    return NextResponse.json({ list: updatedList })
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
    console.error('Error updating list:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: `Failed to update list: ${errorMessage}` },
      { status: 500 }
    )
  }
}

