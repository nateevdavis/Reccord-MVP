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

  export default class SpotifyWebApi {
    constructor(options?: SpotifyWebApiOptions)
    setAccessToken(token: string): void
    setRefreshToken(token: string): void
    refreshAccessToken(): Promise<TokenResponse>
    getPlaylistTracks(
      playlistId: string,
      options?: { limit?: number }
    ): Promise<PlaylistTracksResponse>
  }
}

