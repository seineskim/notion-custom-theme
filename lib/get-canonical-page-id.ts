import { type ExtendedRecordMap } from 'notion-types'
import {
  getCanonicalPageId as getCanonicalPageIdImpl,
  parsePageId
} from 'notion-utils'

import { inversePageUrlOverrides } from './config'

export function getCanonicalPageId(
  pageId: string,
  recordMap: ExtendedRecordMap,
  {
    uuid = true,
    notionLabIdToSlugMap
  }: { uuid?: boolean; notionLabIdToSlugMap?: Record<string, string> } = {}
): string | undefined {
  const cleanPageId = parsePageId(pageId, { uuid: false })
  if (!cleanPageId) {
    return
  }

  // Notion Blog article short slugs (lib/notion-lab.ts) take priority over
  // everything else — checked first so every link-generating path (inline
  // page-link mentions, search results, canonical/og tags, the article's
  // own page, the feed list) agrees on the same short URL for these pages,
  // not just the feed list that originally called makeNotionLabSlug. The
  // map's keys are dashed ids (straight from Notion's API, same format
  // pages/[pageId].tsx's redirect uses) — cleanPageId above is dash-less,
  // so look this up separately rather than reusing it.
  const dashedPageId = parsePageId(pageId, { uuid: true })
  const notionLabSlug = dashedPageId && notionLabIdToSlugMap?.[dashedPageId]
  if (notionLabSlug) {
    return notionLabSlug
  }

  const override = inversePageUrlOverrides[cleanPageId]
  if (override) {
    return override
  } else {
    return (
      getCanonicalPageIdImpl(pageId, recordMap, {
        uuid
      }) ?? undefined
    )
  }
}
