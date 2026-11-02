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
  viewIds: string[],
  { applyViewFilter = true }: { applyViewFilter?: boolean } = {}
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

  // The rows above come back unfiltered whichever view they came from (see
  // matchesViewFilter), so filter by the block's *first* view — the one the
  // page actually shows — even when that view is grouped and the rows had to
  // be borrowed from a later one.
  const viewFilter =
    applyViewFilter && viewIds[0]
      ? getViewRecord(recordMap, viewIds[0])?.query2?.filter
      : undefined

  const schema = getBlockValue(recordMap.collection?.[collectionId] as any)
    ?.schema

  return blockIds
    .map((id) => getBlockValue(recordMap.block[id]))
    .filter((row: any) => row && row.alive !== false)
    .filter((row: any) => matchesViewFilter(row, viewFilter))
    .filter((row: any) => isPublished(row, schema))
}

function getViewRecord(recordMap: ExtendedRecordMap, viewId: string): any {
  let view: any = (recordMap.collection_view as any)?.[viewId]?.value
  // see lib/notion.ts — some views come back double-wrapped
  if (view && view.type === undefined && view.value) view = view.value
  return view
}

// notion-client's collection query ignores a view's query2.filter (the form
// Notion's newer filter UI and API write), so a linked view filtered to one
// slice of the 콘텐츠 허브 — e.g. the POC 자료실 page's view, or the
// /notion-blog view that leaves those POC rows out — still comes back with
// every row. Re-apply the filter here. Covers the select/status/checkbox/
// emptiness operators these views use; anything else is treated as a match
// rather than risk hiding rows that should show.
function matchesViewFilter(row: any, filter: any): boolean {
  if (!filter) return true

  if (Array.isArray(filter.filters)) {
    const results = filter.filters.map((child: any) =>
      matchesViewFilter(row, child)
    )
    if (!results.length) return true
    return filter.operator === 'or'
      ? results.some(Boolean)
      : results.every(Boolean)
  }

  const operator = filter.filter?.operator
  const expected = filter.filter?.value?.value
  const raw = row.properties?.[filter.property]
  const value = raw?.[0]?.[0]
  const isEmpty = !raw || !value

  switch (operator) {
    case 'is_empty':
      return isEmpty
    case 'is_not_empty':
      return !isEmpty
    case 'enum_is':
    case 'status_is':
      return value === expected
    case 'enum_is_not':
    case 'status_is_not':
      return value !== expected
    case 'enum_contains':
      return String(value ?? '')
        .split(',')
        .includes(expected)
    case 'checkbox_is':
      return (value === 'Yes') === Boolean(expected)
    default:
      return true
  }
}

// Whether a database row may appear on the site. In the 콘텐츠 허브 the
// owner drafts in Notion and publishes by flipping 상태 to 발행 완료, so a
// collection whose schema has that status option only shows rows set to it;
// 외부공유 = 불가 additionally blocks a row regardless of status. Collections
// without these properties are unaffected. Takes the collection schema
// directly so it works both with a full recordMap and with a bare
// collection record (lib/page-ancestry.ts).
const PUBLISHED_STATUS = '발행 완료'

export function isPublished(row: any, schema: any): boolean {
  if (!row || !schema) return true
  for (const [propertyId, property] of Object.entries<any>(schema)) {
    const value = row.properties?.[propertyId]?.[0]?.[0]
    if (property?.name === '외부공유' && value === '불가') return false
    if (
      property?.name === '상태' &&
      hasOption(property, PUBLISHED_STATUS) &&
      value !== PUBLISHED_STATUS
    ) {
      return false
    }
  }
  return true
}

function hasOption(property: any, name: string): boolean {
  return [
    ...(property.options || []),
    ...(property.groups || []).flatMap((group: any) => group.options || [])
  ].some((option: any) => option?.value === name || option?.name === name)
}

// The feed already filters those rows out when rendering, but the raw
// recordMap is serialized into the page's __NEXT_DATA__ as-is — strip them
// from it too so their titles/properties never reach the browser.
export function removeUnpublishedRows(
  recordMap: ExtendedRecordMap
): ExtendedRecordMap {
  for (const [blockId, entry] of Object.entries(recordMap.block)) {
    const row: any = getBlockValue(entry as any)
    if (row?.parent_table !== 'collection') continue
    const schema = getBlockValue(recordMap.collection?.[row.parent_id] as any)
      ?.schema
    if (!isPublished(row, schema)) delete recordMap.block[blockId]
  }
  return recordMap
}

// Workflow-only properties of the 콘텐츠 허브 (review status, who edited it,
// sharing flags, a duplicate created-time column). Notion's newer page
// layout can hide these, but react-notion-x only honors the older
// collection.format.property_visibility — so mark them hidden there, and
// blank their values so they don't ship in __NEXT_DATA__ either. 상태 and
// 외부공유 keep their values: the client-side feed re-runs isPublished on
// them, and every row still present has already passed it.
const INTERNAL_PROPERTY_NAMES = new Set([
  '상태',
  '외부공유',
  '추천 여부',
  'Created by',
  'Last edited by',
  'Created time 1'
])
const KEPT_VALUE_NAMES = new Set(['상태', '외부공유'])

export function hideInternalProperties(
  recordMap: ExtendedRecordMap
): ExtendedRecordMap {
  const hiddenByCollection = new Map<string, string[]>()

  for (const [collectionId, entry] of Object.entries(
    recordMap.collection || {}
  )) {
    const collection: any = getBlockValue(entry as any)
    if (!collection?.schema) continue

    const hidden = Object.entries<any>(collection.schema)
      .filter(([, property]) => INTERNAL_PROPERTY_NAMES.has(property?.name))
      .map(([propertyId]) => propertyId)
    if (!hidden.length) continue

    hiddenByCollection.set(collectionId, hidden)
    collection.format = collection.format || {}
    collection.format.property_visibility = [
      ...(collection.format.property_visibility || []).filter(
        ({ property }: any) => !hidden.includes(property)
      ),
      ...hidden.map((property) => ({ property, visibility: 'hide' }))
    ]
  }

  for (const entry of Object.values(recordMap.block)) {
    const row: any = getBlockValue(entry as any)
    const hidden = hiddenByCollection.get(row?.parent_id)
    if (!hidden || !row.properties) continue
    const schema = getBlockValue(recordMap.collection?.[row.parent_id] as any)
      ?.schema
    for (const propertyId of hidden) {
      if (KEPT_VALUE_NAMES.has(schema?.[propertyId]?.name)) continue
      delete row.properties[propertyId]
    }
  }

  return recordMap
}
