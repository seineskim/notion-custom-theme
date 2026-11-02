import ExpiryMap from 'expiry-map'
import { getBlockValue, parsePageId } from 'notion-utils'
import pMemoize from 'p-memoize'

import { rootNotionPageId } from './config'
import { notion } from './notion-api'
import { isExternallyShareable } from './notion-collection'

// lib/notion-api.ts authenticates as a real logged-in user (token_v2), so
// getPage() can read *any* page that user can see — including private
// pages and pages that were deliberately moved out of the published tree
// (e.g. a partner-only pricing note). lib/acl.ts only checks the workspace,
// so without this a raw /<pageId> URL would render them publicly.
//
// Walks the page's parent chain (block → collection → block …) and only
// allows pages that actually live under site.rootNotionPageId. Database rows
// marked 외부공유 = 불가 are rejected along the way.
const MAX_DEPTH = 30

async function getRecord(table: 'block' | 'collection', id: string) {
  const res: any = await notion.fetch({
    endpoint: 'syncRecordValuesMain',
    body: { requests: [{ pointer: { table, id }, version: -1 }] }
  })
  return getBlockValue(res?.recordMap?.[table]?.[id])
}

async function isPageInsideSiteUncached(pageId: string): Promise<boolean> {
  const rootId = parsePageId(rootNotionPageId, { uuid: true })
  let id = parsePageId(pageId, { uuid: true })
  let table: 'block' | 'collection' = 'block'

  for (let depth = 0; id && depth < MAX_DEPTH; depth++) {
    if (table === 'block' && id === rootId) return true

    const value: any = await getRecord(table, id)
    if (!value || value.alive === false) return false

    if (table === 'block' && value.parent_table === 'collection') {
      const collection: any = await getRecord('collection', value.parent_id)
      if (!collection) return false
      if (!isExternallyShareable(value, collection.schema)) return false

      // continue from the database block that owns this collection
      table = 'block'
      id = collection.parent_id
      continue
    }

    if (value.parent_table !== 'block') return false
    table = 'block'
    id = value.parent_id
  }

  return false
}

// Short TTL so a page moved out of the blog stops rendering within a minute.
export const isPageInsideSite = pMemoize(isPageInsideSiteUncached, {
  cache: new ExpiryMap(60_000)
})
