import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host') || request.nextUrl.host
  
  let protocol = 'https:'
  if (forwardedProto) {
    protocol = forwardedProto === 'https' ? 'https:' : 'http:'
  } else if (request.nextUrl.protocol) {
    protocol = request.nextUrl.protocol
  }
  
  return `${protocol}//${host}`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const body = await request.json()
    const { userToken, expiresIn } = body

    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      )
    }

    // Calculate expiration time (default to 6 months if not provided)
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months default

    // Get developer token to fetch user info
    const { getDeveloperToken } = await import('@/lib/apple-music')
    const developerToken = await getDeveloperToken()

    // Try to get user info from Apple Music API
    let appleMusicUserId: string | null = null
    try {
      const userResponse = await fetch('https://api.music.apple.com/v1/me', {
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Music-User-Token': userToken,
        },
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        appleMusicUserId = userData.data?.[0]?.id || null
      }
    } catch (error) {
      console.error('Error fetching Apple Music user info:', error)
      // Continue anyway - user token is still valid
    }

    // Store or update Apple Music connection
    await prisma.appleMusicConnection.upsert({
      where: { userId },
      create: {
        userId,
        developerToken: developerToken, // Store developer token for server-side use
        musicUserToken: userToken,
        expiresAt,
        appleMusicUserId,
      },
      update: {
        developerToken: developerToken,
        musicUserToken: userToken,
        expiresAt,
        appleMusicUserId,
      },
    })

    const baseUrl = getBaseUrl(request)
    return NextResponse.json({ 
      success: true,
      message: 'Apple Music connected successfully' 
    })
  } catch (error) {
    const baseUrl = getBaseUrl(request)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.redirect(`${baseUrl}/login`)
    }
    console.error('Error connecting Apple Music:', error)
    return NextResponse.json(
      { error: 'Failed to connect Apple Music' },
      { status: 500 }
    )
  }
}

