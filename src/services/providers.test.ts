import { afterEach, describe, expect, it, vi } from 'vitest'
import { findStreams, providerConfigInternals } from './providers'
import type { MediaDetail } from '../types'

const baseMovie: MediaDetail = {
  id: 11,
  mediaType: 'movie',
  title: 'Night of the Living Dead',
  overview: '',
}

describe('stream providers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns sample streams for configured public-domain development content', async () => {
    const streams = await findStreams(baseMovie)
    expect(streams).toHaveLength(1)
    expect(streams[0]).toMatchObject({
      providerId: 'sample-public-domain',
      quality: '720p',
      type: 'hls',
    })
  })

  it('returns no streams for titles without configured sources', async () => {
    const streams = await findStreams({ ...baseMovie, id: 999, title: 'Unconfigured Title' })
    expect(streams).toEqual([])
  })

  it('normalizes multiple configured providers by enabled status, validity, and priority', () => {
    const providers = providerConfigInternals.normalizeConfigProviders({
      providers: [
        {
          id: 'late',
          name: 'Late Provider',
          priority: 50,
          streams: [
            {
              tmdbId: 11,
              mediaType: 'movie',
              label: 'Late',
              quality: '720p',
              url: 'https://example.test/late.m3u8',
              type: 'hls',
            },
          ],
        },
        {
          id: 'disabled',
          name: 'Disabled Provider',
          enabled: false,
          streams: [
            {
              label: 'Disabled',
              quality: '720p',
              url: 'https://example.test/disabled.m3u8',
              type: 'hls',
            },
          ],
        },
        {
          id: 'early',
          name: 'Early Provider',
          type: 'static',
          priority: 1,
          streams: [
            {
              label: 'Broken',
              quality: '720p',
              url: 'https://example.test/broken.m3u8',
              type: 'dash' as 'hls',
            },
            {
              title: 'Night of the Living Dead',
              label: 'Early',
              quality: '1080p',
              url: 'https://example.test/early.mp4',
              type: 'mp4',
            },
          ],
        },
      ],
    })

    expect(providers.map((provider) => provider.id)).toEqual(['early', 'late'])
    const firstProvider = providers[0]!
    const streams = firstProvider.streams ?? []
    expect(streams).toHaveLength(1)
    expect(streams[0]!.label).toBe('Early')
  })

  it('keeps enabled Stremio-style providers without requiring static streams', () => {
    const providers = providerConfigInternals.normalizeConfigProviders({
      providers: [
        {
          id: 'stremio-addon',
          name: 'Stremio Addon',
          type: 'stremio',
          baseUrl: 'https://example.test/addon',
          priority: 5,
        },
      ],
    })

    expect(providers).toHaveLength(1)
    expect(providers[0]).toMatchObject({
      id: 'stremio-addon',
      type: 'stremio',
      baseUrl: 'https://example.test/addon',
    })
  })

  it('accepts Stremio manifest URLs as addon base URLs', () => {
    expect(providerConfigInternals.stremioBaseUrl('https://example.test/addon/manifest.json')).toBe('https://example.test/addon')
    expect(providerConfigInternals.stremioBaseUrl('https://example.test/addon')).toBe('https://example.test/addon')
  })
})
