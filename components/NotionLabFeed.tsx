import { getBlockCollectionId, getBlockTitle, getPageProperty } from 'notion-utils'
import * as React from 'react'

import { getCollectionViewRows } from '@/lib/notion-collection'
import { makeNotionLabSlug } from '@/lib/slug'

import styles from './NotionLabFeed.module.css'

// Topic categories, in menu order — must match the "카테고리" select options
// on the Notion Lab 콘텐츠 허브 exactly (a new option there needs adding
// here too, or its rows land in "기타"). 연동 sits last on purpose: it's
// dominated by developer-only Notion API scraps most customers skip.
const CATEGORIES: { name: string; emoji: string }[] = [
  { name: '시작하기', emoji: '🌱' },
  { name: '페이지·문서 작성', emoji: '✍️' },
  { name: '데이터베이스', emoji: '🗂️' },
  { name: '협업', emoji: '🤝' },
  { name: 'AI·자동화', emoji: '🤖' },
  { name: '관리자·보안', emoji: '🛡️' },
  { name: '템플릿·사례', emoji: '📋' },
  { name: '연동', emoji: '🔗' }
]
const OTHER_CATEGORY = { name: '기타', emoji: '📎' }

// "구분" value of the Enterprise POC rows. They used to live on their own
// page (🚀 Notion Enterprise POC 자료실) — two places to look confused
// customers, so they're listed here with everything else, badged, and this
// toggle (?sec=poc, which the old POC page address redirects to — see
// next.config.js) narrows the list to them.
const POC_SECTION = '엔터프라이즈 POC'

// Keyword chips shown under the search box, in this order — a subset of the
// "키워드" multi-select options picked as the most common first questions
// customers ask. Chips with no matching article in the current feed are
// dropped.
const FEATURED_KEYWORDS = [
  '처음시작',
  '초기세팅',
  '팀원초대',
  '관리자',
  '권한',
  '데이터베이스',
  '엑셀대체',
  '템플릿',
  '자동화',
  '노션AI',
  '회의록',
  '연동'
]

interface FeedItem {
  id: string
  title: string
  slug: string
  type: string | null
  description: string
  category: string
  subcategory: string | null
  keywords: string[]
  externalUrl: string | null
  // "구분" (e.g. 엔터프라이즈 POC) — shown as a badge.
  section: string | null
  searchText: string
}

// Lowercased with all whitespace removed, so "엑셀 대체" finds "엑셀대체" and
// "#초대" finds "초대".
const normalize = (text: string) =>
  text.toLowerCase().replaceAll(/\s+/g, '').replace(/^#/, '')

function getText(row: any, recordMap: any, name: string): string {
  const value = getPageProperty<any>(name, row, recordMap)
  return typeof value === 'string' ? value.trim() : ''
}

function getList(row: any, recordMap: any, name: string): string[] {
  const value = getPageProperty<any>(name, row, recordMap)
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

// Reads ?q= / ?tag= / ?cat= once on mount and mirrors later changes back
// with replaceState, so a filtered list can be shared as a link without
// adding a history entry per keystroke. Starts empty so the first client
// render matches the server-rendered markup.
function useUrlFilterState() {
  const [query, setQuery] = React.useState('')
  const [tag, setTag] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState<string | null>(null)
  const [pocOnly, setPocOnly] = React.useState(false)
  // State, not a ref: the write-back effect below must not run until the
  // render *after* the URL was read — in the mount commit it would still see
  // the empty initial values and wipe the incoming ?tag=… before it applies.
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setQuery(params.get('q') || '')
    setTag(params.get('tag'))
    setCategory(params.get('cat'))
    setPocOnly(params.get('sec') === 'poc')
    setReady(true)
  }, [])

  React.useEffect(() => {
    if (!ready) return
    const url = new URL(window.location.href)
    const set = (key: string, value: string | null) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key)
    set('q', query.trim() || null)
    set('tag', tag)
    set('cat', category)
    set('sec', pocOnly ? 'poc' : null)
    window.history.replaceState(window.history.state, '', url.toString())
  }, [ready, query, tag, category, pocOnly])

  return {
    query,
    setQuery,
    tag,
    setTag,
    category,
    setCategory,
    pocOnly,
    setPocOnly
  }
}

// Renders the "Notion Lab 콘텐츠 허브" database as a searchable, topic-grouped
// list matching the site's own design language, instead of react-notion-x's
// default table/gallery UI (which looks like a raw spreadsheet and, embedded
// this deep inside a page, can't reliably render Notion's own grouped view —
// see lib/notion.ts's hydrateGroupedCollectionViews). Reads rows directly out
// of the recordMap already fetched for the page, and search/filtering runs
// entirely client-side over those rows — no extra requests, and nothing the
// page didn't already publish (unpublished rows were stripped server-side by
// removeUnpublishedRows) can ever match.
//
// Lists every published row regardless of the Notion view's own filter
// (the blog view hides 구분 = 엔터프라이즈 POC rows): the basics customers
// look for first (팀원 초대, 관리자, 권한…) mostly live in the POC set, and
// keeping them on a separate page left customers unsure where to look.
//
// idToSlugMap (lib/notion-lab.ts's getNotionLabIdToSlugMap, injected via
// components/NotionPage.tsx) is the single source of truth for slugs —
// makeNotionLabSlug() is only a fallback for a row that map doesn't have yet
// (e.g. published moments ago, before the cache refreshed). Computing slugs
// independently here would disagree with lib/notion-lab.ts's
// dedupeSlugCollisions() whenever two rows' ids happen to share the same
// short id suffix, silently linking one of them to the wrong page.
export function NotionLabFeed({ block, ctx, idToSlugMap }: any) {
  const { recordMap } = ctx
  const {
    query,
    setQuery,
    tag,
    setTag,
    category,
    setCategory,
    pocOnly,
    setPocOnly
  } = useUrlFilterState()

  const items = React.useMemo<FeedItem[]>(() => {
    const collectionId = getBlockCollectionId(block, recordMap)
    const viewIds: string[] = block?.view_ids || []
    if (!collectionId || !viewIds.length) return []

    const rows = getCollectionViewRows(recordMap, collectionId, viewIds, {
      applyViewFilter: false
    })

    return rows.map((row: any) => {
      const title = getBlockTitle(row, recordMap) || '(제목 없음)'
      const rawCategory = getText(row, recordMap, '카테고리')
      const item = {
        id: row.id,
        title,
        slug: idToSlugMap?.[row.id] || makeNotionLabSlug(title, row.id),
        type: getText(row, recordMap, '콘텐츠 유형') || null,
        description: getText(row, recordMap, 'Description'),
        category: CATEGORIES.some((c) => c.name === rawCategory)
          ? rawCategory
          : OTHER_CATEGORY.name,
        subcategory: getText(row, recordMap, '소분류') || null,
        keywords: getList(row, recordMap, '키워드'),
        externalUrl: getText(row, recordMap, 'URL') || null,
        section: getText(row, recordMap, '구분') || null
      }
      return {
        ...item,
        searchText: normalize(
          [
            item.title,
            item.description,
            item.category,
            item.subcategory,
            item.type,
            ...item.keywords
          ]
            .filter(Boolean)
            .join(' ')
        )
      }
    })
  }, [block, recordMap, idToSlugMap])

  const hasPoc = items.some((item) => item.section === POC_SECTION)

  const chips = React.useMemo(() => {
    const present = new Set(items.flatMap((item) => item.keywords))
    return FEATURED_KEYWORDS.filter((keyword) => present.has(keyword))
  }, [items])

  const tokens = React.useMemo(
    () => query.split(/\s+/).map(normalize).filter(Boolean),
    [query]
  )
  const isSearching = tokens.length > 0 || !!tag
  // Tab counts are taken from the same list the reader will see (search,
  // keyword and POC toggle applied, category not), so a tab's number
  // always equals what clicking it shows.
  const base = React.useMemo(
    () =>
      pocOnly ? items.filter((item) => item.section === POC_SECTION) : items,
    [items, pocOnly]
  )

  const matched = React.useMemo(
    () =>
      base.filter(
        (item) =>
          (!tag || item.keywords.includes(tag)) &&
          tokens.every((token) => item.searchText.includes(token))
      ),
    [base, tag, tokens]
  )

  const categoryCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of matched) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1)
    }
    return counts
  }, [matched])

  // Tabs come from the whole list (not just matches) so they don't jump
  // around while typing; a tab with no matches shows 0.
  const categories = React.useMemo(() => {
    const present = new Set(base.map((item) => item.category))
    return [...CATEGORIES, OTHER_CATEGORY].filter((c) => present.has(c.name))
  }, [base])

  const activeCategory = categories.some((c) => c.name === category)
    ? category
    : null

  const filtered = React.useMemo(
    () =>
      activeCategory
        ? matched.filter((item) => item.category === activeCategory)
        : matched,
    [matched, activeCategory]
  )

  // Browsing (no search): group by topic, or by 소분류 inside one topic.
  // Searching: one flat result list, since group headers around a handful
  // of hits just add noise.
  const groups = React.useMemo(() => {
    if (isSearching) return [{ key: 'results', label: null, items: filtered }]

    const keyOf = (item: FeedItem) =>
      activeCategory ? item.subcategory || '기타' : item.category
    const byKey = new Map<string, FeedItem[]>()
    for (const item of filtered) {
      const key = keyOf(item)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(item)
    }

    // Inside one topic, 소분류 keep first-seen order with "기타" last.
    const order = activeCategory
      ? [
          ...[...byKey.keys()].filter((key) => key !== '기타'),
          ...(byKey.has('기타') ? ['기타'] : [])
        ]
      : categories.map((c) => c.name)

    return order
      .filter((key) => byKey.has(key))
      .map((key) => {
        const meta = categories.find((c) => c.name === key)
        return {
          key,
          label: meta && !activeCategory ? `${meta.emoji} ${key}` : key,
          items: byKey.get(key)!
        }
      })
  }, [filtered, isSearching, activeCategory, categories])

  if (!items.length) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[NotionLabFeed] no rows resolved — collectionId:',
        getBlockCollectionId(block, recordMap),
        'view_ids:',
        block?.view_ids,
        'collection_query keys:',
        Object.keys(recordMap.collection_query || {})
      )
    }
    return null
  }

  const resetAll = () => {
    setQuery('')
    setTag(null)
    setCategory(null)
    setPocOnly(false)
  }

  return (
    <div className={styles.feed}>
      <div className={styles.finder} role='search'>
        <label className={styles.searchBox}>
          <svg
            className={styles.searchIcon}
            viewBox='0 0 24 24'
            aria-hidden='true'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            type='search'
            className={styles.searchInput}
            placeholder='찾는 기능을 검색해 보세요 (예: 초대, 엑셀, 회의록)'
            aria-label='글 검색'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {chips.length > 0 && (
          <div className={styles.chips} aria-label='추천 키워드'>
            {chips.map((keyword) => (
              <button
                key={keyword}
                type='button'
                className={styles.chip}
                aria-pressed={tag === keyword}
                onClick={() => setTag(tag === keyword ? null : keyword)}
              >
                #{keyword}
              </button>
            ))}
          </div>
        )}

        {hasPoc && (
          <div className={styles.sections} aria-label='자료 범위'>
            <button
              type='button'
              className={styles.sectionToggle}
              aria-pressed={!pocOnly}
              onClick={() => setPocOnly(false)}
            >
              모든 글
            </button>
            <button
              type='button'
              className={styles.sectionToggle}
              aria-pressed={pocOnly}
              onClick={() => setPocOnly(!pocOnly)}
            >
              🚀 Enterprise POC 자료만
            </button>
          </div>
        )}

        <div className={styles.tabs} aria-label='카테고리'>
          <button
            type='button'
            className={styles.tab}
            aria-pressed={!activeCategory}
            onClick={() => setCategory(null)}
          >
            전체 <span className={styles.tabCount}>{matched.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type='button'
              className={styles.tab}
              aria-pressed={activeCategory === c.name}
              onClick={() =>
                setCategory(activeCategory === c.name ? null : c.name)
              }
            >
              {c.emoji} {c.name}{' '}
              <span className={styles.tabCount}>
                {categoryCounts.get(c.name) || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {(isSearching || pocOnly) && (
        <p className={styles.resultSummary} aria-live='polite'>
          <span>
            {filtered.length
              ? `${filtered.length}개의 글을 찾았어요`
              : '찾는 글이 없어요'}
          </span>
          <button
            type='button'
            className={styles.resetButton}
            onClick={resetAll}
          >
            초기화
          </button>
        </p>
      )}

      {isSearching && !filtered.length && (
        <div className={styles.empty}>
          다른 단어로 검색하거나 아래 키워드를 눌러 보세요.
          <div className={styles.chips}>
            {chips.slice(0, 6).map((keyword) => (
              <button
                key={keyword}
                type='button'
                className={styles.chip}
                onClick={() => {
                  setQuery('')
                  setCategory(null)
                  setTag(keyword)
                }}
              >
                #{keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className={styles.group}>
          {group.label && (
            <h3 className={styles.groupTitle}>
              {group.label}
              <span className={styles.groupCount}>{group.items.length}</span>
            </h3>
          )}

          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <a
                  // The site's title-based slug URLs (mapPageUrl) only
                  // resolve for pages the sitemap crawler actually walks —
                  // it doesn't reach into rows of a database nested this
                  // deep inside a page, so those 404. This short slug skips
                  // that entirely: lib/resolve-notion-page.ts resolves it
                  // via lib/notion-lab.ts's slug map, independent of the
                  // sitemap crawl.
                  href={item.externalUrl || `/${item.slug}`}
                  target={item.externalUrl ? '_blank' : undefined}
                  rel={item.externalUrl ? 'noopener noreferrer' : undefined}
                  className={styles.itemLink}
                >
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.description && (
                    <span className={styles.itemDescription}>
                      {item.description}
                    </span>
                  )}
                  {(isSearching || item.type || item.section) && (
                    <span className={styles.itemMeta}>
                      {item.section && (
                        <span className={styles.sectionBadge}>
                          {item.section}
                        </span>
                      )}
                      {isSearching && <span>{item.category}</span>}
                      {item.type && <span>{item.type}</span>}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
