import { writeFileSync } from 'node:fs'

const stremioBaseUrl = process.env.KMAX_STREMIO_BASE_URL

const providers = [
  {
    id: 'local-sample-provider',
    name: 'KMAX Sample Provider',
    type: 'static',
    enabled: true,
    priority: 10,
    streams: [
      {
        tmdbId: 11,
        mediaType: 'movie',
        label: 'Sample HLS',
        quality: '720p',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls',
      },
    ],
  },
]

if (stremioBaseUrl) {
  providers.push({
    id: 'my-stremio-addon',
    name: 'My Torrentio / Stremio Addon',
    type: 'stremio',
    enabled: true,
    priority: 20,
    baseUrl: stremioBaseUrl,
  })
}

writeFileSync('public/providers.local.json', `${JSON.stringify({ providers }, null, 2)}\n`)
console.log(`Wrote public/providers.local.json with ${providers.length} provider(s).`)
