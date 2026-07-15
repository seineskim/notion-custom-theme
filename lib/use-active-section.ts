import * as React from 'react'

// Tracks which of the given section ids is currently "active" for scrollspy
// nav highlighting. Watches a horizontal band near the top of the viewport
// (via IntersectionObserver's rootMargin) rather than the whole viewport, so
// the active section flips right as it reaches reading position.
export function useActiveSection(ids: string[]): string | undefined {
  const [activeId, setActiveId] = React.useState<string | undefined>(ids[0])

  React.useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)

    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (!visible.length) return

        // Among sections currently crossing the reading band, the one
        // furthest down the page (largest/least-negative top) is the one
        // the reader has scrolled to most recently — e.g. while a tall
        // "about" section still covers the band, "experience" should take
        // over the moment its top enters it.
        const current = visible.reduce((a, b) =>
          a.boundingClientRect.top >= b.boundingClientRect.top ? a : b
        )
        setActiveId(current.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: [0, 1] }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  return activeId
}
