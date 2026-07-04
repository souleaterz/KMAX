import { TMDB_BASE_URL, TMDB_TOKEN } from '../config'
import { fallbackCatalog, fallbackRows } from '../data/fallbackCatalog'
import type { Episode, MediaDetail, MediaItem, MediaType, Season } from '../types'

const genreCache = new Map<MediaType, Map<number, string>>()

type TmdbItem = {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  media_type?: MediaType
}

type TmdbVideo = {
  key: string
  site: string
  type: string
  official?: boolean
}

async function tmdb<T>(path: string): Promise<T> {
  if (!TMDB_TOKEN) throw new Error('TMDB token is not configured')
  const res = await fetch(`${TMDB_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB request failed: ${res.status}`)
  return res.json()
}

async function genres(type: MediaType) {
  if (genreCache.has(type)) return genreCache.get(type)!
  const data = await tmdb<{ genres: { id: number; name: string }[] }>(`/genre/${type}/list?language=en-US`)
  const map = new Map(data.genres.map((genre) => [genre.id, genre.name]))
  genreCache.set(type, map)
  return map
}

function normalize(item: TmdbItem, fallbackType: MediaType, genreMap?: Map<number, string>): MediaItem {
  const mediaType = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType
  const date = item.release_date ?? item.first_air_date ?? ''
  return {
    id: item.id,
    mediaType,
    title: item.title ?? item.name ?? 'Untitled',
    overview: item.overview ?? '',
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    rating: item.vote_average,
    year: date.slice(0, 4),
    genres: item.genre_ids?.map((id) => genreMap?.get(id)).filter(Boolean) as string[] | undefined,
  }
}

export async function getHomeRows() {
  if (!TMDB_TOKEN) return fallbackRows
  const [movieGenres, tvGenres] = await Promise.all([genres('movie'), genres('tv')])
  const [trending, movies, tv, nowPlaying, topRatedMovies, airingToday, action, horror, drama] = await Promise.all([
    tmdb<{ results: TmdbItem[] }>('/trending/all/week?language=en-US'),
    tmdb<{ results: TmdbItem[] }>('/movie/popular?language=en-US&page=1'),
    tmdb<{ results: TmdbItem[] }>('/tv/popular?language=en-US&page=1'),
    tmdb<{ results: TmdbItem[] }>('/movie/now_playing?language=en-US&page=1'),
    tmdb<{ results: TmdbItem[] }>('/movie/top_rated?language=en-US&page=1'),
    tmdb<{ results: TmdbItem[] }>('/tv/airing_today?language=en-US&page=1'),
    tmdb<{ results: TmdbItem[] }>('/discover/movie?with_genres=28&sort_by=popularity.desc'),
    tmdb<{ results: TmdbItem[] }>('/discover/movie?with_genres=27&sort_by=popularity.desc'),
    tmdb<{ results: TmdbItem[] }>('/discover/tv?with_genres=18&sort_by=popularity.desc'),
  ])
  return [
    { title: 'Trending Now', items: trending.results.map((item) => normalize(item, item.media_type ?? 'movie', item.media_type === 'tv' ? tvGenres : movieGenres)) },
    { title: 'Popular Movies', items: movies.results.map((item) => normalize(item, 'movie', movieGenres)) },
    { title: 'Popular TV', items: tv.results.map((item) => normalize(item, 'tv', tvGenres)) },
    { title: 'Now Playing', items: nowPlaying.results.map((item) => normalize(item, 'movie', movieGenres)) },
    { title: 'Top Rated Movies', items: topRatedMovies.results.map((item) => normalize(item, 'movie', movieGenres)) },
    { title: 'Airing Today', items: airingToday.results.map((item) => normalize(item, 'tv', tvGenres)) },
    { title: 'Action Movies', items: action.results.map((item) => normalize(item, 'movie', movieGenres)) },
    { title: 'Horror Movies', items: horror.results.map((item) => normalize(item, 'movie', movieGenres)) },
    { title: 'Drama TV', items: drama.results.map((item) => normalize(item, 'tv', tvGenres)) },
  ]
}

export async function searchMedia(query: string) {
  if (!query.trim()) return []
  if (!TMDB_TOKEN) {
    return fallbackCatalog.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  }
  const movieGenres = await genres('movie')
  const tvGenres = await genres('tv')
  const data = await tmdb<{ results: TmdbItem[] }>(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
  return data.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => normalize(item, item.media_type!, item.media_type === 'tv' ? tvGenres : movieGenres))
}

export async function getMediaDetail(type: MediaType, id: number): Promise<MediaDetail> {
  if (!TMDB_TOKEN) {
    const item = fallbackCatalog.find((entry) => entry.id === id && entry.mediaType === type)
    if (!item) throw new Error('Title not found in fallback catalog')
    return item
  }
  const detail = await tmdb<any>(`/${type}/${id}?append_to_response=credits,external_ids&language=en-US`)
  const base: MediaDetail = {
    id,
    imdbId: detail.external_ids?.imdb_id,
    mediaType: type,
    title: detail.title ?? detail.name,
    overview: detail.overview ?? '',
    posterPath: detail.poster_path,
    backdropPath: detail.backdrop_path,
    rating: detail.vote_average,
    year: (detail.release_date ?? detail.first_air_date ?? '').slice(0, 4),
    runtime: detail.runtime ?? detail.episode_run_time?.[0],
    genres: detail.genres?.map((genre: { name: string }) => genre.name),
    cast: detail.credits?.cast?.slice(0, 8).map((person: { name: string }) => person.name),
  }
  if (type === 'tv') {
    base.seasons = await getSeasons(id, detail.seasons ?? [])
  }
  return base
}

export async function getPreviewVideo(type: MediaType, id: number): Promise<string | null> {
  if (!TMDB_TOKEN) return null
  const data = await tmdb<{ results: TmdbVideo[] }>(`/${type}/${id}/videos?language=en-US`)
  const video = data.results
    .filter((entry) => entry.site === 'YouTube')
    .sort((a, b) => scoreVideo(b) - scoreVideo(a))[0]
  return video?.key ?? null
}

function scoreVideo(video: TmdbVideo) {
  let score = 0
  if (video.official) score += 5
  if (video.type === 'Trailer') score += 4
  if (video.type === 'Teaser') score += 3
  if (video.type === 'Clip') score += 2
  return score
}

async function getSeasons(id: number, seasons: { season_number: number; name: string }[]): Promise<Season[]> {
  const realSeasons = seasons.filter((season) => season.season_number > 0).slice(0, 5)
  const data = await Promise.all(
    realSeasons.map((season) => tmdb<any>(`/tv/${id}/season/${season.season_number}?language=en-US`)),
  )
  return data.map((season) => ({
    seasonNumber: season.season_number,
    title: season.name,
    episodes: season.episodes?.map((episode: any): Episode => ({
      id: episode.id,
      season: season.season_number,
      episode: episode.episode_number,
      title: episode.name,
      overview: episode.overview,
      stillPath: episode.still_path,
      runtime: episode.runtime,
    })) ?? [],
  }))
}
