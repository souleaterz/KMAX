# KMAX Roadmap

KMAX is currently at Milestone 0: a working browser app, a Capacitor Android project, local storage, TMDB/fallback metadata, a modular provider layer, and a sample stream path.

## Milestone 1: Build Pipeline and App Foundation

- Add GitHub Actions for web validation and Android debug APK artifacts.
- Keep APK builds reproducible from a clean checkout.
- Add app versioning notes and release artifact naming.
- Add environment documentation for TMDB and provider config.
- Add basic smoke tests for provider behavior and local storage behavior.

## Milestone 2: Metadata and Browsing

- Expand TMDB rows: trending, now playing, top rated, TV airing today, genres, and collections.
- Add dedicated movie, TV, and genre pages with pagination.
- Add detail-page improvements: trailers, related titles, recommendations, content ratings, language, and network/studio data.
- Cache metadata responses where useful for Firestick performance.
- Improve fallback artwork and empty states.

## Milestone 3: Provider System

- Formalize provider config schema and validation.
- Support multiple configured providers at once.
- Add provider priority, source labels, quality sorting, and disabled providers.
- Add episode-specific matching for TV streams.
- Add clearer no-stream diagnostics without exposing private provider details.
- Keep all stream discovery limited to user-provided, legal, self-hosted, public-domain, or otherwise authorized sources.

## Milestone 4: Player

- Add resume prompt and seek-to-last-position behavior.
- Add subtitle track selection and default subtitle preference.
- Add quality/source switcher inside the player.
- Add player control overlay designed for D-pad navigation.
- Add failed-stream recovery: retry, next source, and return-to-source-picker.
- Improve progress save frequency and completion thresholds.

## Milestone 5: Firestick and Android TV UX

- Tune focus movement for horizontal rails, side navigation, detail pages, settings, and player controls.
- Add route-level focus restoration.
- Add overscan-safe spacing and lower-powered device performance passes.
- Add Android TV app icon/banner assets.
- Add remote-specific QA checklist.
- Test on actual Firestick hardware or emulator.

## Milestone 6: Product Polish

- Add loading skeletons per page type.
- Improve visual hierarchy for TV show seasons and episodes.
- Add profile-like local settings if needed.
- Add watchlist management actions.
- Add recently watched row with real progress percentage.
- Add responsive/mobile refinements.

## Milestone 7: Release Track

- Add signed release APK/AAB workflow.
- Store signing credentials in GitHub Actions secrets.
- Add changelog and release notes.
- Add tagged builds with uploaded artifacts.
- Add optional Play Store / sideload distribution steps.

## Current Next Priorities

1. GitHub Actions debug APK workflow.
2. Provider config schema and multiple-provider support.
3. Resume playback prompt and better progress UI.
4. TV focus restoration and rail navigation polish.
5. Android TV banner/icon assets.

## Collaboration Note

Explain setup steps slowly and assume beginner knowledge. Prefer exact file names, exact lines, and short plain-language explanations over shorthand.
