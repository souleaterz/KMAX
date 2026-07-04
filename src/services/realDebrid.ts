import { REAL_DEBRID_API_KEY } from '../config'
import type { StreamSource } from '../types'
import { isKmaxNative, nativeResolveRealDebrid } from './kmaxNative'

const RD_API = 'https://api.real-debrid.com/rest/1.0'
const VIDEO_EXTENSIONS = /\.(m3u8|mp4|m4v|mov|mkv|avi)(\?|$)/i

type TorrentioHashStream = {
  infoHash?: string
  fileIdx?: number
  name?: string
  title?: string
  behaviorHints?: {
    filename?: string
  }
}

type AvailabilityFile = {
  filename: string
  filesize: number
}

type AvailabilityResponse = Record<string, { rd?: Record<string, AvailabilityFile>[] }>

type AddMagnetResponse = {
  id: string
}

type TorrentInfo = {
  id: string
  status: string
  files?: { id: number; path: string; bytes: number; selected: number }[]
  links?: string[]
}

type UnrestrictedLink = {
  download?: string
  filename?: string
  streamable?: number
}

export function hasRealDebridResolver() {
  return Boolean(REAL_DEBRID_API_KEY && !REAL_DEBRID_API_KEY.includes('your_'))
}

async function rd<T>(path: string, init?: RequestInit): Promise<T> {
  if (!REAL_DEBRID_API_KEY) throw new Error('Real-Debrid API key is not configured')
  const res = await fetch(`${RD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${REAL_DEBRID_API_KEY}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`Real-Debrid request failed: HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function form(data: Record<string, string>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(data)) body.set(key, value)
  return body
}

function bestAvailableFiles(hash: string, availability: AvailabilityResponse, preferredFileIdx?: number) {
  const variants = availability[hash.toLowerCase()]?.rd ?? availability[hash.toUpperCase()]?.rd ?? []
  const files = variants.flatMap((variant) =>
    Object.entries(variant).map(([id, file]) => ({
      id,
      ...file,
    })),
  )
  const playable = files.filter((file) => VIDEO_EXTENSIONS.test(file.filename))
  const preferredId = preferredFileIdx === undefined ? undefined : String(preferredFileIdx + 1)
  const preferred = playable.find((file) => file.id === preferredId)
  const best = preferred ?? playable.sort((a, b) => b.filesize - a.filesize)[0]
  return best ? [best.id] : []
}

function labelFor(stream: TorrentioHashStream, unrestricted?: UnrestrictedLink) {
  return [stream.name, unrestricted?.filename ?? stream.behaviorHints?.filename ?? stream.title].filter(Boolean).join(' - ')
}

export async function resolveRealDebridStream(
  stream: TorrentioHashStream,
  providerId: string,
  sourceId: string,
): Promise<StreamSource | null> {
  if (!hasRealDebridResolver() || !stream.infoHash) return null
  if (isKmaxNative()) {
    const native = await nativeResolveRealDebrid({
      apiKey: REAL_DEBRID_API_KEY!,
      infoHash: stream.infoHash,
      fileIdx: stream.fileIdx,
      label: labelFor(stream) || 'Real-Debrid stream',
    })
    if (!native.ok || !native.url) return null
    return {
      id: sourceId,
      providerId,
      label: native.filename || native.label || labelFor(stream) || 'Real-Debrid stream',
      quality: stream.title?.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i)?.[1] ?? 'Auto',
      url: native.url,
      type: native.url.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4',
    }
  }
  const hash = stream.infoHash.toLowerCase()
  const availability = await rd<AvailabilityResponse>(`/torrents/instantAvailability/${encodeURIComponent(hash)}`)
  const fileIds = bestAvailableFiles(hash, availability, stream.fileIdx)
  if (fileIds.length === 0) return null

  const magnet = `magnet:?xt=urn:btih:${hash}`
  const added = await rd<AddMagnetResponse>('/torrents/addMagnet', {
    method: 'POST',
    body: form({ magnet }),
  })
  await rd<void>(`/torrents/selectFiles/${encodeURIComponent(added.id)}`, {
    method: 'POST',
    body: form({ files: fileIds.join(',') }),
  })
  const info = await rd<TorrentInfo>(`/torrents/info/${encodeURIComponent(added.id)}`)
  const link = info.links?.[0]
  if (!link) return null

  const unrestricted = await rd<UnrestrictedLink>('/unrestrict/link', {
    method: 'POST',
    body: form({ link }),
  })
  if (!unrestricted.download) return null

  return {
    id: sourceId,
    providerId,
    label: labelFor(stream, unrestricted) || 'Real-Debrid stream',
    quality: stream.title?.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i)?.[1] ?? 'Auto',
    url: unrestricted.download,
    type: unrestricted.download.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4',
  }
}
