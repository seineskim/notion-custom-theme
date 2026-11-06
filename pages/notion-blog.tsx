import { getBlockValue, parsePageId } from 'notion-utils'

import type { PageProps } from '@/lib/types'
import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { notionLabPageId } from '@/lib/home-sections'
import { getPage } from '@/lib/notion'
import {
  hideInternalProperties,
  removeUnpublishedRows
} from '@/lib/notion-collection'
import { resolveNotionPage } from '@/lib/resolve-notion-page'

// The 🚀 Notion Enterprise POC 자료실 is a child page of the blog page in
// Notion, so it showed up as a second "where to look" link above the feed.
// Its posts are now listed in the blog feed itself (components/
// NotionLabFeed.tsx), and its address redirects there (next.config.js), so
// drop the link here. The page itself stays in Notion untouched.
const POC_PAGE_ID = parsePageId('3bae6a815476815fbcb5e94203c46ab4', {
  uuid: true
})!

function hidePocPageLink(recordMap: any) {
  const page = getBlockValue(
    recordMap.block[parsePageId(notionLabPageId, { uuid: true })!]
  ) as any
  if (Array.isArray(page?.content)) {
    page.content = page.content.filter((id: string) => id !== POC_PAGE_ID)
  }
  return recordMap
}

export const getStaticProps = async () => {
  try {
    // resolveNotionPage(domain) with no page id returns the root page's
    // props — reused here so the sidebar (photo/name/nav/socials) matches
    // the home page exactly. The Notion Lab content itself is fetched
    // separately and rendered in the main pane.
    const props = await resolveNotionPage(domain)
    const notionLabRecordMap = hidePocPageLink(
      hideInternalProperties(
        removeUnpublishedRows(await getPage(notionLabPageId))
      )
    )

    return { props: { ...props, notionLabRecordMap }, revalidate: 10 }
  } catch (err) {
    console.error('notion-blog page error', domain, err)
    throw err
  }
}

export default function NotionBlogPage(props: PageProps) {
  return <NotionPage {...props} />
}
