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

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        bio: user.bio,
        links: user.links,
      },
      myLists,
      subscriptions,
      spotifyConnected: !!spotifyConnection,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
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
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: `Failed to update user: ${errorMessage}` },
      { status: 500 }
    )
  }
}

