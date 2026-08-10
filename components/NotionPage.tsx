import cs from 'classnames'
import { useRouter } from 'next/router'
import { type PageBlock } from 'notion-types'
import { getBlockTitle, getBlockValue, getPageProperty } from 'notion-utils'
import * as React from 'react'
import BodyClassName from 'react-body-classname'
import { NotionRenderer } from 'react-notion-x'
import { useSearchParam } from 'react-use'

import type * as types from '@/lib/types'
import * as config from '@/lib/config'
import { mapImageUrl } from '@/lib/map-image-url'
import { getCanonicalPageUrl, mapPageUrl } from '@/lib/map-page-url'
import { notionRendererComponents } from '@/lib/notion-components'
import { searchNotion } from '@/lib/search-notion'
import { useDarkMode } from '@/lib/use-dark-mode'

import { Footer } from './Footer'
import { HomeSections } from './HomeSections'
import { Loading } from './Loading'
import { NotionLabFeed } from './NotionLabFeed'
import { Page404 } from './Page404'
import { PageAside } from './PageAside'
import { PageHead } from './PageHead'
import { ScrollNav } from './ScrollNav'
import { SocialLinks } from './SocialLinks'
import styles from './styles.module.css'

export function NotionPage({
  site,
  recordMap,
  error,
  pageId,
  sectionRecordMaps,
  notionLabRecordMap
}: types.PageProps) {
  const router = useRouter()
  const lite = useSearchParam('lite')

  // lite mode is for oembed
  const isLiteMode = lite === 'true'

  const { isDarkMode } = useDarkMode()

  const siteMapPageUrl = React.useMemo(() => {
    const params: any = {}
    if (lite) params.lite = lite

    const searchParams = new URLSearchParams(params)
    return site ? mapPageUrl(site, recordMap!, searchParams) : undefined
  }, [site, recordMap, lite])

  // internal links inside the Notion Lab page's own content need to resolve
  // against *its* recordMap, not the root page's
  const notionLabMapPageUrl = React.useMemo(() => {
    if (!site || !notionLabRecordMap) return undefined
    return mapPageUrl(site, notionLabRecordMap, new URLSearchParams())
  }, [site, notionLabRecordMap])

  const keys = Object.keys(recordMap?.block || {})
  const block = getBlockValue(recordMap?.block?.[keys[0]!])

  const isRootPage = pageId === site?.rootNotionPageId

  const isBlogPost =
    block?.type === 'page' && block?.parent_table === 'collection'

  const showTableOfContents = !!isBlogPost
  const minTableOfContentsItems = 3

  const pageAside = React.useMemo(
    () => (
      <PageAside
        block={block!}
        recordMap={recordMap!}
        isBlogPost={isBlogPost}
      />
    ),
    [block, recordMap, isBlogPost]
  )

  if (router.isFallback) {
    return <Loading />
  }

  if (error || !site || !block || !recordMap) {
    return <Page404 site={site} pageId={pageId} error={error} />
  }

  const title = getBlockTitle(block, recordMap) || site.name

  console.log('notion page', {
    isDev: config.isDev,
    title,
    pageId,
    rootNotionPageId: site.rootNotionPageId,
    recordMap
  })

  if (!config.isServer) {
    // add important objects to the window global for easy debugging
    const g = window as any
    g.pageId = pageId
    g.recordMap = recordMap
    g.block = block
  }

  const canonicalPageUrl = config.isDev
    ? undefined
    : getCanonicalPageUrl(site, recordMap)(pageId)

  const socialImage = mapImageUrl(
    getPageProperty<string>('Social Image', block, recordMap) ||
      (block as PageBlock).format?.page_cover ||
      config.defaultPageCover,
    block
  )

  const socialDescription =
    getPageProperty<string>('Description', block, recordMap) ||
    config.description

  const notionRenderer = (
    <NotionRenderer
      bodyClassName={cs(
        styles.notion,
        pageId === site.rootNotionPageId && 'index-page'
      )}
      darkMode={isDarkMode}
      components={notionRendererComponents}
      recordMap={recordMap}
      rootPageId={site.rootNotionPageId}
      rootDomain={site.domain}
      fullPage={!isLiteMode}
      previewImages={!!recordMap.preview_images}
      showCollectionViewDropdown={false}
      showTableOfContents={showTableOfContents}
      minTableOfContentsItems={minTableOfContentsItems}
      defaultPageIcon={config.defaultPageIcon}
      defaultPageCover={config.defaultPageCover}
      defaultPageCoverPosition={config.defaultPageCoverPosition}
      mapPageUrl={siteMapPageUrl}
      mapImageUrl={mapImageUrl}
      searchNotion={config.isSearchEnabled ? searchNotion : undefined}
      pageAside={pageAside}
      footer={isRootPage ? null : <Footer />}
    />
  )

  // fullPage on this second renderer would otherwise render a second copy of
  // the custom brand header (notionRendererComponents.Header) inside the
  // main pane, on top of the one already rendered by the sidebar's own
  // fullPage renderer above. Collection is swapped for a custom grouped list
  // (NotionLabFeed) — react-notion-x's own table/gallery UI looks like a raw
  // spreadsheet and can't reliably render Notion's own grouped view this
  // deep inside a page (see lib/notion.ts's hydrateGroupedCollectionViews).
  const notionLabComponents = {
    ...notionRendererComponents,
    Header: () => null,
    Collection: NotionLabFeed
  }

  const notionLabRenderer = notionLabRecordMap && (
    <NotionRenderer
      bodyClassName={styles.notion}
      darkMode={isDarkMode}
      components={notionLabComponents}
      recordMap={notionLabRecordMap}
      rootPageId={site.rootNotionPageId}
      rootDomain={site.domain}
      fullPage
      previewImages={!!notionLabRecordMap.preview_images}
      showCollectionViewDropdown={false}
      defaultPageIcon={config.defaultPageIcon}
      defaultPageCover={config.defaultPageCover}
      defaultPageCoverPosition={config.defaultPageCoverPosition}
      mapPageUrl={notionLabMapPageUrl}
      mapImageUrl={mapImageUrl}
      searchNotion={config.isSearchEnabled ? searchNotion : undefined}
      footer={<Footer />}
    />
  )

  // the /notion-blog route reuses the root page's recordMap/block for the
  // sidebar identity (photo, name, socials), so title/description here would
  // otherwise say "Ines Sein Kim" instead of describing this page
  const notionLabKeys = Object.keys(notionLabRecordMap?.block || {})
  const notionLabBlock =
    notionLabRecordMap && getBlockValue(notionLabRecordMap.block[notionLabKeys[0]!])
  const pageHeadTitle = notionLabRecordMap
    ? getBlockTitle(notionLabBlock!, notionLabRecordMap) || 'Notion Lab'
    : title
  const pageHeadDescription = notionLabRecordMap
    ? 'Notion tips, templates, and updates — an ongoing archive by Sein Kim.'
    : socialDescription

  return (
    <>
      <PageHead
        pageId={pageId}
        site={site}
        title={pageHeadTitle}
        description={pageHeadDescription}
        image={socialImage}
        url={canonicalPageUrl}
        isBlogPost={isBlogPost}
      />

      {isLiteMode && <BodyClassName className='notion-lite' />}
      {isDarkMode && <BodyClassName className='dark-mode' />}

      {notionLabRecordMap ? (
        <div className={styles.homeLayout}>
          <aside className={styles.homeSidebar}>
            {notionRenderer}
            <ScrollNav />
            <SocialLinks />
          </aside>

          <main className={styles.homePane}>{notionLabRenderer}</main>
        </div>
      ) : isRootPage ? (
        <div className={styles.homeLayout}>
          <aside className={styles.homeSidebar}>
            {notionRenderer}
            <ScrollNav />
            <SocialLinks />
          </aside>

          <main className={styles.homePane}>
            {sectionRecordMaps && (
              <HomeSections sectionRecordMaps={sectionRecordMaps} />
            )}
            <Footer />
          </main>
        </div>
      ) : (
        notionRenderer
      )}
    </>
  )
}
