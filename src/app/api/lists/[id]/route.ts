import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { extractPlaylistId, getValidAccessToken, fetchPlaylistTracks } from '@/lib/spotify'
import { extractPlaylistId as extractApplePlaylistId, getUserToken, getDeveloperToken, fetchPlaylistTracks as fetchApplePlaylistTracks } from '@/lib/apple-music'
import { stripe } from '@/lib/stripe'

const updateListSchema = z.object({
  name: z.string().min(1, 'List name is required'),
  description: z.string().optional(),
  priceCents: z.number().int().min(0, 'Price must be >= 0'),
  isPublic: z.boolean(),
  sourceType: z.enum(['MANUAL', 'SPOTIFY', 'APPLE_MUSIC', 'TOP_SONGS']),
  playlistUrl: z.string().optional(), // For Spotify/Apple Music lists
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
        appleMusicConfig: true,
        topSongsConfig: true,
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

    // Get existing list with configs to check if we need to re-sync
    const existingList = await prisma.list.findUnique({
      where: { id },
      include: {
        spotifyConfig: true,
        appleMusicConfig: true,
        topSongsConfig: true,
      },
    })

    if (!existingList) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Check if price changed (for email notifications later)
    const priceChanged = existingList.priceCents !== validated.priceCents
    const oldPriceCents = existingList.priceCents

    // Validate price increase if price is changing
    if (priceChanged && validated.priceCents > oldPriceCents) {
      const priceIncrease = validated.priceCents - oldPriceCents
      const percentageIncrease = (priceIncrease / oldPriceCents) * 100

      // Block price increases over 100%
      if (percentageIncrease > 100) {
        return NextResponse.json(
          {
            error: "Price increases over 100% are restricted as our policy to protect subscribers. If you need to increase your list price by more than 100%, please contact us at help@reccord.co with your proposal and reasoning. We're happy to accommodate increases of this size after a manual review."
          },
          { status: 400 }
        )
      }
    }

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

    // For synced lists (SPOTIFY, APPLE_MUSIC, TOP_SONGS), check if we're only updating metadata
    const isSyncedList = existingList.sourceType === 'SPOTIFY' || 
                         existingList.sourceType === 'APPLE_MUSIC' || 
                         existingList.sourceType === 'TOP_SONGS'
    
    const isMetadataOnlyUpdate = isSyncedList && 
                                  validated.sourceType === existingList.sourceType &&
                                  !validated.playlistUrl // No playlist URL means we're not changing the source

    // Helper function to record price change in history
    const recordPriceChange = async () => {
      if (!priceChanged) {
        return
      }

      try {
        await prisma.priceChangeHistory.create({
          data: {
            listId: id,
            oldPriceCents,
            newPriceCents: validated.priceCents,
            changedBy: userId,
          },
        })
      } catch (error) {
        console.error('Error recording price change:', error)
        // Don't fail the request if history recording fails
      }
    }

    // Helper function to create price change notifications for subscribers
    const createPriceChangeNotifications = async (listSlug: string, listName: string) => {
      if (!priceChanged || !existingList.isPublic) {
        return
      }

      try {
        // Get all active subscriptions for this list
        const subscriptions = await prisma.subscription.findMany({
          where: {
            listId: id,
          },
          select: {
            userId: true,
          },
        })

        if (subscriptions.length === 0) {
          return
        }

        // Format prices for display
        const oldPrice = (oldPriceCents / 100).toFixed(2)
        const newPrice = (validated.priceCents / 100).toFixed(2)

        // Create notifications for each subscriber
        const notificationPromises = subscriptions.map((subscription) =>
          prisma.notification.create({
            data: {
              userId: subscription.userId,
              listId: id,
              type: 'PRICE_CHANGE',
              title: `Price Update: ${listName}`,
              message: `The subscription price for "${listName}" has changed from $${oldPrice}/month to $${newPrice}/month. This change will take effect on your next billing cycle.`,
            },
          }).catch((error) => {
            console.error(`Failed to create notification for user ${subscription.userId}:`, error)
            // Don't throw - continue creating notifications for other subscribers
          })
        )

        await Promise.allSettled(notificationPromises)
        console.log(`Created price change notifications for ${subscriptions.length} subscribers`)
      } catch (error) {
        console.error('Error creating price change notifications:', error)
        // Don't fail the request if notification creation fails
      }
    }

    // If it's a metadata-only update for a synced list, just update the list fields without re-syncing
    if (isMetadataOnlyUpdate) {
      const updatedList = await prisma.list.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
        },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
          spotifyConfig: true,
          appleMusicConfig: true,
          topSongsConfig: true,
        },
      })

      // Record price change in history and create notifications if needed (don't await - create in background)
      recordPriceChange().catch(console.error)
      createPriceChangeNotifications(updatedList.slug, updatedList.name).catch(console.error)

      return NextResponse.json({ 
        list: updatedList,
        priceChanged: priceChanged && existingList.isPublic,
        oldPriceCents: oldPriceCents,
      })
    }

    // Handle Spotify list updates (including new sync or changing playlist)
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

      // Create price change notifications if needed (don't await - create in background)
      createPriceChangeNotifications(updatedList.slug, updatedList.name).catch(console.error)

      return NextResponse.json({ 
        list: updatedList,
        priceChanged: priceChanged && updatedList.isPublic,
        oldPriceCents: oldPriceCents,
      })
    }

    // Handle Apple Music list updates
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

      // Delete existing items
      await prisma.listItem.deleteMany({
        where: { listId: id },
      })

      // Update or create Apple Music config
      const existingConfig = await prisma.appleMusicListConfig.findUnique({
        where: { listId: id },
      })

      if (existingConfig) {
        await prisma.appleMusicListConfig.update({
          where: { id: existingConfig.id },
          data: {
            playlistId,
            playlistUrl: validated.playlistUrl,
            lastSyncedAt: new Date(),
          },
        })
      } else {
        await prisma.appleMusicListConfig.create({
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
          appleMusicConfig: true,
        },
      })

      // Create price change notifications if needed (don't await - create in background)
      createPriceChangeNotifications(updatedList.slug, updatedList.name).catch(console.error)

      return NextResponse.json({ 
        list: updatedList,
        priceChanged: priceChanged && updatedList.isPublic,
        oldPriceCents: oldPriceCents,
      })
    }

    // Handle TOP_SONGS list updates (metadata only - don't re-sync)
    if (validated.sourceType === 'TOP_SONGS') {
      // For TOP_SONGS, we only allow metadata updates (name, description, price)
      // The sync happens via cron job, so we don't re-sync here
      const updatedList = await prisma.list.update({
        where: { id },
        data: {
          name: validated.name,
          description: validated.description || '',
          priceCents: validated.priceCents,
          isPublic: validated.isPublic,
        },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
          topSongsConfig: true,
        },
      })

      // Create price change notifications if needed (don't await - create in background)
      createPriceChangeNotifications(updatedList.slug, updatedList.name).catch(console.error)

      return NextResponse.json({ 
        list: updatedList,
        priceChanged: priceChanged && updatedList.isPublic,
        oldPriceCents: oldPriceCents,
      })
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

    // Record price change in history and send price change emails if needed (don't await - send in background)
    recordPriceChange().catch(console.error)
    sendPriceChangeEmails(updatedList.slug, updatedList.name).catch(console.error)

    return NextResponse.json({ 
      list: updatedList,
      priceChanged: priceChanged && updatedList.isPublic,
      oldPriceCents: oldPriceCents,
    })
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

