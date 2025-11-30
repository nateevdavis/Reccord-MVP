declare module 'spotify-web-api-node' {
  export interface SpotifyWebApiOptions {
    clientId?: string
    clientSecret?: string
    redirectUri?: string
    accessToken?: string
    refreshToken?: string
  }

  export interface PlaylistTrack {
    track: {
      name: string
      artists: Array<{ name: string }>
      external_urls: { spotify?: string }
      is_local?: boolean
    } | null
  }

  export interface PlaylistTracksResponse {
    body: {
      items: PlaylistTrack[]
    }
  }

  export interface TokenResponse {
    body: {
      access_token: string
      expires_in?: number
    }
  }

  export interface TopTrack {
    name: string
    artists: Array<{ name: string }>
    album?: { name: string }
    external_urls: { spotify?: string }
    external_ids?: { isrc?: string }
  }

  export interface TopTracksResponse {
    body: {
      items: TopTrack[]
    }
  }

  export interface RecentlyPlayedItem {
    track: {
      name: string
      artists: Array<{ name: string }>
      album?: { name: string }
      external_urls: { spotify?: string }
      external_ids?: { isrc?: string }
      is_local?: boolean
    }
    played_at: string
  }

  export interface RecentlyPlayedResponse {
    body: {
      items: RecentlyPlayedItem[]
    }
  }

  export default class SpotifyWebApi {
    constructor(options?: SpotifyWebApiOptions)
    setAccessToken(token: string): void
    setRefreshToken(token: string): void
    refreshAccessToken(): Promise<TokenResponse>
    getPlaylistTracks(
      playlistId: string,
      options?: { limit?: number }
    ): Promise<PlaylistTracksResponse>
    getMyTopTracks(options?: {
      time_range?: 'short_term' | 'medium_term' | 'long_term'
      limit?: number
      offset?: number
    }): Promise<TopTracksResponse>
    getMyRecentlyPlayedTracks(options?: {
      limit?: number
      after?: number
      before?: number
    }): Promise<RecentlyPlayedResponse>
  }
}

