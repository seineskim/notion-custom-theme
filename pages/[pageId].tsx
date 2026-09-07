import { type GetStaticProps } from 'next'
import { parsePageId } from 'notion-utils'

import { NotionPage } from '@/components/NotionPage'
import { domain, isDev, pageUrlOverrides } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { getNotionLabIdToSlugMap } from '@/lib/notion-lab'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { type PageProps, type Params } from '@/lib/types'

export const getStaticProps: GetStaticProps<PageProps, Params> = async (
  context
) => {
  const rawPageId = context.params?.pageId as string

  // Notion Blog article links used to be the raw page id (see
  // components/NotionLabFeed.tsx's history) — any of those already
  // shared/bookmarked/indexed should permanently redirect to the new short
  // slug rather than just quietly still working, so they consolidate onto
  // one canonical URL. parsePageId only matches a full raw Notion id, so
  // this never fires for an already-short slug.
  const parsedRawId = parsePageId(rawPageId)
  if (parsedRawId) {
    const idToSlug = await getNotionLabIdToSlugMap()
    const canonicalSlug = idToSlug[parsedRawId]

    if (canonicalSlug) {
      return {
        redirect: { destination: `/${canonicalSlug}`, permanent: true }
      }
    }
  }

  try {
    const props = await resolveNotionPage(domain, rawPageId)

    return { props, revalidate: 10 }
  } catch (err) {
    console.error('page error', domain, rawPageId, err)

    // we don't want to publish the error version of this page, so
    // let next.js know explicitly that incremental SSG failed
    throw err
  }
}

export async function getStaticPaths() {
  if (isDev) {
    return {
      paths: [],
      fallback: true
    }
  }

  const siteMap = await getSiteMap()

  // Combine sitemap paths with URL overrides (e.g., /articles, /notes)
  // URL overrides might not be in the sitemap if not directly linked from root.
  //
  // Notion Blog article short slugs (lib/notion-lab.ts) are deliberately NOT
  // pre-rendered here — resolving all of them up front means fetching every
  // article's full page + grouped-collection data during every build, which
  // is enough Notion API traffic to trip its rate limiter and fail the whole
  // build (seen in practice: a 429 on an unrelated page aborted the export).
  // fallback: true + the 10s revalidate below already resolve these slugs
  // correctly on first visit via lib/resolve-notion-page.ts, just not
  // pre-built — the Notion API load is spread out over real traffic instead
  // of one build-time burst.
  const allPageIds = [
    ...new Set([
      ...Object.keys(siteMap.canonicalPageMap),
      ...Object.keys(pageUrlOverrides)
    ])
  ]

  const staticPaths = {
    paths: allPageIds.map((pageId) => ({ params: { pageId } })),
    fallback: true
  }

  console.log(staticPaths.paths)
  return staticPaths
}

export default function NotionDomainDynamicPage(props: PageProps) {
  return <NotionPage {...props} />
}
