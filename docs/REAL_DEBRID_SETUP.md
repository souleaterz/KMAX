# Real-Debrid Setup for KMAX

This guide assumes you are new to this. That is okay.

## What Real-Debrid Does

Torrentio without Real-Debrid often gives KMAX torrent hashes. KMAX cannot play those directly.

Real-Debrid can make some results available as direct video links. Those direct links are what KMAX needs for browser playback and APK playback.

KMAX can play:

- `.m3u8`
- `.mp4`
- `.m4v`

KMAX cannot directly play:

- magnet links
- torrent hashes
- `infoHash` results

## Important Safety Rule

Your Real-Debrid API token is private. Treat it like a password.

Do not paste it into:

- ChatGPT or Codex chat
- GitHub
- README files
- `public/providers.sample.json`

Use this file instead:

```text
public/providers.local.json
```

That file is ignored by git.

For local testing, KMAX can also read this value from `.env.local`:

```env
VITE_REAL_DEBRID_API_KEY=your_real_debrid_private_api_token
```

This works for testing, but it is not private once the app is built. Browser and APK builds can expose `VITE_` values. Later, use a backend or device-auth flow for safer releases.

## Steps

1. Open this page:

   ```text
   https://real-debrid.com/apitoken
   ```

2. Copy your API token.

3. Open this page:

   ```text
   https://torrentio.strem.fun/configure
   ```

4. Set `Debrid Provider` to `RealDebrid`.

5. Paste your Real-Debrid token into the API Key field.

6. Click `Copy Link`.

7. Open:

   ```text
   public/providers.local.json
   ```

8. Find this part:

   ```json
   "id": "my-stremio-addon"
   ```

9. Paste the full copied Torrentio link into `baseUrl`.

10. Make sure it says:

   ```json
   "enabled": true
   ```

11. Restart KMAX:

   ```bash
   npm run dev
   ```

## How To Check It

Run:

```bash
npm run check:config
```

You want to see:

```text
TMDB token: configured
my-stremio-addon: stremio, enabled
```

Then open a movie in KMAX and check Play Options.

If KMAX still says no playable streams, the addon is still not returning direct video links for that title.

## Resolver Mode

If Torrentio returns only `infoHash` results, KMAX can try to resolve cached Real-Debrid torrents itself when `VITE_REAL_DEBRID_API_KEY` is configured.

This does not guarantee every title works. It only works when Real-Debrid has the torrent cached and can return a playable direct link.
