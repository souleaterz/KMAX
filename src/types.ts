export type MediaType = 'movie' | 'tv'

export type MediaItem = {
  id: number
  mediaType: MediaType
  title: string
  overview: string
  posterPath?: string | null
  backdropPath?: string | null
  rating?: number
  year?: string
  genres?: string[]
  runtime?: number
}

export type Episode = {
  id: number
  season: number
  episode: number
  title: string
  overview?: string
  stillPath?: string | null
  runtime?: number
}

export type Season = {
  seasonNumber: number
  title: string
  episodes: Episode[]
}

export type MediaDetail = MediaItem & {
  cast?: string[]
  seasons?: Season[]
}

export type StreamSource = {
  id: string
  providerId: string
  label: string
  quality: string
  url: string
  type: 'hls' | 'mp4'
  subtitles?: { label: string; src: string; language: string }[]
}

export type PlaybackTarget = {
  media: MediaItem
  episode?: Episode
  source: StreamSource
  resumeSeconds?: number
}

export type WatchProgress = {
  key: string
  media: MediaItem
  episode?: Episode
  seconds: number
  duration: number
  updatedAt: number
}
