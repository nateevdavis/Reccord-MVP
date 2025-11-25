import { prisma } from './prisma'

function getAppleMusicCredentials() {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID
  const keyId = process.env.APPLE_MUSIC_KEY_ID
  let privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY
  
  if (!teamId || !keyId || !privateKey) {
    throw new Error('Apple Music credentials are not set. Required: APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY')
  }
  
  // Handle private key with escaped newlines (common in .env files)
  // Replace literal \n with actual newlines if needed
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }
  
  return { teamId, keyId, privateKey }
}

/**
 * Generate Apple Music developer token (JWT)
 * This token is used to authenticate server-side API requests
 * 
 * Note: Requires jsonwebtoken package: npm install jsonwebtoken @types/jsonwebtoken
 * Also requires Apple Music API credentials in environment variables:
 * - APPLE_MUSIC_TEAM_ID
 * - APPLE_MUSIC_KEY_ID
 * - APPLE_MUSIC_PRIVATE_KEY (ES256 private key)
 */
export async function generateDeveloperToken(): Promise<string> {
  const { teamId, keyId, privateKey } = getAppleMusicCredentials()
  
  try {
    // Try to use jsonwebtoken if available
    const jwt = await import('jsonwebtoken')
    
    const token = jwt.default.sign(
      {
        iss: teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months
      },
      privateKey,
      {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: keyId,
        },
      }
    )
    
    return token
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      throw new Error(
        'jsonwebtoken package is required for Apple Music integration. ' +
        'Please install it: npm install jsonwebtoken @types/jsonwebtoken'
      )
    }
    throw error
  }
}

/**
 * Get or refresh Apple Music developer token
 */
export async function getDeveloperToken(): Promise<string> {
  // In a real implementation, you'd cache this token since it's valid for 6 months
  // For now, generate a new one each time (not recommended for production)
  return await generateDeveloperToken()
}

/**
 * Extract playlist ID from Apple Music URL
 * Supports formats like:
 * - https://music.apple.com/us/playlist/pl.u-xxx
 * - https://music.apple.com/us/playlist/playlist-name/pl.xxx
 * - https://music.apple.com/playlist/pl.u-xxx
 * - music://playlist/pl.u-xxx
 */
export function extractPlaylistId(playlistUrl: string): string | null {
  // Apple Music playlist URLs can be:
  // https://music.apple.com/us/playlist/pl.u-xxx (direct)
  // https://music.apple.com/us/playlist/playlist-name/pl.84f88d0ece474117b4e6e5484f84c4f2 (with name)
  // https://music.apple.com/playlist/pl.u-xxx
  // music://playlist/pl.u-xxx
  
  // Match pl. followed by alphanumeric, dots, and hyphens
  // This handles both direct (playlist/pl.xxx) and with name (playlist/name/pl.xxx) formats
  const urlPattern = /playlist\/[^\/]*\/(pl\.[a-zA-Z0-9.-]+)/
  // Also try direct format (playlist/pl.xxx)
  const urlPatternDirect = /playlist\/(pl\.[a-zA-Z0-9.-]+)/
  const uriPattern = /music:\/\/playlist\/(pl\.[a-zA-Z0-9.-]+)/
  
  // Try with name first (most common format)
  let urlMatch = playlistUrl.match(urlPattern)
  if (urlMatch) {
    return urlMatch[1]
  }
  
  // Try direct format
  urlMatch = playlistUrl.match(urlPatternDirect)
  if (urlMatch) {
    return urlMatch[1]
  }
  
  // Try URI format
  const uriMatch = playlistUrl.match(uriPattern)
  if (uriMatch) {
    return uriMatch[1]
  }
  
  return null
}

/**
 * Fetch playlist tracks from Apple Music API
 * Requires both developer token and user token
 */
export async function fetchPlaylistTracks(
  developerToken: string,
  userToken: string,
  playlistId: string
): Promise<Array<{ name: string; description: string | null; url: string | null }>> {
  try {
    // Apple Music API endpoint
    // Note: playlistId needs to be converted to the proper format
    // Apple Music uses catalog IDs, not playlist IDs directly
    
    // First, we need to get the catalog playlist ID from the playlist ID
    // This is a simplified version - you may need to adjust based on actual API response
    
    const response = await fetch(
      `https://api.music.apple.com/v1/catalog/us/playlists/${playlistId}`,
      {
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Music-User-Token': userToken,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Apple Music API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })
      throw new Error(`Apple Music API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract tracks from the playlist data
    // Apple Music API structure may vary - adjust based on actual response
    const tracks = data.data?.[0]?.relationships?.tracks?.data || []
    
    return tracks
      .slice(0, 10) // Take top 10
      .map((track: any, index: number) => {
        const attributes = track.attributes || {}
        return {
          name: attributes.name || 'Unknown Track',
          description: attributes.artistName || null,
          url: attributes.url || null,
          sortOrder: index,
        }
      })
  } catch (error) {
    console.error('Error fetching Apple Music playlist tracks:', error)
    throw new Error('Failed to fetch playlist tracks')
  }
}

/**
 * Get valid user token from database
 */
export async function getUserToken(userId: string): Promise<string> {
  const connection = await prisma.appleMusicConnection.findUnique({
    where: { userId },
  })

  if (!connection) {
    throw new Error('Apple Music connection not found')
  }

  if (!connection.musicUserToken) {
    throw new Error('User token not available')
  }

  // Check if token is expired (with 5 minute buffer)
  const bufferTime = 5 * 60 * 1000 // 5 minutes
  if (connection.expiresAt.getTime() - Date.now() < bufferTime) {
    throw new Error('Apple Music user token expired. Please reconnect.')
  }

  return connection.musicUserToken
}

