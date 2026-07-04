# KMAX Project Notes

- Explain steps simply and assume the user is new to web apps, APK builds, environment files, JSON, TMDB, and provider setup.
- Avoid skipping setup details. Say exactly which file to open, what line to change, and whether the dev server needs restarting.
- Keep source/provider setup limited to user-provided, legal, self-hosted, public-domain, or otherwise authorized sources.
- For Stremio/Torrentio-style providers, remember that KMAX can only play direct HLS/MP4 URLs in the built-in player. Raw torrent/magnet results need a compatible direct-stream/debrid setup or another supported playback bridge.
- When APK behavior is updated, create and push a new git tag starting with `v` so GitHub Actions can produce a traceable APK build artifact.
