import {
  getBlockCollectionId,
  getBlockTitle,
  getBlockValue,
  getPageProperty
} from 'notion-utils'
import * as React from 'react'

import styles from './NotionLabFeed.module.css'

// Fixed display order for the Notion Lab 콘텐츠 허브's "콘텐츠 유형" categories —
// matches the select options on the underlying Notion database exactly, so a
// new category added there needs to be added here too.
const CONTENT_TYPE_ORDER = [
  '가이드',
  '사례/예시',
  '업데이트/뉴스',
  '큐레이션',
  '템플릿',
  '활용 팁',
  'No 콘텐츠 유형'
]

interface FeedItem {
  id: string
  title: string
  type: string
  externalUrl: string | null
}

// Renders the "Notion Lab 콘텐츠 허브" database as a grouped list matching the
// site's own design language, instead of react-notion-x's default table/
// gallery UI (which looks like a raw spreadsheet and, embedded this deep
// inside a page, can't reliably render Notion's own grouped view — see
// lib/notion.ts's hydrateGroupedCollectionViews). Reads rows directly out of
// the recordMap already fetched for the page, so no extra requests.
export function NotionLabFeed({ block, ctx }: any) {
  const { recordMap } = ctx

  const items = React.useMemo<FeedItem[]>(() => {
    const collectionId = getBlockCollectionId(block, recordMap)
    const viewIds: string[] = block?.view_ids || []
    if (!collectionId || !viewIds.length) return []

    // Don't assume view_ids[0] is a flat, usable result — a *grouped* view's
    // query only ever resolves to its group labels (`table_groups`), never
    // actual row ids (see lib/notion.ts's hydrateGroupedCollectionViews), so
    // if the database's first/default view happens to be grouped this needs
    // to fall through to another view rather than come up empty.
    let blockIds: string[] = []
    for (const viewId of viewIds) {
      const result =
        recordMap.collection_query?.[collectionId]?.[viewId]
          ?.collection_group_results
      if (result?.blockIds?.length) {
        blockIds = result.blockIds
        break
      }
    }

    return blockIds
      .map((id) => getBlockValue(recordMap.block[id]))
      .filter((row: any) => row && row.alive !== false)
      .map((row: any) => ({
        id: row.id,
        title: getBlockTitle(row, recordMap) || '(제목 없음)',
        type:
          (getPageProperty<string>('콘텐츠 유형', row, recordMap) as string) ||
          'No 콘텐츠 유형',
        externalUrl:
          (getPageProperty<string>('URL', row, recordMap) as string) || null
      }))
  }, [block, recordMap])

  const groups = React.useMemo(() => {
    const byType = new Map<string, FeedItem[]>()
    for (const item of items) {
      const key = CONTENT_TYPE_ORDER.includes(item.type)
        ? item.type
        : 'No 콘텐츠 유형'
      if (!byType.has(key)) byType.set(key, [])
      byType.get(key)!.push(item)
    }
    return CONTENT_TYPE_ORDER.map((type) => ({
      type,
      items: byType.get(type) || []
    })).filter((group) => group.items.length > 0)
  }, [items])

  if (!items.length) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[NotionLabFeed] no rows resolved — collectionId:',
        getBlockCollectionId(block, recordMap),
        'view_ids:',
        block?.view_ids,
        'collection_query keys:',
        Object.keys(recordMap.collection_query || {})
      )
    }
    return null
  }

  return (
    <div className={styles.feed}>
      {groups.map((group) => (
        <section key={group.type} className={styles.group}>
          <h3 className={styles.groupTitle}>
            {group.type}
            <span className={styles.groupCount}>{group.items.length}</span>
          </h3>

          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <a
                  // The site's title-based slug URLs (mapPageUrl) only
                  // resolve for pages the sitemap crawler actually walks —
                  // it doesn't reach into rows of a database nested this
                  // deep inside a page, so those 404. Linking with the raw
                  // page id instead skips slug/sitemap lookup entirely:
                  // resolveNotionPage recognizes a valid id immediately.
                  href={item.externalUrl || `/${item.id}`}
                  target={item.externalUrl ? '_blank' : undefined}
                  rel={item.externalUrl ? 'noopener noreferrer' : undefined}
                  className={styles.itemLink}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
