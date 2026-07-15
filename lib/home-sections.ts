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
