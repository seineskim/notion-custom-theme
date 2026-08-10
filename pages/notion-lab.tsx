import type { PageProps } from '@/lib/types'
import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { notionLabPageId } from '@/lib/home-sections'
import { getPage } from '@/lib/notion'
import { resolveNotionPage } from '@/lib/resolve-notion-page'

export const getStaticProps = async () => {
  try {
    // resolveNotionPage(domain) with no page id returns the root page's
    // props — reused here so the sidebar (photo/name/nav/socials) matches
    // the home page exactly. The Notion Lab content itself is fetched
    // separately and rendered in the main pane.
    const props = await resolveNotionPage(domain)
    const notionLabRecordMap = await getPage(notionLabPageId)

    return { props: { ...props, notionLabRecordMap }, revalidate: 10 }
  } catch (err) {
    console.error('notion-lab page error', domain, err)
    throw err
  }
}

export default function NotionLabPage(props: PageProps) {
  return <NotionPage {...props} />
}
