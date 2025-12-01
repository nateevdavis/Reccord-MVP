import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch all public lists with owner info and subscriber count
    const lists = await prisma.list.findMany({
      where: {
        isPublic: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    })

    // Sort by subscriber count (descending), then by creation date (descending)
    const sortedLists = lists.sort((a, b) => {
      const countDiff = b._count.subscriptions - a._count.subscriptions
      if (countDiff !== 0) return countDiff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    // Transform the data to include subscriber count
    const listsWithSubscriberCount = sortedLists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      slug: list.slug,
      priceCents: list.priceCents,
      owner: list.owner,
      subscriberCount: list._count.subscriptions,
      createdAt: list.createdAt,
    }))

    return NextResponse.json({ lists: listsWithSubscriberCount })
  } catch (error) {
    console.error('Error fetching public lists:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    )
  }
}

