import {
  type ExtendedRecordMap,
  type RecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import {
  getBlockCollectionId,
  getBlockValue,
  getPageContentBlockIds,
  mergeRecordMaps
} from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          }),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

// notion-client's own `getPage()` fetches collection data using whatever
// `collection_view` it has *before* that view's own data has been loaded —
// for grouped (list "Group by" / board) views, the group-by format isn't
// populated yet at that point, so it silently falls back to an ungrouped
// query and every group renders with a header but no items. By the time
// `getPage()` returns, `recordMap.collection_view` *does* have the full
// format, so we can detect any grouped view that only got the ungrouped
// fallback and re-query it correctly.
async function hydrateGroupedCollectionViews(
  recordMap: ExtendedRecordMap
): Promise<void> {
  const contentBlockIds = getPageContentBlockIds(recordMap)

  const collectionInstances = contentBlockIds.flatMap((blockId) => {
    const block = getBlockValue(recordMap.block[blockId])
    const collectionId =
      block &&
      (block.type === 'collection_view' ||
        block.type === 'collection_view_page') &&
      getBlockCollectionId(block, recordMap)

    if (!collectionId) return []

    return ((block as any).view_ids || []).map((collectionViewId: string) => ({
      collectionId,
      collectionViewId
    }))
  })

  await pMap(
    collectionInstances,
    async ({ collectionId, collectionViewId }) => {
      let view = recordMap.collection_view?.[collectionViewId]?.value
      // Some views come back from notion-client's own internal hydration
      // double-wrapped as { value: { value: <record>, role }, role } instead
      // of single-wrapped like every other recordMap entry — unwrap once
      // more if `.type` (present on every real view record) is missing but
      // there's a nested `.value` that has it.
      if (view && (view as any).type === undefined && (view as any).value) {
        view = (view as any).value
      }

      // For a collection_view block referenced only from deep inside a page
      // (e.g. a database embedded in a Projects-gallery card's own page),
      // notion-client's initial chunk fetch sometimes comes back with an
      // empty placeholder for the view (no `.value` at all) — and its own
      // internal getCollectionData retry doesn't return view data either,
      // so the placeholder never gets filled in. Fetch the view record
      // directly so we at least know its type/format.
      if (!view) {
        try {
          const res = await (notion as any).fetch({
            endpoint: 'getRecordValues',
            body: { requests: [{ table: 'collection_view', id: collectionViewId }] }
          })
          view = res?.results?.[0]?.value
          if (view) {
            recordMap.collection_view = {
              ...recordMap.collection_view,
              [collectionViewId]: { role: 'reader', value: view }
            }
          }
        } catch (err) {
          console.error('failed to fetch collection_view record', collectionViewId, err)
        }
      }
      if (!view) return

      const groupBy =
        (view as any).type === 'board'
          ? (view as any).format?.board_columns_by
          : (view as any).format?.collection_group_by

      const existingQuery =
        recordMap.collection_query?.[collectionId]?.[collectionViewId]
      const alreadyGrouped =
        existingQuery &&
        Object.keys(existingQuery).some(
          (key) => key !== 'collection_group_results'
        )
      // Even when there's no grouping to fix, a view resolved above via
      // getRecordValues still needs an actual query — the placeholder view
      // never had one either.
      if (groupBy && alreadyGrouped) return
      if (!groupBy && existingQuery) return

      try {
        const collectionData = await notion.getCollectionData(
          collectionId,
          collectionViewId,
          view
        )

        recordMap.block = { ...recordMap.block, ...collectionData.recordMap.block }
        recordMap.collection = {
          ...recordMap.collection,
          ...collectionData.recordMap.collection
        }
        recordMap.collection_view = {
          ...recordMap.collection_view,
          ...collectionData.recordMap.collection_view,
          // getCollectionData's response doesn't reliably echo back the
          // view record for deeply-nested views, so keep the one we
          // resolved above rather than let an empty merge erase it.
          [collectionViewId]: { role: 'reader', value: view }
        }
        recordMap.collection_query = {
          ...recordMap.collection_query,
          [collectionId]: {
            ...recordMap.collection_query?.[collectionId],
            [collectionViewId]: (collectionData as any).result?.reducerResults
          }
        }
      } catch (err) {
        console.error(
          'failed to hydrate grouped collection',
          collectionId,
          collectionViewId,
          err
        )
      }
    },
    { concurrency: 4 }
  )
}

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId)

  await hydrateGroupedCollectionViews(recordMap)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

// Notion's search endpoint returns recordMap.block entries double-wrapped —
// { value: { value: <realBlock>, role }, role } instead of the usual single
// wrap every other recordMap ({ value: <realBlock>, role }) uses (same class
// of bug as hydrateGroupedCollectionViews's collection_view records). React-
// notion-x's Search component reads block.type directly off entry.value to
// build result titles, so a wrong level unwraps to undefined and it silently
// drops every result — search box always looked empty. Search isn't one of
// react-notion-x's swappable components, so this has to be fixed in the data
// before it reaches the client.
function normalizeSearchRecordMapBlocks(recordMap: RecordMap): void {
  for (const id of Object.keys(recordMap.block || {})) {
    const entry = recordMap.block[id] as any
    if (entry?.value && entry.value.type === undefined && entry.value.value) {
      entry.value = entry.value.value
    }
  }
}

export async function search(params: SearchParams): Promise<SearchResults> {
  const results = await notion.search(params)
  normalizeSearchRecordMapBlocks(results.recordMap)
  return results
}
