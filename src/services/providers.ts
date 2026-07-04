import type { Episode, MediaDetail, StreamSource } from '../types'
import { appConfig } from '../config'

export type StreamProvider = {
  id: string
  name: string
  findStreams(media: MediaDetail, episode?: Episode): Promise<StreamSource[]>
}

type ConfigProvider = {
  id: string
  name: string
  enabled?: boolean
  priority?: number
  streams: {
    tmdbId?: number
    mediaType?: string
    title?: string
    episodeId?: number
    label: string
    quality: string
    url: string
    type: 'hls' | 'mp4'
  }[]
}

type ProviderConfigFile = ConfigProvider | { providers: ConfigProvider[] }

function isStream(value: unknown): value is ConfigProvider['streams'][number] {
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
    .filter((provider) => provider.id && provider.name && Array.isArray(provider.streams))
    .map((provider) => ({
      ...provider,
      streams: provider.streams.filter(isStream),
      priority: provider.priority ?? 100,
    }))
    .filter((provider) => provider.streams.length > 0)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

const samplePublicDomainProvider: StreamProvider = {
  id: 'sample-public-domain',
  name: 'Public Domain Samples',
  async findStreams(media, episode) {
    if (media.title !== 'Night of the Living Dead' && media.title !== 'Public Domain Theater' && media.title !== 'The General') {
      return []
    }
    return [
      {
        id: `${media.id}-${episode?.id ?? 'movie'}-sample`,
        providerId: this.id,
        label: `${media.title} sample stream`,
        quality: '720p',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls',
      },
    ]
  },
}

function createConfiguredProvider(config: ConfigProvider): StreamProvider {
  return {
    id: config.id,
    name: config.name,
    async findStreams(media, episode) {
      return config.streams
        .filter((stream) => {
          const mediaMatch =
            (stream.tmdbId && stream.tmdbId === media.id && (!stream.mediaType || stream.mediaType === media.mediaType)) ||
            (stream.title && stream.title.toLowerCase() === media.title.toLowerCase())
          const episodeMatch = !stream.episodeId || stream.episodeId === episode?.id
          return mediaMatch && episodeMatch
        })
        .map((stream) => ({ ...stream, id: `${config.id}-${stream.label}`, providerId: config.id }))
    },
  }
}

async function configuredProviders(): Promise<StreamProvider[]> {
  if (!appConfig.providerConfigUrl) return []
  const res = await fetch(appConfig.providerConfigUrl)
  if (!res.ok) throw new Error('Provider config could not be loaded')
  const config = (await res.json()) as ProviderConfigFile
  return normalizeConfigProviders(config).map(createConfiguredProvider)
}

export async function findStreams(media: MediaDetail, episode?: Episode): Promise<StreamSource[]> {
  const configured = await configuredProviders()
  const providers = [...configured, samplePublicDomainProvider]
  const results = await Promise.all(providers.map((provider) => provider.findStreams(media, episode)))
  return results.flat()
}

export const providerConfigInternals = {
  normalizeConfigProviders,
}
