# Building sein.kim: a Notion-backed portfolio site

A side project log: how this site went from "just use a Notion page" to a
custom Next.js front end that still keeps Notion as the only CMS.

## The brief

- Personal portfolio for job applications (PM / data analyst / ops roles),
  doubling as a live demo of "what you can build on top of Notion" for
  CloudShift client conversations.
- Content had to stay 100% editable in Notion — no separate CMS, no
  copy-pasting updates into code.
- Design had to look like a custom-built site, not a Notion page with a
  new favicon.

## Stack

- [`nextjs-notion-starter-kit`](https://github.com/transitive-bullshit/nextjs-notion-starter-kit)
  (Next.js + `react-notion-x` + `notion-client`) as the scaffold.
- `notion-client` talks to Notion's private API the same way the browser
  does — no official API token, no integration setup. The only requirement
  is that the pages are switched to "Share to web" in Notion.
- Deployed on Vercel, custom domain `sein.kim`.

## Architecture

Content lives in three Notion pages linked from the root page — **About**,
**Experience**, **Projects** — plus the root page itself for identity
(name, photo, contact links). The Next.js app fetches all of it server-side
and renders it through `react-notion-x`; no block of copy is hand-written
in the codebase.

The homepage is a single-page scroll layout (About → Experience → Projects
stacked vertically) with a fixed left sidebar, styled after
[brittanychiang.com](https://brittanychiang.com/):

- `lib/home-sections.ts` hardcodes the three section ids → Notion page ids.
  Not derived from Notion automatically — same tradeoff as any hand-built
  nav, traded complexity for a page that can't silently get the wrong
  order.
- `pages/index.tsx` fetches the root page recordMap *and* all three
  section recordMaps at build/request time, so the whole scroll page is one
  server-rendered payload — no client-side loading spinners between
  sections.
- `components/ScrollNav.tsx` drives the sidebar nav with an
  `IntersectionObserver` (`lib/use-active-section.ts`) watching a band near
  the top of the viewport, so the active nav item flips as you scroll past
  each section — no manual scroll-position math.
- `components/SocialLinks.tsx` + `lib/social-links.ts` render Contact /
  LinkedIn / GitHub / Instagram as a compact icon row. These are hardcoded
  in code rather than rendered from the Notion blocks, because pasted URLs
  in Notion render as full bookmark-preview cards — fine inline in a page,
  much too heavy for a sidebar footer.
- The sidebar reuses the *same* Notion-rendered page icon + title as the
  root Notion page (so renaming yourself in Notion updates the site name
  everywhere), but everything below the divider in that page's content is
  hidden via CSS (`display: none` on `.notion-page-content`) since
  `<ScrollNav>` / `<SocialLinks>` fully replace it with custom markup.

## Design system

- Typography: Satoshi (self-hosted via `next/font/local`, downloaded from
  Fontshare) for headings, Inter for body text.
- Color palette: a warm charcoal/pink palette defined once as CSS custom
  properties on `body` (not `.notion`) so both the Notion-rendered content
  and custom chrome — sidebar shell, nav, section labels — share the exact
  same light/dark values and flip together.
- Custom header (`NotionPageHeader.tsx`) replaces react-notion-x's default
  breadcrumb bar with a plain brand + nav + dark-mode toggle + search.

## Notable bugs and how they got fixed

- **Hydration mismatch on inline databases.** `react-notion-x`'s
  `Collection` component is loaded via `next/dynamic` with SSR enabled by
  default — the server renders the fully resolved markup, but the client's
  first paint (before the code-split chunk arrives) renders nothing, so
  React's hydration check fails. Fix: `ssr: false` on that one dynamic
  import, matching the existing `Pdf`/`Modal` components in the same file.
- **Dark mode only darkening some blocks.** The color palette was scoped
  to `.notion` (react-notion-x's own wrapper), so anything outside it —
  the sidebar shell, section titles, nav — never got dark-mode colors,
  leaving light text on a light background in some spots. Fix: moved the
  palette to `body` / `body.dark-mode`, which every element inherits from
  regardless of whether it's inside a Notion-rendered block.
- **Grouped ("Group by") database views showing empty groups.**
  `notion-client`'s `getPage()` queries a collection's data using whatever
  `collection_view` metadata it already has — but for a grouped view, the
  group-by schema isn't populated until *after* that same fetch resolves,
  so it silently falls back to an ungrouped query and every group renders
  with a header but no rows. Fix: after `getPage()` returns,
  `hydrateGroupedCollectionViews()` (`lib/notion.ts`) re-detects any
  grouped view that only got the ungrouped fallback and re-queries it with
  the now-complete view metadata via `notion.getCollectionData()`. Doesn't
  help for databases nested several pages deep (a database-row page inside
  a gallery card, for instance) — that view metadata seems to never fully
  resolve through the public API. Simplest real fix there: switch that one
  view to Board/Gallery/Table instead of Group-by list.
- **Wide tables overflowing into the sidebar.** A table wider than its
  column (a long "Description" cell, for example) has no overflow
  container by default in react-notion-x, so it just overflows the page.
  Fix: `div:has(> .notion-simple-table) { overflow-x: auto }` — scopes the
  horizontal scroll to the table's own wrapper instead of the page.
- **File attachments looking out of place next to plain text links.**
  Notion's file blocks render as an icon + filename + filesize chip, which
  reads as a different "class" of link next to Contact/LinkedIn-style text
  links. Restyled to a plain underlined text link via CSS rather than
  moving the file to Google Drive/Dropbox — kept the file hosted in
  Notion so the download link is always freshly signed instead of a static
  URL that could expire.

## Content lives in a company Notion workspace — known tradeoff

The linked pages (About / Experience / Projects) live in the CloudShift
Notion workspace rather than a personal one, since this project doubles as
a CloudShift client demo. That's a deliberate tradeoff, not an oversight:
if workspace-sharing settings change, or access to that workspace is lost,
the site's content becomes unreachable until it's migrated to a personal
Notion account. Worth revisiting if this stops being a CloudShift demo and
becomes purely a personal job-search site.

## Deployment

- Code lives in a personal GitHub repo (not the CloudShift org).
- Hosted on Vercel, connected to that repo for automatic deploys on push.
- Custom domain: `sein.kim`.
