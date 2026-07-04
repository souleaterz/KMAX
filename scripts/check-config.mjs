import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env.local')
const sampleEnvPath = resolve(cwd, '.env.example')

function readEnv(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return index === -1 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

function providerPath(value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return resolve(cwd, 'public', value.replace(/^\//, ''))
}

function loadProviders(path) {
  if (!path || /^https?:\/\//i.test(path) || !existsSync(path)) return null
  const config = JSON.parse(readFileSync(path, 'utf8'))
  return 'providers' in config ? config.providers : [config]
}

const env = readEnv(envPath)
const example = readEnv(sampleEnvPath)
const tmdb = env.VITE_TMDB_TOKEN
const realDebrid = env.VITE_REAL_DEBRID_API_KEY
const providerConfig = env.VITE_KMAX_PROVIDER_CONFIG ?? example.VITE_KMAX_PROVIDER_CONFIG
const providersPath = providerPath(providerConfig)
const providers = loadProviders(providersPath)

console.log('KMAX config check')
console.log(`.env.local: ${existsSync(envPath) ? 'found' : 'missing'}`)
console.log(`TMDB token: ${tmdb && !tmdb.includes('your_') ? 'configured' : 'missing'}`)
console.log(`Real-Debrid key: ${realDebrid && !realDebrid.includes('your_') ? 'configured (private/local)' : 'missing'}`)
console.log(`Provider config: ${providerConfig ?? 'missing'}`)

if (providersPath && !/^https?:\/\//i.test(providersPath)) {
  console.log(`Provider file: ${existsSync(providersPath) ? 'found' : 'missing'} (${providersPath})`)
}

if (providers) {
  for (const provider of providers) {
    const enabled = provider.enabled !== false ? 'enabled' : 'disabled'
    const type = provider.type ?? 'static'
    const warnings = []
    if (type === 'stremio' && provider.baseUrl?.endsWith('/manifest.json')) {
      warnings.push('accepts manifest URL, KMAX will strip it automatically')
    }
    if (type === 'stremio' && provider.baseUrl?.includes('PASTE_')) {
      warnings.push('needs your copied Torrentio link')
    }
    if (
      type === 'stremio' &&
      enabled === 'enabled' &&
      !realDebrid &&
      !/debrid|realdebrid|premiumize|alldebrid|torbox/i.test(provider.baseUrl ?? '')
    ) {
      warnings.push('does not look debrid-configured, likely torrent hashes only')
    }
    const warning = warnings.length ? ` ${warnings.join('; ')}` : ''
    console.log(`- ${provider.id}: ${type}, ${enabled}${warning}`)
  }
}
