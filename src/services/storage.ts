import type { MediaItem, WatchProgress } from '../types'

const WATCHLIST_KEY = 'kmax.watchlist'
const PROGRESS_KEY = 'kmax.progress'
const SETTINGS_KEY = 'kmax.settings'

export type Settings = {
  autoplay: boolean
  subtitles: boolean
  reducedMotion: boolean
  trailerSound: boolean
}

export function mediaKey(media: MediaItem, episodeId?: number) {
  return `${media.mediaType}:${media.id}${episodeId ? `:${episodeId}` : ''}`
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event('kmax-storage'))
}

export function getWatchlist(): MediaItem[] {
  return read(WATCHLIST_KEY, [])
}

export function toggleWatchlist(media: MediaItem) {
  const current = getWatchlist()
  const exists = current.some((item) => item.id === media.id && item.mediaType === media.mediaType)
  write(WATCHLIST_KEY, exists ? current.filter((item) => item.id !== media.id || item.mediaType !== media.mediaType) : [media, ...current])
}

export function isWatchlisted(media: MediaItem) {
  return getWatchlist().some((item) => item.id === media.id && item.mediaType === media.mediaType)
}

export function getProgress(): WatchProgress[] {
  return read<WatchProgress[]>(PROGRESS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getProgressFor(key: string) {
  return getProgress().find((item) => item.key === key)
}

export function saveProgress(progress: WatchProgress) {
  const rest = getProgress().filter((item) => item.key !== progress.key)
  write(PROGRESS_KEY, [progress, ...rest].slice(0, 40))
}

export function getSettings(): Settings {
  return { autoplay: false, subtitles: true, reducedMotion: false, trailerSound: false, ...read(SETTINGS_KEY, {}) }
}

export function saveSettings(settings: Settings) {
  write(SETTINGS_KEY, settings)
}
