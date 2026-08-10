export interface HomeSection {
  // used for the #anchor, the React key, and the sectionRecordMaps lookup key
  id: string
  pageId: string
  title: string
}

export const homeSections: HomeSection[] = [
  {
    id: 'about',
    pageId: '39ee6a81547680bc830ccd4bd13fae7d',
    title: 'About'
  },
  {
    id: 'experience',
    pageId: '1fae6a815476812f8dddcc6932883329',
    title: 'Experience'
  },
  {
    id: 'projects',
    pageId: '224e6a815476801daafad286c9ecc602',
    title: 'Projects'
  }
]

// The B2B/Notion-expertise archive lives on its own route (/notion-blog)
// rather than as a fourth scrollable home section — it's a different kind of
// content (an ongoing, growing archive) from the About/Experience/Projects
// personal narrative, so it gets its own page while reusing the same sidebar.
// This is the "Notion Blog" Portfolio-database card (renamed from "Creative
// Advocate"), which holds the real Notion Lab 콘텐츠 허브 database — not the
// separate "Notion Lab" card, which only has an empty duplicate/linked view.
export const notionLabPageId = '1ffe6a8154768070bf69f963924ae157'
export const notionLabPath = '/notion-blog'

// The "Notion Lab 콘텐츠 허브" database itself — used to detect when the
// current page is one of its rows (e.g. to show a "Duplicate" link in the
// header that only makes sense on that database's own articles).
export const notionLabCollectionId = '1fbe6a81-5476-8014-8ad1-000b9635b789'
