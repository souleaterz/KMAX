export const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN as string | undefined
export const REAL_DEBRID_API_KEY = import.meta.env.VITE_REAL_DEBRID_API_KEY as string | undefined
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export const appConfig = {
  appName: 'KMAX',
  providerConfigUrl: import.meta.env.VITE_KMAX_PROVIDER_CONFIG as string | undefined,
}

export function imageUrl(path?: string | null, size = 'w780') {
  if (!path) return '/fallback-poster.svg'
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function backdropUrl(path?: string | null, size = 'w1280') {
  if (!path) return '/fallback-backdrop.svg'
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}
