import {
  type ExtendedRecordMap,
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
      const view = recordMap.collection_view?.[collectionViewId]?.value
      if (!view) return

      const groupBy =
        (view as any).type === 'board'
          ? (view as any).format?.board_columns_by
          : (view as any).format?.collection_group_by
      if (!groupBy) return

      const existingQuery =
        recordMap.collection_query?.[collectionId]?.[collectionViewId]
      const alreadyGrouped =
        existingQuery &&
        Object.keys(existingQuery).some(
          (key) => key !== 'collection_group_results'
        )
      if (alreadyGrouped) return

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
          ...collectionData.recordMap.collection_view
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

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}
