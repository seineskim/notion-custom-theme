import ExpiryMap from 'expiry-map'
import { getBlockCollectionId, getBlockTitle, getBlockValue } from 'notion-utils'
import pMemoize from 'p-memoize'

import { notionLabCollectionId, notionLabPageId } from './home-sections'
import { getPage } from './notion'
import { getCollectionViewRows } from './notion-collection'
import { makeNotionLabSlug } from './slug'

export interface NotionLabSlugEntry {
  id: string
  title: string
  slug: string
}

async function fetchNotionLabSlugEntriesUncached(): Promise<
  NotionLabSlugEntry[]
> {
  const recordMap = await getPage(notionLabPageId)

  let collectionViewBlock: any
  for (const entry of Object.values(recordMap.block)) {
    const value = getBlockValue(entry as any)
    if (
      value &&
      (value.type === 'collection_view' ||
        value.type === 'collection_view_page') &&
      getBlockCollectionId(value, recordMap) === notionLabCollectionId
    ) {
      collectionViewBlock = value
      break
    }
  }
  if (!collectionViewBlock) return []

  const rows = getCollectionViewRows(
    recordMap,
    notionLabCollectionId,
    collectionViewBlock.view_ids || []
  )

  return rows.map((row: any) => {
    const title = getBlockTitle(row, recordMap) || '(제목 없음)'
    return { id: row.id, title, slug: makeNotionLabSlug(title, row.id) }
  })
}

// Notion Blog article slugs are derived from live Notion data on every
// lookup (no separate sync step, see components/NotionLabFeed.tsx), so this
// is memoized briefly to avoid re-fetching + re-walking the whole database
// on every single page request that isn't a raw page id.
const getNotionLabSlugEntries = pMemoize(fetchNotionLabSlugEntriesUncached, {
  cache: new ExpiryMap(60_000)
})

export async function getNotionLabSlugMap(): Promise<Record<string, string>> {
  const entries = await getNotionLabSlugEntries()
  const map: Record<string, string> = {}
  for (const entry of entries) map[entry.slug] = entry.id
  return map
}

// Reverse of getNotionLabSlugMap — page id -> short slug. Used to redirect
// visitors landing on an article's old raw-id URL (shared/indexed before
// short slugs existed) to the canonical short-slug URL.
export async function getNotionLabIdToSlugMap(): Promise<
  Record<string, string>
> {
  const entries = await getNotionLabSlugEntries()
  const map: Record<string, string> = {}
  for (const entry of entries) map[entry.id] = entry.slug
  return map
}
