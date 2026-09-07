import { type ExtendedRecordMap } from 'notion-types'
import { getBlockValue } from 'notion-utils'

// Resolves a collection view's actual row blocks, trying each of its
// view_ids in turn. A *grouped* view's query only ever resolves to its group
// labels (`table_groups`), never flat row ids (see lib/notion.ts's
// hydrateGroupedCollectionViews) — so this falls through to another view
// rather than come up empty if the first/default view happens to be
// grouped.
//
// Deliberately kept dependency-light (notion-types/notion-utils only, no
// Notion API client, no redis): components/NotionLabFeed.tsx — a component
// Next.js bundles for the browser too, not just the server — needs this
// same logic, and importing anything from lib/notion.ts there would pull
// its whole server-only dependency graph (ioredis et al.) into the client
// bundle and break the build.
export function getCollectionViewRows(
  recordMap: ExtendedRecordMap,
  collectionId: string,
  viewIds: string[]
): any[] {
  let blockIds: string[] = []
  for (const viewId of viewIds) {
    const result = (recordMap.collection_query as any)?.[collectionId]?.[
      viewId
    ]?.collection_group_results
    if (result?.blockIds?.length) {
      blockIds = result.blockIds
      break
    }
  }

  return blockIds
    .map((id) => getBlockValue(recordMap.block[id]))
    .filter((row: any) => row && row.alive !== false)
}
