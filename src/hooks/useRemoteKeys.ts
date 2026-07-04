import { useEffect } from 'react'

const verticalKeys = new Set(['ArrowUp', 'ArrowDown'])
const horizontalKeys = new Set(['ArrowLeft', 'ArrowRight'])

function focusable() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-focusable="true"]:not([disabled])')).filter(
    (node) => node.offsetParent !== null,
  )
}

export function useRemoteKeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null
        active?.click()
        return
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        history.back()
        return
      }
      if (!verticalKeys.has(event.key) && !horizontalKeys.has(event.key)) return
      if (event.defaultPrevented) return
      const nodes = focusable()
      const active = document.activeElement as HTMLElement | null
      event.preventDefault()
      if (!active || !nodes.includes(active)) {
        nodes[0]?.focus()
        return
      }
      const rect = active.getBoundingClientRect()
      const candidates = nodes
        .filter((node) => node !== active)
        .map((node) => ({ node, rect: node.getBoundingClientRect() }))
        .filter(({ rect: other }) => {
          if (event.key === 'ArrowRight') return other.left > rect.left
          if (event.key === 'ArrowLeft') return other.right < rect.right
          if (event.key === 'ArrowDown') return other.top > rect.top
          return other.bottom < rect.bottom
        })
        .map(({ node, rect: other }) => ({
          node,
          score:
            Math.abs((other.left + other.right) / 2 - (rect.left + rect.right) / 2) +
            Math.abs((other.top + other.bottom) / 2 - (rect.top + rect.bottom) / 2) * 1.8,
        }))
        .sort((a, b) => a.score - b.score)
      candidates[0]?.node.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
