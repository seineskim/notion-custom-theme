import { type ExtendedRecordMap } from 'notion-types'
import * as React from 'react'
import { NotionRenderer } from 'react-notion-x'

import { homeSections } from '@/lib/home-sections'
import { mapImageUrl } from '@/lib/map-image-url'
import { notionRendererComponents } from '@/lib/notion-components'
import { useDarkMode } from '@/lib/use-dark-mode'

import styles from './HomeSections.module.css'

export function HomeSections({
  sectionRecordMaps
}: {
  sectionRecordMaps: Record<string, ExtendedRecordMap>
}) {
  const { isDarkMode } = useDarkMode()

  return (
    <div className={styles.sections}>
      {homeSections.map((section) => {
        const recordMap = sectionRecordMaps[section.id]
        if (!recordMap) return null

        return (
          <section key={section.id} id={section.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <NotionRenderer
              recordMap={recordMap}
              components={notionRendererComponents}
              fullPage={false}
              darkMode={isDarkMode}
              previewImages={!!recordMap.preview_images}
              showCollectionViewDropdown={false}
              mapImageUrl={mapImageUrl}
            />
          </section>
        )
      })}
    </div>
  )
}
