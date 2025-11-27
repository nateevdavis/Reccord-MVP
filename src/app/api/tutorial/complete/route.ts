import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST() {
  try {
    const userId = await requireAuth()

    await prisma.user.update({
      where: { id: userId },
      data: { tutorialCompleted: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error completing tutorial:', error)
    return NextResponse.json(
      { error: 'Failed to complete tutorial' },
      { status: 500 }
    )
  }
}

