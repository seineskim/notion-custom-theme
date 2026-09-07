import Document, { Head, Html, Main, NextScript } from 'next/document'

import { gaId } from '@/lib/config'

export default class MyDocument extends Document {
  override render() {
    return (
      <Html lang='en'>
        <Head>
          <link rel='shortcut icon' href='/favicon.ico' />
          <link rel='icon' type='image/png' sizes='32x32' href='favicon.png' />

          <link rel='manifest' href='/manifest.json' />

          {/* GA4. _app.tsx의 useEffect가 클라이언트에서 하이드레이션되지 않는
              문제가 있어 React를 거치지 않는 고전적인 방식으로 직접 심는다 —
              페이지가 파싱되는 즉시 실행되므로 하이드레이션 여부와 무관하다. */}
          {gaId && (
            <>
              <script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              />
              <script
                dangerouslySetInnerHTML={{
                  __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`
                }}
              />
            </>
          )}
        </Head>

        <body>
          <script
            dangerouslySetInnerHTML={{
              __html: `
window.addEventListener('error', function (e) {
  window.__hydrationDebug = window.__hydrationDebug || [];
  window.__hydrationDebug.push({ type: 'error', message: e.message, stack: e.error && e.error.stack });
});
window.addEventListener('unhandledrejection', function (e) {
  window.__hydrationDebug = window.__hydrationDebug || [];
  window.__hydrationDebug.push({ type: 'rejection', message: String(e.reason), stack: e.reason && e.reason.stack });
});
`
            }}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
/** Inlined version of noflash.js from use-dark-mode */
;(function () {
  var storageKey = 'darkMode'
  var classNameDark = 'dark-mode'
  var classNameLight = 'light-mode'
  function setClassOnDocumentBody(darkMode) {
    document.body.classList.add(darkMode ? classNameDark : classNameLight)
    document.body.classList.remove(darkMode ? classNameLight : classNameDark)
  }
  var preferDarkQuery = '(prefers-color-scheme: dark)'
  var mql = window.matchMedia(preferDarkQuery)
  var supportsColorSchemeQuery = mql.media === preferDarkQuery
  var localStorageTheme = null
  try {
    localStorageTheme = localStorage.getItem(storageKey)
  } catch (err) {}
  var localStorageExists = localStorageTheme !== null
  if (localStorageExists) {
    localStorageTheme = JSON.parse(localStorageTheme)
  }
  // Determine the source of truth
  if (localStorageExists) {
    // source of truth from localStorage
    setClassOnDocumentBody(localStorageTheme)
  } else if (supportsColorSchemeQuery) {
    // source of truth from system
    setClassOnDocumentBody(mql.matches)
    localStorage.setItem(storageKey, mql.matches)
  } else {
    // source of truth from document.body
    var isDarkMode = document.body.classList.contains(classNameDark)
    localStorage.setItem(storageKey, JSON.stringify(isDarkMode))
  }
})();
`
            }}
          />
          <Main />

          <NextScript />
        </body>
      </Html>
    )
  }
}
