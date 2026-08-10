import { NotionAPI } from 'notion-client'

// Notion's Cloudflare bot-protection now blocks loadPageChunk requests that
// have no User-Agent header, regardless of auth — ofetch (used internally by
// notion-client) doesn't set one by default, so every request was getting a
// Cloudflare "Attention Required" 403 page instead of reaching Notion's app.
// authToken/activeUser are also set (from a real logged-in session) so
// requests are authenticated too, not just browser-shaped.
export const notion = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL,
  authToken: process.env.NOTION_TOKEN_V2,
  activeUser: process.env.NOTION_ACTIVE_USER,
  ofetchOptions: {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    }
  }
})
