import ExpiryMap from 'expiry-map'
import { type ExtendedRecordMap } from 'notion-types'
import {
  getBlockCollectionId,
  getBlockTitle,
  getBlockValue,
  parsePageId
} from 'notion-utils'
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

// Safety cap on how many nested subpages collectNestedPageEntries will walk
// (see below) — bounds both the Notion API traffic and how long a cold
// lookup can take if the tree ever turns out much bigger than expected.
const MAX_NESTED_PAGES = 200

// Not every published article is a row of the 콘텐츠 허브 database — some
// live as plain Notion subpages nested under the Notion Blog page itself
// (parent_table "block", not "collection"), at arbitrary depth (a subpage
// of a subpage, etc.), so they never show up in getCollectionViewRows.
// Walks the whole subtree via each page block's own `content` array,
// fetching a subpage's own recordMap only when it needs to see further
// inside it (its immediate parent's recordMap already has its block entry,
// but not necessarily its own children).
async function collectNestedPageEntries(
  rootRecordMap: ExtendedRecordMap,
  rootDashedId: string,
  excludeIds: Set<string>
): Promise<NotionLabSlugEntry[]> {
  const results: NotionLabSlugEntry[] = []
  const visited = new Set<string>([rootDashedId])
  const queue: Array<{ id: string; recordMap: ExtendedRecordMap }> = [
    { id: rootDashedId, recordMap: rootRecordMap }
  ]

  while (queue.length && visited.size < MAX_NESTED_PAGES) {
    const { id, recordMap } = queue.shift()!
    const block = getBlockValue(recordMap.block[id] as any)
    if (!block) continue

    for (const childId of block.content || []) {
      if (visited.has(childId)) continue
      visited.add(childId)

      const child = getBlockValue(recordMap.block[childId] as any)
      if (!child || child.type !== 'page' || child.alive === false) continue

      if (!excludeIds.has(child.id)) {
        const title = getBlockTitle(child, recordMap) || '(제목 없음)'
        results.push({
          id: child.id,
          title,
          slug: makeNotionLabSlug(title, child.id)
        })
      }

      try {
        const childRecordMap = await getPage(childId)
        queue.push({ id: childId, recordMap: childRecordMap })
      } catch (err) {
        console.error('failed to fetch nested notion lab subpage', childId, err)
      }
    }
  }

  return results
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

  const rows = collectionViewBlock
    ? getCollectionViewRows(
        recordMap,
        notionLabCollectionId,
        collectionViewBlock.view_ids || []
      )
    : []

  const entries = rows.map((row: any) => {
    const title = getBlockTitle(row, recordMap) || '(제목 없음)'
    return { id: row.id, title, slug: makeNotionLabSlug(title, row.id) }
  })

  // recordMap.block is keyed by dashed ids — notionLabPageId (lib/home-sections.ts)
  // is stored dash-less, which getPage() above accepts fine for fetching but
  // doesn't match this object's keys, so it has to be normalized first.
  const notionLabPageDashedId = parsePageId(notionLabPageId, { uuid: true })!
  const seenIds = new Set(entries.map((entry) => entry.id))
  const nestedEntries = await collectNestedPageEntries(
    recordMap,
    notionLabPageDashedId,
    seenIds
  )

  return [...entries, ...nestedEntries]
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
