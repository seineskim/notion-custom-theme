import { type ExtendedRecordMap } from 'notion-types'
import { getBlockValue } from 'notion-utils'

// Notion's AI Meeting Notes block (`type: 'transcription'`) isn't one
// react-notion-x knows, so it renders nothing — children included. Pages
// whose whole body is a meeting note (e.g. the Notion training write-ups)
// showed up on the site as an empty page.
//
// The block's children are three plain containers, identified by its
// format: the AI summary, the user's own notes, and the raw speech-to-text
// transcript. Splice the notes and summary contents into the parent in
// place of the meeting-note block so they render as ordinary blocks. The
// transcript is dropped on purpose: it's an unedited, often machine-
// translated dump that reads as garbled text on a public page.
export function flattenTranscriptionBlocks(
  recordMap: ExtendedRecordMap
): ExtendedRecordMap {
  const blockOf = (id: string): any =>
    id ? getBlockValue(recordMap.block[id] as any) : undefined

  for (const id of Object.keys(recordMap.block)) {
    const block = blockOf(id)
    if (block?.type !== 'transcription') continue

    const parent = blockOf(block.parent_id)
    const siblings: string[] | undefined = parent?.content
    const index = siblings?.indexOf(id) ?? -1
    if (!siblings || index === -1) continue

    const sectionIds = [
      block.format?.transcription_notes_id,
      block.format?.transcription_summary_id
    ]
    const replacement = sectionIds.flatMap(
      (sectionId: string) => blockOf(sectionId)?.content || []
    )

    siblings.splice(index, 1, ...replacement)
    for (const childId of replacement) {
      const child = blockOf(childId)
      if (child) child.parent_id = parent.id
    }
  }

  return recordMap
}
