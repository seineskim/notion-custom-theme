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
// slugify() strips down to nothing).
function shortIdSuffix(pageId: string): string {
  return pageId.replaceAll('-', '').slice(0, 6)
}

export function makeNotionLabSlug(title: string, pageId: string): string {
  const base = truncateSlug(slugify(title), AUTO_SLUG_MAX_LEN)
  const suffix = shortIdSuffix(pageId)
  return base ? `${base}-${suffix}` : suffix
}
