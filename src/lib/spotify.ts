import SpotifyWebApi from 'spotify-web-api-node'
import { prisma } from './prisma'

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  throw new Error('Spotify credentials are not set')
}

export function getSpotifyApi(accessToken: string): SpotifyWebApi {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
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

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
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

