import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error('Spotify credentials are not set')
}

// TypeScript assertion: we've checked above that they exist
const SPOTIFY_CLIENT_ID_SAFE: string = SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET_SAFE: string = SPOTIFY_CLIENT_SECRET

function getBaseUrl(request: NextRequest): string {
  // Check for forwarded protocol headers (for proxies/tunnels like ngrok)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host') || request.nextUrl.host
  
  // Determine protocol - prioritize forwarded-proto header
  let protocol = 'https:'
  if (forwardedProto) {
    protocol = forwardedProto === 'https' ? 'https:' : 'http:'
  } else if (request.nextUrl.protocol) {
    protocol = request.nextUrl.protocol
  }
  
  return `${protocol}//${host}`
}

function getRedirectUri(request: NextRequest): string {
  // Use environment variable if set, otherwise construct from request
  if (process.env.SPOTIFY_REDIRECT_URI) {
    console.log('Using SPOTIFY_REDIRECT_URI from env:', process.env.SPOTIFY_REDIRECT_URI)
    return process.env.SPOTIFY_REDIRECT_URI
  }
  
  // Construct redirect URI from request origin
  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`
  
  console.log('Callback constructed redirect URI:', redirectUri)
  return redirectUri
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    const baseUrl = getBaseUrl(request)

    if (error) {
      console.error('Spotify OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/create?spotify_error=1`)
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/create?spotify_error=2`)
    }

    const redirectUri = getRedirectUri(request)

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID_SAFE}:${SPOTIFY_CLIENT_SECRET_SAFE}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Failed to exchange code for tokens:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
        redirectUri,
      })
      return NextResponse.redirect(`${baseUrl}/create?spotify_error=3`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Get user info from Spotify
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    let spotifyUserId: string | null = null
    if (userResponse.ok) {
      const userData = await userResponse.json()
      spotifyUserId = userData.id
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Store or update Spotify connection
    await prisma.spotifyConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        spotifyUserId,
      },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        spotifyUserId,
      },
    })

    // Decode return URL from state
    let returnUrl = '/create'
    if (state) {
      try {
        returnUrl = Buffer.from(state, 'base64').toString('utf-8')
      } catch {
        // If state is invalid, use default
      }
    }

    // Ensure returnUrl is absolute
    const absoluteReturnUrl = returnUrl.startsWith('http') 
      ? returnUrl 
      : `${baseUrl}${returnUrl.startsWith('/') ? returnUrl : '/' + returnUrl}`

    return NextResponse.redirect(`${absoluteReturnUrl}?spotify_connected=1`)
  } catch (error) {
    const baseUrl = getBaseUrl(request)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.redirect(`${baseUrl}/login`)
    }
    console.error('Error in Spotify callback:', error)
    return NextResponse.redirect(`${baseUrl}/create?spotify_error=4`)
  }
}

