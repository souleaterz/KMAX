import { useEffect, useState } from 'react'
import { getProgress, getSettings, getWatchlist } from '../services/storage'

function useLocalSnapshot<T>(read: () => T) {
  const [value, setValue] = useState(read)
  useEffect(() => {
    function update() {
      setValue(read())
    }
    window.addEventListener('kmax-storage', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('kmax-storage', update)
      window.removeEventListener('storage', update)
    }
  }, [read])
  return value
}

function readWatchlist() {
  return getWatchlist()
}

function readProgress() {
  return getProgress()
}

function readSettings() {
  return getSettings()
}

export function useWatchlist() {
  return useLocalSnapshot(readWatchlist)
}

export function useProgress() {
  return useLocalSnapshot(readProgress)
}

export function useSettings() {
  return useLocalSnapshot(readSettings)
}
