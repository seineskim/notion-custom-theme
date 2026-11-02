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
// 콘텐츠 허브 rows marked 외부공유 = 불가 must never be published (they're
// kept in the database for internal use only). Takes the collection schema
// directly so it works both with a full recordMap and with a bare
// collection record (lib/page-ancestry.ts).
export function isExternallyShareable(row: any, schema: any): boolean {
  if (!row || !schema) return true
  for (const [propertyId, property] of Object.entries<any>(schema)) {
    if (property?.name !== '외부공유') continue
    const value = row.properties?.[propertyId]?.[0]?.[0]
    return value !== '불가'
  }
  return true
}

// The feed already filters those rows out when rendering, but the raw
// recordMap is serialized into the page's __NEXT_DATA__ as-is — strip them
// from it too so their titles/properties never reach the browser.
export function removeUnshareableRows(
  recordMap: ExtendedRecordMap
): ExtendedRecordMap {
  for (const [blockId, entry] of Object.entries(recordMap.block)) {
    const row: any = getBlockValue(entry as any)
    if (row?.parent_table !== 'collection') continue
    const schema = getBlockValue(recordMap.collection?.[row.parent_id] as any)
      ?.schema
    if (!isExternallyShareable(row, schema)) delete recordMap.block[blockId]
  }
  return recordMap
}

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

  const schema = getBlockValue(recordMap.collection?.[collectionId] as any)
    ?.schema

  return blockIds
    .map((id) => getBlockValue(recordMap.block[id]))
    .filter((row: any) => row && row.alive !== false)
    .filter((row: any) => isExternallyShareable(row, schema))
}
