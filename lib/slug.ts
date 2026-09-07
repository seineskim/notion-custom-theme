// Shared slug helpers for auto-generating short, URL-safe slugs from a
// Notion page's title + id — used so Notion Blog article links don't expose
// the raw 36-char page id (see components/NotionLabFeed.tsx and
// lib/notion-lab.ts, which both need to derive the *same* slug for the same
// (title, id) pair).

const AUTO_SLUG_MAX_LEN = 40

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

// Cuts at a word (hyphen) boundary so we don't chop a word in half. If the
// first "word" itself is longer than maxLen (e.g. no ASCII letters at all),
// just use the raw cut.
function truncateSlug(slug: string, maxLen: number): string {
  if (slug.length <= maxLen) return slug
  const cut = slug.slice(0, maxLen)
  const lastHyphen = cut.lastIndexOf('-')
  return lastHyphen > 10 ? cut.slice(0, lastHyphen) : cut
}

// Short suffix from the page id so slugs stay unique even when two titles
// collide or truncate down to the same prefix (e.g. all-Korean titles, which
// slugify() strips down to nothing). Takes it from the *end* of the id, not
// the start: Notion generates a batch of related pages (a database's rows, a
// template's subpages) with a shared prefix and only the tail actually
// varies — confirmed against this workspace's real ids, where the first 12
// characters were identical across an entire colliding group even after
// widening the prefix-based suffix to 10 chars. lib/notion-lab.ts's
// dedupeSlugCollisions() calls this again with a longer suffixLength for any
// pair that still collides regardless.
function shortIdSuffix(pageId: string, suffixLength: number): string {
  return pageId.replaceAll('-', '').slice(-suffixLength)
}

export function makeNotionLabSlug(
  title: string,
  pageId: string,
  suffixLength = 6
): string {
  const base = truncateSlug(slugify(title), AUTO_SLUG_MAX_LEN)
  const suffix = shortIdSuffix(pageId, suffixLength)
  return base ? `${base}-${suffix}` : suffix
}
