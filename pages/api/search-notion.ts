import { type NextApiRequest, type NextApiResponse } from 'next'
import pMap from 'p-map'

import type * as types from '../../lib/types'
import { rootNotionPageId } from '../../lib/config'
import { search } from '../../lib/notion'
import { isPageInsideSite } from '../../lib/page-ancestry'

// This endpoint searches with the site owner's own Notion session
// (lib/notion-api.ts), so it must never let the caller choose what to
// search: a client-supplied ancestorId used to make any page in the
// workspace searchable — private pages included — and drafts under the blog
// (상태 ≠ 발행 완료) showed up in results with body-text highlights. Only the
// query and limit are taken from the request; the scope is always the site
// root, and every result is re-checked with the same rule that guards page
// URLs (lib/page-ancestry.ts) before it's returned.
export default async function searchNotion(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).send({ error: 'method not allowed' })
  }

  const body = (req.body || {}) as Partial<types.SearchParams>
  const query = typeof body.query === 'string' ? body.query.slice(0, 200) : ''
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50)

  const results = await search({
    ancestorId: rootNotionPageId,
    query,
    limit
  })

  const allowed = new Set<string>()
  await pMap(
    results.results,
    async (result) => {
      if (await isPageInsideSite(result.id)) allowed.add(result.id)
    },
    { concurrency: 4 }
  )

  for (const result of results.results) {
    if (!allowed.has(result.id)) delete results.recordMap.block?.[result.id]
  }
  const filtered: types.SearchResults = {
    ...results,
    results: results.results.filter((result) => allowed.has(result.id)),
    total: allowed.size
  }

  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, max-age=60, stale-while-revalidate=60'
  )
  res.status(200).json(filtered)
}
