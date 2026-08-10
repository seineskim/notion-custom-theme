import cs from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import * as React from 'react'

import { homeSections, notionLabPath } from '@/lib/home-sections'
import { useActiveSection } from '@/lib/use-active-section'

import styles from './ScrollNav.module.css'

export function ScrollNav() {
  const router = useRouter()
  const isHome = router.pathname === '/'

  // scrollspy only makes sense on the home page, where the sections actually
  // live in the DOM to observe — elsewhere (e.g. /notion-lab) there's nothing
  // to watch, so skip it and fall back to plain route-based active state
  const activeSectionId = useActiveSection(isHome ? homeSections.map((s) => s.id) : [])

  const onSectionClick = (event: React.MouseEvent, id: string) => {
    if (!isHome) return // let the Link navigate to `/#id` normally
    event.preventDefault()
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav className={styles.nav}>
      {homeSections.map((section, index) => {
        const isActive = isHome && section.id === activeSectionId

        return (
          <Link
            key={section.id}
            href={isHome ? `#${section.id}` : `/#${section.id}`}
            className={cs(styles.item, isActive && styles.itemActive)}
            aria-current={isActive}
            onClick={(event) => onSectionClick(event, section.id)}
          >
            <span className={styles.index}>
              {String(index + 1).padStart(2, '0')}
            </span>
            {section.title}
          </Link>
        )
      })}

      <Link
        href={notionLabPath}
        className={cs(
          styles.item,
          router.pathname === notionLabPath && styles.itemActive
        )}
        aria-current={router.pathname === notionLabPath}
      >
        <span className={styles.index}>
          {String(homeSections.length + 1).padStart(2, '0')}
        </span>
        Notion Blog
      </Link>
    </nav>
  )
}
