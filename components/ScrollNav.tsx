import cs from 'classnames'
import * as React from 'react'

import { homeSections } from '@/lib/home-sections'
import { useActiveSection } from '@/lib/use-active-section'

import styles from './ScrollNav.module.css'

export function ScrollNav() {
  const activeId = useActiveSection(homeSections.map((s) => s.id))

  const onClick = (event: React.MouseEvent, id: string) => {
    event.preventDefault()
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav className={styles.nav}>
      {homeSections.map((section, index) => {
        const isActive = section.id === activeId

        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cs(styles.item, isActive && styles.itemActive)}
            aria-current={isActive}
            onClick={(event) => onClick(event, section.id)}
          >
            <span className={styles.index}>
              {String(index + 1).padStart(2, '0')}
            </span>
            {section.title}
          </a>
        )
      })}
    </nav>
  )
}
