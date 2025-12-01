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

export type AppleMusicTrack = {
  name: string
  artist: string
  album: string | null
  url: string | null
  isrc: string | null
  playCount: number
  lastPlayedAt: Date | null
}

/**
 * Fetch user's heavy rotation tracks from Apple Music
 * Uses /v1/me/history/heavy-rotation endpoint
 * This is Apple Music's approximation of top tracks
 */
export async function fetchHeavyRotation(
  developerToken: string,
  userToken: string
): Promise<AppleMusicTrack[]> {
  try {
    console.log('Calling Apple Music API /v1/me/history/heavy-rotation')
    const response = await fetch(
      'https://api.music.apple.com/v1/me/history/heavy-rotation',
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
      
      // Check for specific error types
      if (response.status === 401 || response.status === 403) {
        throw new Error('Apple Music authentication failed. Please reconnect Apple Music.')
      }
      if (response.status === 404) {
        throw new Error('Heavy rotation endpoint not available. This may require an Apple Music subscription.')
      }
      
      throw new Error(`Apple Music API error: ${response.status} - ${errorData.errors?.[0]?.detail || response.statusText}`)
    }

    const data = await response.json()
    const tracks = data.data || []
    
    console.log(`Apple Music API returned ${tracks.length} heavy rotation tracks`)

    if (tracks.length === 0) {
      console.warn('Apple Music API returned empty tracks array')
      return []
    }

    return tracks.map((track: any) => {
      const attributes = track.attributes || {}
      return {
        name: attributes.name || 'Unknown Track',
        artist: attributes.artistName || 'Unknown Artist',
        album: attributes.albumName || null,
        url: attributes.url || null,
        isrc: attributes.isrc || null,
        playCount: 1, // Heavy rotation doesn't provide play count
        lastPlayedAt: null, // Heavy rotation doesn't provide last played date
      }
    })
  } catch (error) {
    console.error('Error fetching heavy rotation:', error)
    if (error instanceof Error) {
      throw error // Re-throw if it's already a proper Error with message
    }
    throw new Error(`Failed to fetch heavy rotation tracks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Fetch user's recently played tracks from Apple Music
 * Uses /v1/me/recent/played/tracks endpoint
 * Limited history available (typically last 25 tracks)
 */
export async function fetchRecentlyPlayed(
  developerToken: string,
  userToken: string,
  limit: number = 25
): Promise<AppleMusicTrack[]> {
  try {
    console.log(`Calling Apple Music API /v1/me/recent/played/tracks with limit: ${limit}`)
    const response = await fetch(
      `https://api.music.apple.com/v1/me/recent/played/tracks?limit=${Math.min(limit, 25)}`,
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
      
      // Check for specific error types
      if (response.status === 401 || response.status === 403) {
        throw new Error('Apple Music authentication failed. Please reconnect Apple Music.')
      }
      if (response.status === 404) {
        throw new Error('Recently played endpoint not available. This may require an Apple Music subscription.')
      }
      
      throw new Error(`Apple Music API error: ${response.status} - ${errorData.errors?.[0]?.detail || response.statusText}`)
    }

    const data = await response.json()
    const tracks = data.data || []
    
    console.log(`Apple Music API returned ${tracks.length} recently played items`)

    if (tracks.length === 0) {
      console.warn('Apple Music API returned empty items array for recently played')
      return []
    }

    // Count plays per track
    const trackMap = new Map<string, AppleMusicTrack & { playCount: number; lastPlayedAt: Date }>()

    tracks.forEach((track: any) => {
      const attributes = track.attributes || {}
      const isrc = attributes.isrc || null
      const key = isrc || `${attributes.name}|${attributes.artistName}`

      if (trackMap.has(key)) {
        const existing = trackMap.get(key)!
        existing.playCount++
        // Update last played if this is more recent
        const playedAt = track.attributes?.playDate 
          ? new Date(track.attributes.playDate)
          : new Date()
        if (!existing.lastPlayedAt || playedAt > existing.lastPlayedAt) {
          existing.lastPlayedAt = playedAt
        }
      } else {
        trackMap.set(key, {
          name: attributes.name || 'Unknown Track',
          artist: attributes.artistName || 'Unknown Artist',
          album: attributes.albumName || null,
          url: attributes.url || null,
          isrc,
          playCount: 1,
          lastPlayedAt: track.attributes?.playDate 
            ? new Date(track.attributes.playDate)
            : new Date(),
        })
      }
    })

    const uniqueTracks = Array.from(trackMap.values())
    console.log(`Processed ${uniqueTracks.length} unique tracks from recently played`)
    return uniqueTracks
  } catch (error) {
    console.error('Error fetching recently played tracks:', error)
    if (error instanceof Error) {
      throw error // Re-throw if it's already a proper Error with message
    }
    throw new Error(`Failed to fetch recently played tracks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Fetch top tracks based on time window
 * Apple Music has limited history APIs, so we use approximations:
 * - Short term: Recently played tracks
 * - Medium/Long term: Heavy rotation (Apple Music's approximation of top tracks)
 */
export async function fetchTopTracks(
  developerToken: string,
  userToken: string,
  timeWindow: string
): Promise<AppleMusicTrack[]> {
  try {
    // For short time windows, try recently played first
    if (timeWindow === 'THIS_WEEK' || timeWindow === 'THIS_MONTH') {
      try {
        const recentlyPlayed = await fetchRecentlyPlayed(developerToken, userToken, 25)
        console.log(`Fetched ${recentlyPlayed.length} recently played Apple Music tracks`)
        
        // Filter by time window
        const now = Date.now()
        const windowMs = timeWindow === 'THIS_WEEK' 
          ? 7 * 24 * 60 * 60 * 1000  // 7 days
          : 30 * 24 * 60 * 60 * 1000 // 30 days

        const filtered = recentlyPlayed.filter((track) => {
          if (!track.lastPlayedAt) return false
          return (now - track.lastPlayedAt.getTime()) <= windowMs
        })
        
        console.log(`Filtered to ${filtered.length} Apple Music tracks within time window`)
        
        // If we have tracks, return them
        if (filtered.length > 0) {
          return filtered
        }
        
        // If no tracks in the window, fall back to heavy rotation
        console.log('No Apple Music tracks in time window, falling back to heavy rotation')
      } catch (error) {
        console.error('Error fetching recently played, falling back to heavy rotation:', error)
        // Fall through to heavy rotation
      }
    }

    // For longer time windows, or as fallback for short windows, use heavy rotation
    // This is Apple Music's best approximation of top tracks
    console.log(`Fetching heavy rotation for time window: ${timeWindow}`)
    const heavyRotation = await fetchHeavyRotation(developerToken, userToken)
    console.log(`Fetched ${heavyRotation.length} heavy rotation tracks`)
    return heavyRotation
  } catch (error) {
    console.error('Error fetching top tracks:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw new Error(`Failed to fetch top tracks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Fetch listening history based on time window
 * Alias for fetchTopTracks for consistency with Spotify API
 */
export async function fetchListeningHistory(
  developerToken: string,
  userToken: string,
  timeWindow: string
): Promise<AppleMusicTrack[]> {
  return await fetchTopTracks(developerToken, userToken, timeWindow)
}

