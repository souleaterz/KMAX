export type NativeResolveOptions = {
  apiKey: string
  infoHash: string
  fileIdx?: number
  label: string
}

export type NativePlayOptions = {
  url: string
  title: string
  subtitle?: string
  startAt?: number
}

type NativeRaw = {
  version?: () => string
  play: (reqId: number, optsJson: string) => void
  openExternal: (reqId: number, url: string) => void
  resolveRealDebrid: (reqId: number, optsJson: string) => void
}

type NativeResult = {
  ok: boolean
  error?: string
  url?: string
  label?: string
  filename?: string
}

declare global {
  interface Window {
    KmaxNative?: NativeRaw
    __kmaxResolve?: (reqId: number, json: string) => void
  }
}

let seq = 0
const pending = new Map<number, (value: NativeResult) => void>()

function call(fn: (id: number) => void): Promise<NativeResult> {
  window.__kmaxResolve ??= (reqId, json) => {
    const resolve = pending.get(reqId)
    if (!resolve) return
    pending.delete(reqId)
    try {
      resolve(JSON.parse(json) as NativeResult)
    } catch {
      resolve({ ok: false, error: 'Bad response from Android native bridge.' })
    }
  }
  return new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    fn(id)
  })
}

export function isKmaxNative() {
  return typeof window !== 'undefined' && Boolean(window.KmaxNative)
}

export async function nativeResolveRealDebrid(options: NativeResolveOptions) {
  if (!window.KmaxNative) return { ok: false, error: 'Native bridge is not available.' }
  return call((id) => window.KmaxNative!.resolveRealDebrid(id, JSON.stringify(options)))
}

export async function nativePlay(options: NativePlayOptions) {
  if (!window.KmaxNative) return { ok: false, error: 'Native bridge is not available.' }
  return call((id) => window.KmaxNative!.play(id, JSON.stringify(options)))
}

export async function nativeOpenExternal(url: string) {
  if (!window.KmaxNative) return { ok: false, error: 'Native bridge is not available.' }
  return call((id) => window.KmaxNative!.openExternal(id, url))
}
