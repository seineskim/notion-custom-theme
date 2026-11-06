import ExpiryMap from 'expiry-map'
import { getBlockValue, parsePageId } from 'notion-utils'
import pMemoize from 'p-memoize'

import { rootNotionPageId } from './config'
import { notion } from './notion-api'
import { isPublished } from './notion-collection'

// lib/notion-api.ts authenticates as a real logged-in user (token_v2), so
// getPage() can read *any* page that user can see — including private
// pages and pages that were deliberately moved out of the published tree
// (e.g. a partner-only pricing note). lib/acl.ts only checks the workspace,
// so without this a raw /<pageId> URL would render them publicly.
//
// Walks the page's parent chain (block → collection → block …) and only
// allows pages that actually live under site.rootNotionPageId. Database rows
// that aren't published (lib/notion-collection.ts's isPublished — 상태 ≠ 발행 완료
// or 외부공유 = 불가) are rejected along the way.
//
// Every level is memoized on its own, not just the final answer per page:
// all blog articles share the same chain above their row (hub collection →
// its database block → … → root), and walking it one sequential request per
// level took ~8s — most of a cold article render. With per-level caching
// only the article's own row (and anything not yet cached) is fetched.
const MAX_DEPTH = 30

// Short TTL so a page moved out of the blog, or a row flipped back from
// 발행 완료, stops rendering within a minute.
const TTL_MS = 60_000

const rootId = parsePageId(rootNotionPageId, { uuid: true })

const getRecord = pMemoize(
  async (table: 'block' | 'collection', id: string) => {
    const res: any = await notion.fetch({
      endpoint: 'syncRecordValuesMain',
      body: { requests: [{ pointer: { table, id }, version: -1 }] }
    })
    return getBlockValue(res?.recordMap?.[table]?.[id]) as any
  },
  {
    cache: new ExpiryMap(TTL_MS),
    cacheKey: ([table, id]) => `${table}:${id}`
  }
)

const isBlockInsideSite: (id: string, depth: number) => Promise<boolean> =
  pMemoize(
    async (id: string, depth: number): Promise<boolean> => {
      if (id === rootId) return true
      if (depth >= MAX_DEPTH) return false

      const value = await getRecord('block', id)
      if (!value || value.alive === false) return false

      if (value.parent_table === 'collection') {
        const collection = await getRecord('collection', value.parent_id)
        if (!collection) return false
        if (!isPublished(value, collection.schema)) return false

        // continue from the database block that owns this collection
        return isBlockInsideSite(collection.parent_id, depth + 1)
      }

      if (value.parent_table !== 'block') return false
      return isBlockInsideSite(value.parent_id, depth + 1)
    },
    {
      cache: new ExpiryMap(TTL_MS),
      // depth is only a cycle guard — the answer for a block doesn't
      // depend on how deep the walk that reached it started
      cacheKey: ([id]) => id
    }
  )

export async function isPageInsideSite(pageId: string): Promise<boolean> {
  const id = parsePageId(pageId, { uuid: true })
  return id ? isBlockInsideSite(id, 0) : false
}
