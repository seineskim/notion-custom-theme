import type { PageProps } from '@/lib/types'
import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { homeSections } from '@/lib/home-sections'
import { getPage } from '@/lib/notion'
import { resolveNotionPage } from '@/lib/resolve-notion-page'

export const getStaticProps = async () => {
  try {
    const props = await resolveNotionPage(domain)

    const sectionEntries = await Promise.all(
      homeSections.map(
        async (section) => [section.id, await getPage(section.pageId)] as const
      )
    )
    const sectionRecordMaps = Object.fromEntries(sectionEntries)

    return { props: { ...props, sectionRecordMaps }, revalidate: 10 }
  } catch (err) {
    console.error('page error', domain, err)

    // we don't want to publish the error version of this page, so
    // let next.js know explicitly that incremental SSG failed
    throw err
  }
}

export default function NotionDomainPage(props: PageProps) {
  return <NotionPage {...props} />
}
