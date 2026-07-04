import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Hls from 'hls.js'
import { Bookmark, Check, Film, Home, Play, Search, Settings, Star, Tv, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { backdropUrl, imageUrl } from './config'
import { getHomeRows, getMediaDetail, getPreviewVideo, searchMedia } from './services/tmdb'
import { findStreamsWithDiagnostics } from './services/providers'
import { getProgressFor, getSettings, mediaKey, saveProgress, saveSettings, toggleWatchlist } from './services/storage'
import { useProgress, useSettings, useWatchlist } from './hooks/useLocalData'
import { useRemoteKeys } from './hooks/useRemoteKeys'
import { isKmaxNative, nativePlay } from './services/kmaxNative'
import type { Episode, MediaItem, MediaType, PlaybackTarget, StreamSource } from './types'

function FocusLink({
  to,
  className,
  children,
  ...props
}: { to: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link to={to} className={className} data-focusable="true" {...props}>
      {children}
    </Link>
  )
}

function App() {
  useRemoteKeys()
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-stage">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/browse/:genre" element={<BrowseScreen />} />
          <Route path="/watchlist" element={<WatchlistScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/:type/:id" element={<DetailScreen />} />
          <Route path="/player/:type/:id" element={<PlayerScreen />} />
        </Routes>
      </main>
    </div>
  )
}

function Sidebar() {
  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/browse/action', label: 'Genres', icon: Film },
    { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  return (
    <aside className="sidebar">
      <div className="brand">KMAX</div>
      <nav>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} data-focusable="true" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={24} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function HomeScreen() {
  const rowsQuery = useQuery({ queryKey: ['home'], queryFn: getHomeRows })
  const progress = useProgress()
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const rows = rowsQuery.data ?? []
  const featured = rows[0]?.items[0]
  const heroItem = previewItem ?? featured
  return (
    <div>
      {heroItem && <Hero item={heroItem} previewActive={Boolean(previewItem)} />}
      {progress.length > 0 && <ResumeRow items={progress} onPreview={setPreviewItem} />}
      {rowsQuery.isLoading && <SkeletonRows />}
      {rowsQuery.isError && <EmptyState title="Metadata unavailable" body="Check your TMDB token or continue with the fallback catalog." />}
      {rows.map((row) => (
        <MediaRow key={row.title} title={row.title} items={row.items} onPreview={setPreviewItem} />
      ))}
    </div>
  )
}

function Hero({ item, previewActive = false }: { item: MediaItem; previewActive?: boolean }) {
  const [readyForVideo, setReadyForVideo] = useState(false)
  const videoQuery = useQuery({
    queryKey: ['preview-video', item.mediaType, item.id],
    queryFn: () => getPreviewVideo(item.mediaType, item.id),
    enabled: previewActive,
    staleTime: 1000 * 60 * 60,
  })

  useEffect(() => {
    setReadyForVideo(false)
    if (!previewActive) return
    const timer = window.setTimeout(() => setReadyForVideo(true), 650)
    return () => window.clearTimeout(timer)
  }, [item.id, item.mediaType, previewActive])

  const videoKey = readyForVideo ? videoQuery.data : null
  return (
    <section className="hero-panel" style={{ backgroundImage: `linear-gradient(90deg, #08080a 0%, rgba(8,8,10,.86) 36%, rgba(8,8,10,.12) 100%), url(${backdropUrl(item.backdropPath)})` }}>
      {videoKey && (
        <iframe
          className="hero-preview-video"
          title={`${item.title} preview`}
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${videoKey}&modestbranding=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex={-1}
        />
      )}
      <div className="hero-video-scrim" />
      <div className="hero-copy">
        <div className="kicker">{previewActive ? 'Previewing' : item.mediaType === 'movie' ? 'Movie Spotlight' : 'Series Spotlight'}</div>
        <h1>{item.title}</h1>
        <p>{item.overview}</p>
        <div className="meta-line">
          <span>{item.year || 'New'}</span>
          <span>{item.rating ? `${item.rating.toFixed(1)} rating` : 'Unrated'}</span>
          <span>{item.genres?.slice(0, 2).join(' / ')}</span>
        </div>
        <div className="hero-actions">
          <FocusLink to={`/${item.mediaType}/${item.id}`} className="primary-button">
            <Play size={22} fill="currentColor" /> Play
          </FocusLink>
          <FocusLink to={`/${item.mediaType}/${item.id}`} className="secondary-button">
            More Info
          </FocusLink>
        </div>
      </div>
    </section>
  )
}

function MediaRow({
  title,
  items,
  progress = false,
  onPreview,
}: {
  title: string
  items: MediaItem[]
  progress?: boolean
  onPreview?: (item: MediaItem | null) => void
}) {
  if (!items.length) return null
  return (
    <section className="media-row">
      <h2>{title}</h2>
      <div className="rail">
        {items.map((item) => (
          <PreviewCard key={`${item.mediaType}-${item.id}`} item={item} progress={progress} onPreview={onPreview} />
        ))}
      </div>
    </section>
  )
}

function PreviewCard({
  item,
  progress = false,
  progressPercent,
  onPreview,
}: {
  item: MediaItem
  progress?: boolean
  progressPercent?: number
  onPreview?: (item: MediaItem | null) => void
}) {
  function preview() {
    onPreview?.(item)
  }

  return (
    <FocusLink
      to={`/${item.mediaType}/${item.id}`}
      className="poster-card"
      onMouseEnter={preview}
      onMouseMove={preview}
      onMouseOver={preview}
      onPointerEnter={preview}
      onFocus={preview}
      onFocusCapture={preview}
    >
            <img src={imageUrl(item.posterPath, 'w342')} alt="" loading="lazy" />
            <div className="poster-gradient" />
            <div className="poster-title">{item.title}</div>
      {progress && <div className="progress-strip" style={progressPercent ? { width: `${progressPercent}%` } : undefined} />}
    </FocusLink>
  )
}

function ResumeRow({ items, onPreview }: { items: ReturnType<typeof useProgress>; onPreview?: (item: MediaItem | null) => void }) {
  return (
    <section className="media-row">
      <h2>Resume Watching</h2>
      <div className="rail">
        {items.map((item) => {
          const percent = item.duration > 0 ? Math.min(100, Math.max(3, (item.seconds / item.duration) * 100)) : 8
          return (
            <PreviewCard key={item.key} item={item.media} progress progressPercent={percent} onPreview={onPreview} />
          )
        })}
      </div>
    </section>
  )
}

function DetailScreen() {
  const { type, id } = useParams()
  const navigate = useNavigate()
  const mediaType = (type === 'tv' ? 'tv' : 'movie') as MediaType
  const detailQuery = useQuery({ queryKey: ['detail', mediaType, id], queryFn: () => getMediaDetail(mediaType, Number(id)) })
  const [episode, setEpisode] = useState<Episode | undefined>()
  const [source, setSource] = useState<StreamSource | undefined>()
  const streamsQuery = useQuery({
    queryKey: ['streams', mediaType, id, episode?.id],
    queryFn: () => findStreamsWithDiagnostics(detailQuery.data!, episode),
    enabled: Boolean(detailQuery.data),
  })

  if (detailQuery.isLoading) return <SkeletonRows />
  if (!detailQuery.data) return <EmptyState title="Title not found" body="This movie or show could not be loaded." />
  const detail = detailQuery.data
  const activeEpisode = episode ?? detail.seasons?.[0]?.episodes[0]
  const streams = streamsQuery.data?.streams ?? []
  const chosenSource = source ?? streams[0]
  const resume = activeEpisode ? getProgressFor(mediaKey(detail, activeEpisode.id)) : getProgressFor(mediaKey(detail))
  const canResume = resume && resume.seconds > 30 && resume.duration - resume.seconds > 45

  async function play() {
    if (!chosenSource) return
    if (isKmaxNative()) {
      const result = await nativePlay({
        url: chosenSource.url,
        title: detail.title,
        subtitle: activeEpisode ? `S${activeEpisode.season}:E${activeEpisode.episode} ${activeEpisode.title}` : chosenSource.label,
        startAt: canResume ? resume.seconds : 0,
      })
      if (result.ok) return
    }
    sessionStorage.setItem(
      'kmax.playback',
      JSON.stringify({ media: detail, episode: activeEpisode, source: chosenSource, resumeSeconds: canResume ? resume.seconds : 0 }),
    )
    navigate(`/player/${detail.mediaType}/${detail.id}`)
  }

  return (
    <article className="detail">
      <div className="detail-backdrop" style={{ backgroundImage: `linear-gradient(90deg, #08080a 0%, rgba(8,8,10,.8) 45%, rgba(8,8,10,.2) 100%), url(${backdropUrl(detail.backdropPath)})` }} />
      <div className="detail-grid">
        <img className="detail-poster" src={imageUrl(detail.posterPath, 'w500')} alt="" />
        <div className="detail-copy">
          <div className="kicker">{detail.mediaType === 'movie' ? 'Movie' : 'TV Show'}</div>
          <h1>{detail.title}</h1>
          <div className="meta-line">
            <span>{detail.year}</span>
            <span><Star size={16} fill="currentColor" /> {detail.rating?.toFixed(1) ?? 'NR'}</span>
            <span>{detail.runtime ? `${detail.runtime} min` : detail.genres?.join(' / ')}</span>
          </div>
          <p>{detail.overview || 'No synopsis is available yet.'}</p>
          {detail.cast?.length ? <p className="muted">Cast: {detail.cast.join(', ')}</p> : null}
          <div className="source-panel">
            <h2>Play Options</h2>
            {streamsQuery.isLoading && <div className="status-box">Finding configured streams...</div>}
            {!streamsQuery.isLoading && streams.length === 0 && (
              <div className="status-box">
                <strong>No playable streams found.</strong>
                <span>
                  {streamsQuery.data?.messages?.[0] ??
                    'Your enabled providers did not return a direct HLS/MP4 stream for this title.'}
                </span>
              </div>
            )}
            <div className="source-list">
              {streams.map((stream) => (
                <button key={stream.id} data-focusable="true" className={chosenSource?.id === stream.id ? 'source active' : 'source'} onClick={() => setSource(stream)}>
                  <span>{stream.label}</span>
                  <strong>{stream.quality}</strong>
                </button>
              ))}
            </div>
            <button className="primary-button" data-focusable="true" disabled={!chosenSource} onClick={play}>
              <Play size={22} fill="currentColor" /> {canResume ? `Resume ${formatTime(resume.seconds)}` : 'Play Now'}
            </button>
            <WatchlistButton media={detail} />
          </div>
        </div>
      </div>
      {detail.seasons?.map((season) => (
        <section className="episodes" key={season.seasonNumber}>
          <h2>{season.title}</h2>
          <div className="episode-grid">
            {season.episodes.map((entry) => (
              <button key={entry.id} data-focusable="true" className={activeEpisode?.id === entry.id ? 'episode active' : 'episode'} onClick={() => setEpisode(entry)}>
                <span>{entry.episode}. {entry.title}</span>
                <small>{entry.runtime ? `${entry.runtime} min` : 'Episode'}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </article>
  )
}

function WatchlistButton({ media }: { media: MediaItem }) {
  const watchlist = useWatchlist()
  const active = useMemo(() => watchlist.some((item) => item.id === media.id && item.mediaType === media.mediaType), [watchlist, media])
  return (
    <button className="secondary-button" data-focusable="true" onClick={() => toggleWatchlist(media)}>
      {active ? <Check size={22} /> : <Bookmark size={22} />} {active ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
  )
}

function PlayerScreen() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [target] = useState<PlaybackTarget | null>(() => {
    const raw = sessionStorage.getItem('kmax.playback')
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    if (!target || !videoRef.current) return
    const playback = target
    const video = videoRef.current
    let hls: Hls | undefined
    setError('')
    if (playback.source.type === 'hls' && Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(playback.source.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError('This stream failed. Go back and choose another source.')
      })
    } else {
      video.src = playback.source.url
    }
    function resumePlayback() {
      if (playback.resumeSeconds && video.duration > playback.resumeSeconds) {
        video.currentTime = playback.resumeSeconds
      }
    }
    video.addEventListener('loadedmetadata', resumePlayback, { once: true })
    const key = mediaKey(playback.media, playback.episode?.id)
    const timer = window.setInterval(() => {
      if (video.duration > 0) {
        saveProgress({ key, media: playback.media, episode: playback.episode, seconds: video.currentTime, duration: video.duration, updatedAt: Date.now() })
      }
    }, 5000)
    return () => {
      window.clearInterval(timer)
      video.removeEventListener('loadedmetadata', resumePlayback)
      hls?.destroy()
    }
  }, [target])

  if (!target) return <EmptyState title="Nothing queued" body="Choose a movie or episode to start playback." />
  return (
    <section className="player-screen">
      <button className="player-back" data-focusable="true" onClick={() => navigate(-1)}>
        <X size={26} /> Back
      </button>
      <video ref={videoRef} controls autoPlay playsInline className="video-player" onError={() => setError('This stream failed. Go back and choose another source.')} />
      <div className="player-title">
        <strong>{target.media.title}</strong>
        <span>{target.episode ? `S${target.episode.season}:E${target.episode.episode} ${target.episode.title}` : target.source.quality}</span>
      </div>
      {error && <div className="player-error">{error}</div>}
    </section>
  )
}

function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const resultsQuery = useQuery({ queryKey: ['search', query], queryFn: () => searchMedia(query), enabled: query.length > 1 })
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setParams({ q: String(form.get('q') ?? '') })
  }
  return (
    <section className="page-pad">
      <h1>Search</h1>
      <form className="search-form" onSubmit={onSubmit}>
        <input name="q" data-focusable="true" defaultValue={query} placeholder="Search movies and TV shows" />
        <button data-focusable="true" className="primary-button"><Search size={22} /> Search</button>
      </form>
      {resultsQuery.data && <MediaGrid items={resultsQuery.data} />}
      {query && resultsQuery.data?.length === 0 && <EmptyState title="No results" body="Try another title or check your metadata configuration." />}
    </section>
  )
}

function BrowseScreen() {
  const rowsQuery = useQuery({ queryKey: ['home'], queryFn: getHomeRows })
  const items = rowsQuery.data?.flatMap((row) => row.items) ?? []
  const unique = Array.from(new Map(items.map((item) => [`${item.mediaType}-${item.id}`, item])).values())
  return (
    <section className="page-pad">
      <h1>Browse</h1>
      <div className="genre-pills">
        {['Action', 'Drama', 'Comedy', 'Horror', 'Classic', 'TV'].map((genre) => (
          <FocusLink key={genre} to={`/browse/${genre.toLowerCase()}`} className="secondary-button">{genre}</FocusLink>
        ))}
      </div>
      <MediaGrid items={unique} />
    </section>
  )
}

function WatchlistScreen() {
  const watchlist = useWatchlist()
  return (
    <section className="page-pad">
      <h1>Watchlist</h1>
      {watchlist.length ? <MediaGrid items={watchlist} /> : <EmptyState title="Your watchlist is empty" body="Add movies and shows from their detail pages." />}
    </section>
  )
}

function SettingsScreen() {
  const settings = useSettings()
  function update(key: keyof typeof settings) {
    saveSettings({ ...getSettings(), [key]: !settings[key] })
  }
  return (
    <section className="page-pad settings-page">
      <h1>Settings</h1>
      <SettingRow title="Autoplay next episode" active={settings.autoplay} onClick={() => update('autoplay')} />
      <SettingRow title="Prefer subtitles when available" active={settings.subtitles} onClick={() => update('subtitles')} />
      <SettingRow title="Reduce motion" active={settings.reducedMotion} onClick={() => update('reducedMotion')} />
      <div className="status-box">
        TMDB: {import.meta.env.VITE_TMDB_TOKEN ? 'configured' : 'fallback catalog'} · Providers: {import.meta.env.VITE_KMAX_PROVIDER_CONFIG ? 'custom config' : 'sample only'}
      </div>
    </section>
  )
}

function SettingRow({ title, active, onClick }: { title: string; active: boolean; onClick: () => void }) {
  return (
    <button className="setting-row" data-focusable="true" onClick={onClick}>
      <span>{title}</span>
      <strong>{active ? 'On' : 'Off'}</strong>
    </button>
  )
}

function formatTime(seconds: number) {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remaining = total % 60
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

function MediaGrid({ items }: { items: MediaItem[] }) {
  return (
    <div className="media-grid">
      {items.map((item) => (
        <FocusLink key={`${item.mediaType}-${item.id}`} to={`/${item.mediaType}/${item.id}`} className="poster-card">
          <img src={imageUrl(item.posterPath, 'w342')} alt="" loading="lazy" />
          <div className="poster-gradient" />
          <div className="poster-title">{item.title}</div>
        </FocusLink>
      ))}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="skeleton-wrap">
      {Array.from({ length: 12 }).map((_, index) => <div className="skeleton-card" key={index} />)}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Tv size={42} />
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

export default App
