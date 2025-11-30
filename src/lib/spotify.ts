import SpotifyWebApi from 'spotify-web-api-node'
import { prisma } from './prisma'

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are not set')
  }
  
  return { clientId, clientSecret }
}

export function getSpotifyApi(accessToken: string): SpotifyWebApi {
  const { clientId, clientSecret } = getSpotifyCredentials()
  const spotifyApi = new SpotifyWebApi({
    clientId,
    clientSecret,
  })
  spotifyApi.setAccessToken(accessToken)
  return spotifyApi
}

export async function refreshSpotifyToken(userId: string): Promise<string> {
  const connection = await prisma.spotifyConnection.findUnique({
    where: { userId },
  })

  if (!connection) {
    throw new Error('Spotify connection not found')
  }

  const { clientId, clientSecret } = getSpotifyCredentials()
  const spotifyApi = new SpotifyWebApi({
    clientId,
    clientSecret,
    refreshToken: connection.refreshToken,
  })

  const data = await spotifyApi.refreshAccessToken()
  const newAccessToken = data.body.access_token
  const expiresIn = data.body.expires_in || 3600

  // Update token in database
  await prisma.spotifyConnection.update({
    where: { userId },
    data: {
      accessToken: newAccessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  })

  return newAccessToken
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await prisma.spotifyConnection.findUnique({
    where: { userId },
  })

  if (!connection) {
    throw new Error('Spotify connection not found')
  }

  // Check if token is expired (with 5 minute buffer)
  const bufferTime = 5 * 60 * 1000 // 5 minutes
  if (connection.expiresAt.getTime() - Date.now() < bufferTime) {
    return await refreshSpotifyToken(userId)
  }

  return connection.accessToken
}

export function extractPlaylistId(playlistUrl: string): string | null {
  // Handle various Spotify URL formats:
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const urlPattern = /playlist\/([a-zA-Z0-9]+)/
  const uriPattern = /spotify:playlist:([a-zA-Z0-9]+)/

  const urlMatch = playlistUrl.match(urlPattern)
  if (urlMatch) {
    return urlMatch[1]
  }

  const uriMatch = playlistUrl.match(uriPattern)
  if (uriMatch) {
    return uriMatch[1]
  }

  return null
}

export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<Array<{ name: string; description: string | null; url: string | null }>> {
  const spotifyApi = getSpotifyApi(accessToken)

  try {
    const data = await spotifyApi.getPlaylistTracks(playlistId, {
      limit: 100, // Get up to 100 tracks
    })

    const tracks = data.body.items
      .filter((item) => item.track && !item.track.is_local)
      .slice(0, 10) // Take top 10
      .map((item, index) => {
        const track = item.track!
        return {
          name: track.name,
          description: track.artists.map((a) => a.name).join(', '),
          url: track.external_urls.spotify || null,
          sortOrder: index,
        }
      })

    return tracks
  } catch (error) {
    console.error('Error fetching playlist tracks:', error)
    throw new Error('Failed to fetch playlist tracks')
  }
}

export type SpotifyTrack = {
  name: string
  artist: string
  album: string | null
  url: string | null
  isrc: string | null
  playCount: number
  lastPlayedAt: Date | null
}

/**
 * Map Spotify time window to API time_range parameter
 */
function mapTimeWindowToSpotifyRange(timeWindow: string): 'short_term' | 'medium_term' | 'long_term' {
  switch (timeWindow) {
    case 'THIS_WEEK':
    case 'THIS_MONTH':
      return 'short_term' // Last 4 weeks
    case 'PAST_6_MONTHS':
      return 'medium_term' // Last 6 months
    case 'PAST_YEAR':
    case 'ALL_TIME':
      return 'long_term' // Several years
    default:
      return 'medium_term'
  }
}

/**
 * Fetch user's top tracks from Spotify
 * Uses /v1/me/top/tracks endpoint
 */
export async function fetchTopTracks(
  accessToken: string,
  timeWindow: string,
  limit: number = 50
): Promise<SpotifyTrack[]> {
  const spotifyApi = getSpotifyApi(accessToken)

  try {
    const timeRange = mapTimeWindowToSpotifyRange(timeWindow)
    const data = await spotifyApi.getMyTopTracks({
      time_range: timeRange,
      limit: Math.min(limit, 50), // Spotify API max is 50
    })

    return data.body.items.map((track) => ({
      name: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album?.name || null,
      url: track.external_urls.spotify || null,
      isrc: track.external_ids?.isrc || null,
      playCount: 1, // Top tracks API doesn't provide play count, use ranking as proxy
      lastPlayedAt: null, // Top tracks API doesn't provide last played date
    }))
  } catch (error) {
    console.error('Error fetching top tracks:', error)
    throw new Error('Failed to fetch top tracks')
  }
}

/**
 * Fetch user's recently played tracks from Spotify
 * Uses /v1/me/player/recently-played endpoint
 */
export async function fetchRecentlyPlayed(
  accessToken: string,
  limit: number = 50
): Promise<SpotifyTrack[]> {
  const spotifyApi = getSpotifyApi(accessToken)

  try {
    const data = await spotifyApi.getMyRecentlyPlayedTracks({
      limit: Math.min(limit, 50), // Spotify API max is 50
    })

    // Count plays per track
    const trackMap = new Map<string, SpotifyTrack & { playCount: number; lastPlayedAt: Date }>()

    data.body.items.forEach((item) => {
      const track = item.track
      if (!track || track.is_local) return

      const isrc = track.external_ids?.isrc || null
      const key = isrc || `${track.name}|${track.artists.map((a) => a.name).join(',')}`

      if (trackMap.has(key)) {
        const existing = trackMap.get(key)!
        existing.playCount++
        // Update last played if this is more recent
        const playedAt = new Date(item.played_at)
        if (!existing.lastPlayedAt || playedAt > existing.lastPlayedAt) {
          existing.lastPlayedAt = playedAt
        }
      } else {
        trackMap.set(key, {
          name: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          album: track.album?.name || null,
          url: track.external_urls.spotify || null,
          isrc,
          playCount: 1,
          lastPlayedAt: new Date(item.played_at),
        })
      }
    })

    return Array.from(trackMap.values())
  } catch (error) {
    console.error('Error fetching recently played tracks:', error)
    throw new Error('Failed to fetch recently played tracks')
  }
}

/**
 * Fetch listening history based on time window
 * Combines top tracks API with recently played for better accuracy
 */
export async function fetchListeningHistory(
  accessToken: string,
  timeWindow: string
): Promise<SpotifyTrack[]> {
  try {
    // For short time windows, use recently played tracks
    if (timeWindow === 'THIS_WEEK' || timeWindow === 'THIS_MONTH') {
      // Fetch more recently played tracks to get better coverage
      const recentlyPlayed = await fetchRecentlyPlayed(accessToken, 50)
      
      // Filter by time window
      const now = Date.now()
      const windowMs = timeWindow === 'THIS_WEEK' 
        ? 7 * 24 * 60 * 60 * 1000  // 7 days
        : 30 * 24 * 60 * 60 * 1000 // 30 days

      return recentlyPlayed.filter((track) => {
        if (!track.lastPlayedAt) return false
        return (now - track.lastPlayedAt.getTime()) <= windowMs
      })
    }

    // For longer time windows, use top tracks API
    // This is more accurate for medium/long term trends
    return await fetchTopTracks(accessToken, timeWindow, 50)
  } catch (error) {
    console.error('Error fetching listening history:', error)
    throw new Error('Failed to fetch listening history')
  }
}

