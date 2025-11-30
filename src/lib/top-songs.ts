import { SpotifyTrack } from './spotify'
import { AppleMusicTrack } from './apple-music'

export type UnifiedTrack = {
  name: string
  artist: string
  album: string | null
  url: string | null
  isrc: string | null
  playCount: number
  lastPlayedAt: Date | null
  sourceServices: string[] // Array of "SPOTIFY" and/or "APPLE_MUSIC"
}

/**
 * Normalize track data from Spotify to unified format
 */
export function normalizeSpotifyTrack(track: SpotifyTrack): UnifiedTrack {
  return {
    name: track.name,
    artist: track.artist,
    album: track.album,
    url: track.url,
    isrc: track.isrc,
    playCount: track.playCount,
    lastPlayedAt: track.lastPlayedAt,
    sourceServices: ['SPOTIFY'],
  }
}

/**
 * Normalize track data from Apple Music to unified format
 */
export function normalizeAppleMusicTrack(track: AppleMusicTrack): UnifiedTrack {
  return {
    name: track.name,
    artist: track.artist,
    album: track.album,
    url: track.url,
    isrc: track.isrc,
    playCount: track.playCount,
    lastPlayedAt: track.lastPlayedAt,
    sourceServices: ['APPLE_MUSIC'],
  }
}

/**
 * Create a key for deduplication
 * Uses ISRC if available, otherwise falls back to name + artist
 */
function createDedupKey(track: UnifiedTrack): string {
  if (track.isrc) {
    return `isrc:${track.isrc}`
  }
  // Normalize name and artist for comparison
  const normalizedName = track.name.toLowerCase().trim()
  const normalizedArtist = track.artist.toLowerCase().trim()
  return `name:${normalizedName}|artist:${normalizedArtist}`
}

/**
 * Deduplicate tracks across services
 * Merges tracks using ISRC first, then falls back to name+artist matching
 */
export function deduplicateTracks(
  spotifyTracks: SpotifyTrack[],
  appleMusicTracks: AppleMusicTrack[]
): UnifiedTrack[] {
  const trackMap = new Map<string, UnifiedTrack>()

  // Process Spotify tracks
  spotifyTracks.forEach((track) => {
    const unified = normalizeSpotifyTrack(track)
    const key = createDedupKey(unified)

    if (trackMap.has(key)) {
      const existing = trackMap.get(key)!
      // Merge: combine play counts and source services
      existing.playCount += unified.playCount
      if (!existing.sourceServices.includes('SPOTIFY')) {
        existing.sourceServices.push('SPOTIFY')
      }
      // Prefer Spotify URL if available (more common)
      if (unified.url && !existing.url) {
        existing.url = unified.url
      }
      // Use most recent last played date
      if (unified.lastPlayedAt && (!existing.lastPlayedAt || unified.lastPlayedAt > existing.lastPlayedAt)) {
        existing.lastPlayedAt = unified.lastPlayedAt
      }
      // Prefer ISRC from Spotify if available
      if (unified.isrc && !existing.isrc) {
        existing.isrc = unified.isrc
      }
    } else {
      trackMap.set(key, unified)
    }
  })

  // Process Apple Music tracks
  appleMusicTracks.forEach((track) => {
    const unified = normalizeAppleMusicTrack(track)
    const key = createDedupKey(unified)

    if (trackMap.has(key)) {
      const existing = trackMap.get(key)!
      // Merge: combine play counts and source services
      existing.playCount += unified.playCount
      if (!existing.sourceServices.includes('APPLE_MUSIC')) {
        existing.sourceServices.push('APPLE_MUSIC')
      }
      // Use Apple Music URL if Spotify URL not available
      if (unified.url && !existing.url) {
        existing.url = unified.url
      }
      // Use most recent last played date
      if (unified.lastPlayedAt && (!existing.lastPlayedAt || unified.lastPlayedAt > existing.lastPlayedAt)) {
        existing.lastPlayedAt = unified.lastPlayedAt
      }
      // Prefer ISRC from Apple Music if not already set
      if (unified.isrc && !existing.isrc) {
        existing.isrc = unified.isrc
      }
    } else {
      trackMap.set(key, unified)
    }
  })

  return Array.from(trackMap.values())
}

/**
 * Sort tracks by play count (descending), then by most recent play
 */
export function sortTracksByPlayCount(tracks: UnifiedTrack[]): UnifiedTrack[] {
  return [...tracks].sort((a, b) => {
    // First sort by play count (descending)
    if (b.playCount !== a.playCount) {
      return b.playCount - a.playCount
    }
    // If play counts are equal, sort by most recent play (descending)
    if (a.lastPlayedAt && b.lastPlayedAt) {
      return b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime()
    }
    // If one has lastPlayedAt and the other doesn't, prefer the one with date
    if (a.lastPlayedAt && !b.lastPlayedAt) {
      return -1
    }
    if (b.lastPlayedAt && !a.lastPlayedAt) {
      return 1
    }
    return 0
  })
}

/**
 * Select top 10 tracks after sorting
 */
export function selectTop10(tracks: UnifiedTrack[]): UnifiedTrack[] {
  const sorted = sortTracksByPlayCount(tracks)
  return sorted.slice(0, 10)
}

/**
 * Process tracks from multiple sources and return top 10
 */
export function processTopSongs(
  spotifyTracks: SpotifyTrack[],
  appleMusicTracks: AppleMusicTrack[]
): UnifiedTrack[] {
  const deduplicated = deduplicateTracks(spotifyTracks, appleMusicTracks)
  return selectTop10(deduplicated)
}

