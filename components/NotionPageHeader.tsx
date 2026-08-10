import type * as types from 'notion-types'
import cs from 'classnames'
import Link from 'next/link'
import * as React from 'react'
import { Search, useNotionContext } from 'react-notion-x'

import { isSearchEnabled, name, navigationLinks } from '@/lib/config'
import { notionLabCollectionId } from '@/lib/home-sections'
import { MoonIcon } from '@/lib/icons/moon'
import { SunIcon } from '@/lib/icons/sun'
import { useDarkMode } from '@/lib/use-dark-mode'

import styles from './styles.module.css'

function ToggleThemeButton() {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  const onToggleTheme = React.useCallback(() => {
    toggleDarkMode()
  }, [toggleDarkMode])

  return (
    <button
      type='button'
      aria-label='Toggle dark mode'
      className={cs(styles.iconButton, !hasMounted && styles.hidden)}
      onClick={onToggleTheme}
    >
      {hasMounted && isDarkMode ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function DuplicateButton({
  block
}: {
  block: types.CollectionViewPageBlock | types.PageBlock
}) {
  const isNotionLabArticle =
    (block as any).parent_table === 'collection' &&
    (block as any).parent_id === notionLabCollectionId

  if (!isNotionLabArticle) return null

  return (
    <a
      href={`https://www.notion.so/${block.id.replaceAll('-', '')}?duplicate=true`}
      target='_blank'
      rel='noopener noreferrer'
      className={styles.duplicateButton}
    >
      Duplicate
    </a>
  )
}

export function NotionPageHeader({
  block
}: {
  block: types.CollectionViewPageBlock | types.PageBlock
}) {
  const { components, mapPageUrl } = useNotionContext()

  return (
    <header className='notion-header'>
      <div className={styles.headerInner}>
        <Link href='/' className={styles.brand}>
          {name}
        </Link>

        <nav className={styles.navLinks}>
          {navigationLinks
            ?.map((link, index) => {
              if (!link?.pageId && !link?.url) {
                return null
              }

              if (link.pageId) {
                return (
                  <components.PageLink
                    href={mapPageUrl(link.pageId)}
                    key={index}
                    className={styles.navLink}
                  >
                    {link.title}
                  </components.PageLink>
                )
              } else {
                return (
                  <components.Link
                    href={link.url}
                    key={index}
                    className={styles.navLink}
                  >
                    {link.title}
                  </components.Link>
                )
              }
            })
            .filter(Boolean)}

          <DuplicateButton block={block} />

          <ToggleThemeButton />

          {isSearchEnabled && <Search block={block} title={null} />}
        </nav>
      </div>
    </header>
  )
}
