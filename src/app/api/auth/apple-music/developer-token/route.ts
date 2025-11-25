import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDeveloperToken } from '@/lib/apple-music'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const developerToken = await getDeveloperToken()

    return NextResponse.json({ developerToken })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error getting Apple Music developer token:', error)
    return NextResponse.json(
      { error: 'Failed to get developer token' },
      { status: 500 }
    )
  }
}

