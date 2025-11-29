import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(/^[a-z0-9-]+$/, 'Username must be lowercase, alphanumeric, and may contain hyphens'),
  bio: z.string().optional(),
  links: z
    .array(
      z.object({
        label: z.string().min(1, 'Link label is required'),
        url: z.string().url('Link URL must be a valid URL'),
      })
    )
    .nullable()
    .optional(),
})

export async function GET() {
  try {
    const userId = await requireAuth()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        lists: {
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: {
          include: {
            list: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const myLists = user.lists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      slug: list.slug,
    }))

    const subscriptions = user.subscriptions.map((sub) => ({
      id: sub.list.id,
      name: sub.list.name,
      description: sub.list.description,
      slug: sub.list.slug,
    }))

    // Check if user has Spotify connection
    const spotifyConnection = await prisma.spotifyConnection.findUnique({
      where: { userId },
    })

    // Check if user has Apple Music connection
    const appleMusicConnection = await prisma.appleMusicConnection.findUnique({
      where: { userId },
    })

    // Check if user has any lists with paying subscribers
    const listsWithSubscribers = await prisma.list.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        subscriptions: {
          include: {
            payments: {
              where: {
                status: 'COMPLETED',
              },
            },
          },
        },
      },
    })

    const hasSubscribers = listsWithSubscribers.some(
      (list) => list.subscriptions.some((sub) => sub.payments.length > 0)
    )

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        bio: user.bio,
        links: user.links,
        tutorialCompleted: user.tutorialCompleted,
      },
      myLists,
      subscriptions,
      spotifyConnected: !!spotifyConnection,
      onboarding: {
        hasLists: myLists.length > 0,
        hasMusicConnection: !!spotifyConnection || !!appleMusicConnection,
        hasSubscribers,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's a database connection error
    if (errorMessage.includes("Can't reach database server") || 
        errorMessage.includes('P1001') ||
        errorMessage.includes('connection')) {
      return NextResponse.json(
        { error: 'Database connection error. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Check if it's an auth error
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await request.json()
    console.log('Updating profile with payload:', JSON.stringify(body, null, 2))
    const validated = updateProfileSchema.parse(body)

    // Check if username is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { username: validated.username },
    })

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: validated.displayName,
        username: validated.username,
        bio: validated.bio || null,
        links: validated.links === null ? Prisma.JsonNull : validated.links || undefined,
      },
    })

    return NextResponse.json({ user })
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
    console.error('Error updating user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's a database connection error
    if (errorMessage.includes("Can't reach database server") || 
        errorMessage.includes('P1001') ||
        errorMessage.includes('connection')) {
      return NextResponse.json(
        { error: 'Database connection error. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: `Failed to update user: ${errorMessage}` },
      { status: 500 }
    )
  }
}

