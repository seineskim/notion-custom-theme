import ExpiryMap from 'expiry-map'
import { type ExtendedRecordMap } from 'notion-types'
import {
  getBlockCollectionId,
  getBlockTitle,
  getBlockValue,
  parsePageId
} from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import { notionLabCollectionId, notionLabPageId } from './home-sections'
import { getPage } from './notion'
import { notion } from './notion-api'
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
//
// Uses the raw notion-client fetch directly (not lib/notion.ts's getPage)
// with the same "just enough to walk the tree" options
// lib/notion.ts's getNavigationLinkPages() already uses: no collection
// hydration, no missing-block backfill, no file-URL signing. The first
// version of this used the full getPage() per subpage and took 15+ seconds
// cold — nearly all of it collection/image work this walk never needed.
async function collectNestedPageEntries(
  rootRecordMap: ExtendedRecordMap,
  rootDashedId: string,
  excludeIds: Set<string>
): Promise<NotionLabSlugEntry[]> {
  const results: NotionLabSlugEntry[] = []
  const visited = new Set<string>([rootDashedId])
  let currentLevel: Array<{ id: string; recordMap: ExtendedRecordMap }> = [
    { id: rootDashedId, recordMap: rootRecordMap }
  ]

  // Breadth-first, one level at a time, fetching every subpage discovered
  // in that level *in parallel* (concurrency 4, matching the pattern
  // lib/notion.ts already uses for collection hydration) — a sequential
  // await per subpage was the actual cause of a multi-second slowdown on
  // every page load once the tree grew past a handful of subpages.
  while (currentLevel.length && visited.size < MAX_NESTED_PAGES) {
    const childIdsToFetch: string[] = []

    for (const { id, recordMap } of currentLevel) {
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

        childIdsToFetch.push(childId)
      }
    }

    if (!childIdsToFetch.length) break

    const fetched = await pMap(
      childIdsToFetch,
      async (childId) => {
        try {
          const childRecordMap = await notion.getPage(childId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          })
          return { id: childId, recordMap: childRecordMap }
        } catch (err) {
          console.error('failed to fetch nested notion lab subpage', childId, err)
          return null
        }
      },
      { concurrency: 6 }
    )

    currentLevel = fetched.filter(
      (entry): entry is { id: string; recordMap: ExtendedRecordMap } =>
        entry !== null
    )
  }

  return results
}

async function fetchNotionLabRowEntriesUncached(): Promise<{
  recordMap: ExtendedRecordMap
  entries: NotionLabSlugEntry[]
}> {
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

  return { recordMap, entries }
}

// The 콘텐츠 허브 database rows — one getPage() call (plus its own
// collection hydration), same cost this always had before the nested-subpage
// walk existed. Kept as its own memoized step so a slow nested walk (below)
// can never hold this back.
const getNotionLabRowEntries = pMemoize(fetchNotionLabRowEntriesUncached, {
  cache: new ExpiryMap(600_000)
})

async function fetchNotionLabNestedEntriesUncached(): Promise<
  NotionLabSlugEntry[]
> {
  const { recordMap, entries } = await getNotionLabRowEntries()

  // recordMap.block is keyed by dashed ids — notionLabPageId (lib/home-sections.ts)
  // is stored dash-less, which getPage() above accepts fine for fetching but
  // doesn't match this object's keys, so it has to be normalized first.
  const notionLabPageDashedId = parsePageId(notionLabPageId, { uuid: true })!
  const seenIds = new Set(entries.map((entry) => entry.id))

  return collectNestedPageEntries(recordMap, notionLabPageDashedId, seenIds)
}

// Deliberately separate from getNotionLabRowEntries: walking the nested
// subpage tree costs one Notion API round-trip per subpage (even at
// concurrency 6, a tree with a few dozen subpages took 10+ seconds cold —
// unacceptable to make every page load wait on). getNotionLabSlugEntries
// below bounds how long it'll wait for this with a timeout and falls back
// to just the row entries; this promise keeps running regardless, so once
// it resolves the *next* lookup (within the cache TTL) gets the full set
// instantly.
const getNotionLabNestedEntries = pMemoize(
  fetchNotionLabNestedEntriesUncached,
  { cache: new ExpiryMap(600_000) }
)

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

async function getNotionLabSlugEntries(): Promise<NotionLabSlugEntry[]> {
  const { entries: rowEntries } = await getNotionLabRowEntries()
  const nestedEntries = await withTimeout(
    getNotionLabNestedEntries(),
    1500,
    [] as NotionLabSlugEntry[]
  )
  return [...rowEntries, ...nestedEntries]
}

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
