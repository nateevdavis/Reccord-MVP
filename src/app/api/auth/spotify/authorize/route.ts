import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID

if (!SPOTIFY_CLIENT_ID) {
  throw new Error('SPOTIFY_CLIENT_ID is not set')
}

// TypeScript assertion: we've checked above that it exists
const SPOTIFY_CLIENT_ID_SAFE: string = SPOTIFY_CLIENT_ID

function getRedirectUri(request: NextRequest): string {
  // Use environment variable if set, otherwise construct from request
  if (process.env.SPOTIFY_REDIRECT_URI) {
    console.log('Using SPOTIFY_REDIRECT_URI from env:', process.env.SPOTIFY_REDIRECT_URI)
    return process.env.SPOTIFY_REDIRECT_URI
  }
  
  // Construct redirect URI from request origin
  // Check for forwarded protocol headers (for proxies/tunnels)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host') || request.nextUrl.host
  const url = request.nextUrl
  
  // Debug logging
  console.log('Request details:', {
    url: url.toString(),
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
    hostHeader: request.headers.get('host'),
    forwardedProto,
  })
  
  // Spotify doesn't allow 'localhost' - must use 127.0.0.1 for local development
  // Spotify requires HTTPS for all redirect URIs
  let protocol = 'https:'
  let finalHost = host
  
  // Replace localhost with 127.0.0.1 for Spotify compatibility
  if (host?.includes('localhost')) {
    finalHost = host.replace('localhost', '127.0.0.1')
    protocol = 'https:' // Spotify requires HTTPS
  } else if (forwardedProto) {
    protocol = forwardedProto === 'https' ? 'https:' : 'http:'
  } else if (url.protocol) {
    protocol = url.protocol
  }
  
  // Ensure HTTPS for 127.0.0.1 (Spotify requirement)
  if (finalHost?.includes('127.0.0.1')) {
    protocol = 'https:'
  }
  
  const origin = `${protocol}//${finalHost}`
  const redirectUri = `${origin}/api/auth/spotify/callback`
  
  console.log('Constructed redirect URI:', redirectUri)
  return redirectUri
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const returnUrl = searchParams.get('returnUrl') || '/create'
    const redirectUri = getRedirectUri(request)

    // Spotify OAuth scopes
    const scopes = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-read-email',
    ]

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.set('client_id', SPOTIFY_CLIENT_ID_SAFE)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('state', Buffer.from(returnUrl).toString('base64'))

    console.log('Spotify authorization URL:', authUrl.toString())
    console.log('Redirect URI being sent:', redirectUri)

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.redirect('/login')
    }
    console.error('Error in Spotify authorize:', error)
    return NextResponse.json(
      { error: 'Failed to authorize with Spotify' },
      { status: 500 }
    )
  }
}

