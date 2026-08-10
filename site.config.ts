import { siteConfig } from './lib/site-config'

export default siteConfig({
  // the site's root Notion page (required)
  rootNotionPageId: '1fae6a8154768011ba27fc4f412fad62',

  // if you want to restrict pages to a single notion workspace (optional)
  // (this should be a Notion ID; see the docs for how to extract this)
  rootNotionSpaceId: null,

  // basic site info (required)
  name: 'Sein (Ines) Kim',
  domain: 'sein.kim',
  author: 'Sein (Ines) Kim',

  // open graph metadata (optional)
  description: 'Product / Data / Ops × Notion Solutions Consulting',

  // social usernames (optional)
  // twitter: '',
  // github: '',
  linkedin: 'sein-ines-kim',
  // mastodon: '#', // optional mastodon profile URL, provides link verification
  // newsletter: '#', // optional newsletter URL
  // youtube: '#', // optional youtube channel name or `channel/UCGbXXXXXXXXXXXXXXXXXXXXXX`

  // default notion icon and cover images for site-wide consistency (optional)
  // page-specific values will override these site-wide defaults
  defaultPageIcon: null,
  defaultPageCover: null,
  defaultPageCoverPosition: 0.5,

  // whether or not to enable support for LQIP preview images (optional)
  isPreviewImageSupportEnabled: true,

  // whether or not redis is enabled for caching generated preview images (optional)
  // NOTE: if you enable redis, you need to set the `REDIS_HOST` and `REDIS_PASSWORD`
  // environment variables. see the readme for more info
  isRedisEnabled: false,

  // Keep the raw Notion id in generated URLs, in prod too (default: only in
  // dev). Without it, a link to any page the sitemap crawler doesn't reach —
  // e.g. a row of a database nested inside a page, like the Notion Blog
  // articles or react-notion-x's own built-in Search results — 404s, since
  // resolving a title-only slug back to a page id depends on that crawl.
  // A raw id in the URL resolves directly, without needing the sitemap.
  includeNotionIdInUrls: true,

  // map of notion page IDs to URL paths (optional)
  // any pages defined here will override their default URL paths
  // example:
  //
  // pageUrlOverrides: {
  //   '/foo': '067dd719a912471ea9a3ac10710e7fdf',
  //   '/bar': '0be6efce9daf42688f65c76b89f8eb27'
  // }
  pageUrlOverrides: null,

  // whether to use the default notion navigation style or a custom one with links to
  // important pages. To use `navigationLinks`, set `navigationStyle` to `custom`.
  // Nav links are intentionally empty: Portfolio now lives in the homepage's
  // Explore sidebar, and Contact/LinkedIn live in the hero CTAs — the header
  // only shows the brand, dark mode toggle, and search.
  navigationStyle: 'custom',
  navigationLinks: []
})
