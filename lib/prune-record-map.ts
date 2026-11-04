import { type ExtendedRecordMap } from 'notion-types'
import { getBlockValue, parsePageId } from 'notion-utils'

// notion-client's getPage() backfills every block id it sees in a `content`
// array — including the content arrays of database rows. A page that shows
// the 콘텐츠 허브 (/notion-blog, the POC 자료실 page) therefore came back with
// the opening blocks of all ~90 articles in the database: ~1.4MB of a 1.8MB
// page payload, none of which the page renders (the feed only needs each
// row's title and properties), and every image among them was also sent to
// preview-image generation.
//
// Keep only what the page itself can render: its own block tree (stopping
// at child pages — they render as links, not inline), synced blocks it
// references, and every page/collection-row block (needed for titles in
// lists, mentions and links). Drop the rest.
export function pruneUnreachableBlocks(
  recordMap: ExtendedRecordMap,
  pageId: string
): ExtendedRecordMap {
  const rootId = parsePageId(pageId, { uuid: true })
  if (!rootId || !recordMap.block[rootId]) return recordMap

  const keep = new Set<string>()
  const stack = [rootId]

  while (stack.length) {
    const id = stack.pop()!
    if (keep.has(id)) continue
    const block: any = getBlockValue(recordMap.block[id] as any)
    if (!block) continue
    keep.add(id)

    const syncedSourceId = block.format?.transclusion_reference_pointer?.id
    if (syncedSourceId) stack.push(syncedSourceId)

    const isChildPage =
      id !== rootId &&
      (block.type === 'page' || block.type === 'collection_view_page')
    if (isChildPage) continue

    for (const childId of block.content || []) stack.push(childId)
  }

  for (const [id, entry] of Object.entries(recordMap.block)) {
    if (keep.has(id)) continue
    const block: any = getBlockValue(entry as any)
    const isPageLike =
      block?.type === 'page' ||
      block?.type === 'collection_view_page' ||
      block?.parent_table === 'collection'
    if (!isPageLike) delete recordMap.block[id]
  }

  return recordMap
}
