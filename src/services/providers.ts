import type { Episode, MediaDetail, StreamSource } from '../types'
import { appConfig } from '../config'
import { hasRealDebridResolver, resolveRealDebridStream } from './realDebrid'

export type StreamProvider = {
  id: string
  name: string
  findStreams(media: MediaDetail, episode?: Episode): Promise<StreamProviderResult>
}

export type StreamProviderResult = {
  streams: StreamSource[]
  messages?: string[]
}

type ConfigProvider = {
  id: string
  name: string
  enabled?: boolean
  priority?: number
  type?: 'static' | 'stremio'
  baseUrl?: string
  streams?: StaticStream[]
}

type StaticStream = {
  tmdbId?: number
  mediaType?: string
  title?: string
  episodeId?: number
  label: string
  quality: string
  url: string
  type: 'hls' | 'mp4'
}

type ProviderConfigFile = ConfigProvider | { providers: ConfigProvider[] }

type StremioStream = {
  name?: string
  title?: string
  url?: string
  externalUrl?: string
  infoHash?: string
  fileIdx?: number
  behaviorHints?: {
    filename?: string
  }
}

function isStream(value: unknown): value is StaticStream {
  if (!value || typeof value !== 'object') return false
  const stream = value as Record<string, unknown>
  return (
    typeof stream.label === 'string' &&
    typeof stream.quality === 'string' &&
    typeof stream.url === 'string' &&
    (stream.type === 'hls' || stream.type === 'mp4') &&
    (stream.tmdbId === undefined || typeof stream.tmdbId === 'number') &&
    (stream.mediaType === undefined || stream.mediaType === 'movie' || stream.mediaType === 'tv') &&
    (stream.title === undefined || typeof stream.title === 'string') &&
    (stream.episodeId === undefined || typeof stream.episodeId === 'number')
  )
}

function normalizeConfigProviders(config: ProviderConfigFile): ConfigProvider[] {
  const providers = 'providers' in config ? config.providers : [config]
  return providers
    .filter((provider) => provider.enabled !== false)
    .filter((provider) => provider.id && provider.name)
    .map((provider) => ({
      ...provider,
      type: provider.type ?? 'static',
      streams: provider.streams?.filter(isStream) ?? [],
      priority: provider.priority ?? 100,
    }))
    .filter((provider) => {
      if (provider.type === 'stremio') return typeof provider.baseUrl === 'string' && provider.baseUrl.length > 0
      return provider.streams.length > 0
    })
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

function playableType(url: string): StreamSource['type'] | null {
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.m3u8')) return 'hls'
  if (clean.endsWith('.mp4') || clean.endsWith('.m4v') || clean.endsWith('.mov')) return 'mp4'
  return null
}

function qualityFromText(text: string) {
  const quality = text.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i)?.[1]
  return quality ? quality.toUpperCase().replace('4K', '4K') : 'Auto'
}

function stremioType(media: MediaDetail) {
  return media.mediaType === 'movie' ? 'movie' : 'series'
}

function stremioId(media: MediaDetail, episode?: Episode) {
  if (!media.imdbId) return null
  if (media.mediaType === 'tv' && episode) return `${media.imdbId}:${episode.season}:${episode.episode}`
  return media.imdbId
}

function stremioBaseUrl(url: string) {
  return url.replace(/\/manifest\.json$/i, '').replace(/\/$/, '')
}

const samplePublicDomainProvider: StreamProvider = {
  id: 'sample-public-domain',
  name: 'Public Domain Samples',
  async findStreams(media, episode) {
    if (media.title !== 'Night of the Living Dead' && media.title !== 'Public Domain Theater' && media.title !== 'The General') {
      return { streams: [] }
    }
    return {
      streams: [
        {
          id: `${media.id}-${episode?.id ?? 'movie'}-sample`,
          providerId: this.id,
          label: `${media.title} sample stream`,
          quality: '720p',
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          type: 'hls',
        },
      ],
    }
  },
}

function createConfiguredProvider(config: ConfigProvider): StreamProvider {
  if (config.type === 'stremio') return createStremioProvider(config)
  return {
    id: config.id,
    name: config.name,
    async findStreams(media, episode) {
      const streams = (config.streams ?? [])
        .filter((stream) => {
          const mediaMatch =
            (stream.tmdbId && stream.tmdbId === media.id && (!stream.mediaType || stream.mediaType === media.mediaType)) ||
            (stream.title && stream.title.toLowerCase() === media.title.toLowerCase())
          const episodeMatch = !stream.episodeId || stream.episodeId === episode?.id
          return mediaMatch && episodeMatch
        })
        .map((stream) => ({ ...stream, id: `${config.id}-${stream.label}`, providerId: config.id }))
      return { streams }
    },
  }
}

function createStremioProvider(config: ConfigProvider): StreamProvider {
  return {
    id: config.id,
    name: config.name,
    async findStreams(media, episode) {
      const id = stremioId(media, episode)
      if (!id || !config.baseUrl) {
        return {
          streams: [],
          messages: [`${config.name}: no IMDb ID is available yet, so the addon cannot be queried.`],
        }
      }
      const baseUrl = stremioBaseUrl(config.baseUrl)
      const res = await fetch(`${baseUrl}/stream/${stremioType(media)}/${encodeURIComponent(id)}.json`)
      if (!res.ok) {
        return {
          streams: [],
          messages: [`${config.name}: addon request failed with HTTP ${res.status}.`],
        }
      }
      const data = (await res.json()) as { streams?: StremioStream[] }
      const rawStreams = data.streams ?? []
      const streams = rawStreams
        .map((stream, index): StreamSource | null => {
          if (!stream.url) return null
          const type = playableType(stream.url)
          if (!type) return null
          const label = [stream.name, stream.title, stream.behaviorHints?.filename].filter(Boolean).join(' - ') || `${config.name} stream`
          return {
            id: `${config.id}-${id}-${index}`,
            providerId: config.id,
            label,
            quality: qualityFromText(label),
            url: stream.url,
            type,
          }
        })
        .filter((stream): stream is StreamSource => Boolean(stream))
      if (streams.length === 0 && hasRealDebridResolver()) {
        const hashStreams = rawStreams.filter((stream) => stream.infoHash).slice(0, 5)
        const resolved: StreamSource[] = []
        let failedResolutions = 0
        for (const [index, stream] of hashStreams.entries()) {
          try {
            const source = await resolveRealDebridStream(stream, config.id, `${config.id}-${id}-rd-${index}`)
            if (source) resolved.push(source)
          } catch {
            failedResolutions += 1
            // One failed source should not hide the rest of the provider results.
          }
          if (resolved.length >= 3) break
        }
        if (resolved.length > 0) {
          return { streams: resolved }
        }
        if (hashStreams.length > 0) {
          return {
            streams: [],
            messages: [
              `${config.name}: Real-Debrid resolver tried ${hashStreams.length} hash result(s), but none became a playable direct link.${failedResolutions ? ' Some requests failed.' : ''}`,
            ],
          }
        }
      }
      return {
        streams,
        messages:
          rawStreams.length > 0 && streams.length === 0
            ? [`${config.name}: addon returned ${rawStreams.length} result(s), but none were direct HLS/MP4 links KMAX can play.`]
            : undefined,
      }
    },
  }
}

async function configuredProviders(): Promise<StreamProvider[]> {
  if (!appConfig.providerConfigUrl) return []
  if (appConfig.providerConfigUrl.startsWith('/') && typeof window === 'undefined') return []
  const res = await fetch(appConfig.providerConfigUrl)
  if (!res.ok) throw new Error('Provider config could not be loaded')
  const config = (await res.json()) as ProviderConfigFile
  return normalizeConfigProviders(config).map(createConfiguredProvider)
}

export async function findStreams(media: MediaDetail, episode?: Episode): Promise<StreamSource[]> {
  const result = await findStreamsWithDiagnostics(media, episode)
  return result.streams
}

export async function findStreamsWithDiagnostics(media: MediaDetail, episode?: Episode): Promise<StreamProviderResult> {
  const configured = await configuredProviders()
  const providers = [...configured, samplePublicDomainProvider]
  const results = await Promise.all(providers.map((provider) => provider.findStreams(media, episode)))
  return {
    streams: results.flatMap((result) => result.streams),
    messages: results.flatMap((result) => result.messages ?? []),
  }
}

export const providerConfigInternals = {
  normalizeConfigProviders,
  stremioBaseUrl,
}
