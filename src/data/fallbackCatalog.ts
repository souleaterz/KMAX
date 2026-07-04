import type { MediaDetail, MediaItem } from '../types'

export const fallbackCatalog: MediaDetail[] = [
  {
    id: 11,
    imdbId: 'tt0063350',
    mediaType: 'movie',
    title: 'Night of the Living Dead',
    overview:
      'A group of strangers barricade themselves in a farmhouse as the dead begin returning to life outside.',
    posterPath: null,
    backdropPath: null,
    rating: 7.6,
    year: '1968',
    runtime: 96,
    genres: ['Horror', 'Classic'],
    cast: ['Duane Jones', "Judith O'Dea", 'Karl Hardman'],
  },
  {
    id: 12,
    imdbId: 'tt0017925',
    mediaType: 'movie',
    title: 'The General',
    overview:
      'A railroad engineer fights to recover his locomotive and rescue the woman he loves during the Civil War.',
    posterPath: null,
    backdropPath: null,
    rating: 8.1,
    year: '1926',
    runtime: 79,
    genres: ['Action', 'Comedy'],
    cast: ['Buster Keaton', 'Marion Mack'],
  },
  {
    id: 13,
    imdbId: 'tt0032599',
    mediaType: 'movie',
    title: 'His Girl Friday',
    overview:
      'A newspaper editor tries to keep his star reporter and ex-wife from leaving the newsroom for good.',
    posterPath: null,
    backdropPath: null,
    rating: 7.8,
    year: '1940',
    runtime: 92,
    genres: ['Comedy', 'Drama'],
    cast: ['Cary Grant', 'Rosalind Russell'],
  },
  {
    id: 901,
    mediaType: 'tv',
    title: 'Public Domain Theater',
    overview:
      'A rotating collection of legally available classic serials and archive episodes configured for KMAX.',
    posterPath: null,
    backdropPath: null,
    rating: 7.2,
    year: '1950',
    genres: ['Classic', 'TV'],
    cast: ['Archive Collection'],
    seasons: [
      {
        seasonNumber: 1,
        title: 'Season 1',
        episodes: [
          {
            id: 90101,
            season: 1,
            episode: 1,
            title: 'Archive Feature',
            overview: 'A sample episode entry for provider testing.',
            runtime: 20,
          },
        ],
      },
    ],
  },
]

export const fallbackRows: { title: string; items: MediaItem[] }[] = [
  { title: 'Featured Classics', items: fallbackCatalog },
  { title: 'Popular Movies', items: fallbackCatalog.filter((item) => item.mediaType === 'movie') },
  { title: 'Popular TV', items: fallbackCatalog.filter((item) => item.mediaType === 'tv') },
  { title: 'Late Night Horror', items: fallbackCatalog.filter((item) => item.genres?.includes('Horror')) },
]
