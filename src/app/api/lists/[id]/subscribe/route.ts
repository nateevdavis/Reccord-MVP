import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST(
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

    // Check if subscription already exists
    const existing = await prisma.subscription.findUnique({
      where: {
        userId_listId: {
          userId: userId,
          listId: id,
        },
      },
      include: {
        payments: {
          where: { status: 'COMPLETED' },
        },
      },
    })

    if (existing) {
      // If list is paid and subscription exists but has no completed payment, require payment
      if (list.priceCents > 0 && (!existing.payments || existing.payments.length === 0)) {
        return NextResponse.json(
          { error: 'Payment required', requiresPayment: true },
          { status: 402 }
        )
      }
      return NextResponse.json({ message: 'Already subscribed' })
    }

    // If list has a price, require payment
    if (list.priceCents > 0) {
      return NextResponse.json(
        { error: 'Payment required', requiresPayment: true },
        { status: 402 }
      )
    }

    // Create free subscription
    await prisma.subscription.create({
      data: {
        userId: userId,
        listId: id,
      },
    })

    return NextResponse.json({ message: 'Subscribed successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error subscribing to list:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    )
  }
}

