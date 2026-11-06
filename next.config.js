// import path from 'node:path'
// import { fileURLToPath } from 'node:url'

export default {
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.notion.so' },
      { protocol: 'https', hostname: 'notion.so' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 's3.us-west-2.amazonaws.com' }
    ],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },

  // webpack: (config) => {
  //   // Workaround for ensuring that `react` and `react-dom` resolve correctly
  //   // when using a locally-linked version of `react-notion-x`.
  //   // @see https://github.com/vercel/next.js/issues/50391
  //   const dirname = path.dirname(fileURLToPath(import.meta.url))
  //   config.resolve.alias.react = path.resolve(dirname, 'node_modules/react')
  //   config.resolve.alias['react-dom'] = path.resolve(
  //     dirname,
  //     'node_modules/react-dom'
  //   )
  //   return config
  // },

  // See https://react-tweet.vercel.app/next#troubleshooting
  transpilePackages: ['react-tweet'],

  // /notion-lab briefly went live before being renamed to /notion-blog
  async redirects() {
    return [
      {
        source: '/notion-lab',
        destination: '/notion-blog',
        permanent: true
      },
      // The Enterprise POC 자료실 page was merged into the blog feed — send
      // its old addresses (possibly shared with customers) to the feed with
      // the POC filter on. Not permanent, in case it's split out again.
      ...[
        '/notion-enterprise-poc-c46ab4',
        '/3bae6a815476815fbcb5e94203c46ab4',
        '/3bae6a81-5476-815f-bcb5-e94203c46ab4'
      ].map((source) => ({
        source,
        destination: '/notion-blog?sec=poc',
        permanent: false
      }))
    ]
  }
}
