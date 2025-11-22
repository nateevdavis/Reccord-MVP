import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

function getSpotifyClientId(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID is not set')
  }
  return clientId
}

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
  
  if (!host) {
    throw new Error('Unable to determine host from request. Please set SPOTIFY_REDIRECT_URI environment variable.')
  }
  
  // Determine protocol - prioritize forwarded-proto header, default to https for production
  let protocol = 'https:'
  if (forwardedProto) {
    protocol = forwardedProto === 'https' ? 'https:' : 'http:'
  } else if (request.nextUrl.protocol) {
    protocol = request.nextUrl.protocol
  }
  
  // For production domains (not localhost), always use HTTPS
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    protocol = 'https:'
  }
  
  // Replace localhost with 127.0.0.1 for Spotify compatibility (local dev only)
  let finalHost = host
  if (host.includes('localhost')) {
    finalHost = host.replace('localhost', '127.0.0.1')
    protocol = 'https:' // Spotify requires HTTPS even for localhost
  }
  
  const baseUrl = `${protocol}//${finalHost}`
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`
  
  console.log('Constructed redirect URI:', redirectUri)
  console.log('Request details:', {
    host,
    finalHost,
    protocol,
    forwardedProto,
    url: request.nextUrl.toString(),
  })
  
  return redirectUri
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const returnUrl = searchParams.get('returnUrl') || '/create'
    
    let redirectUri: string
    try {
      redirectUri = getRedirectUri(request)
    } catch (error) {
      console.error('Error constructing redirect URI:', error)
      throw new Error(`Failed to construct redirect URI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Spotify OAuth scopes
    const scopes = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-read-email',
    ]

    let clientId: string
    try {
      clientId = getSpotifyClientId()
    } catch (error) {
      console.error('Error getting Spotify client ID:', error)
      throw new Error(`Spotify client ID not configured: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.set('client_id', clientId)
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Full error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: 'Failed to authorize with Spotify',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

