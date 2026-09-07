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

          {/* 섹션별 관심도. react-notion-x가 만드는 h1~h3(.notion-h, data-id=블록ID)를
              읽기 위치 근처에서 관찰하다가 처음 지나갈 때 한 번만 GA4로 전송한다.
              <Main/> 바로 뒤에 둬서, 이 스크립트가 실행되는 시점엔 이미 본문 헤딩이
              전부 파싱되어 있다 (하이드레이션 완료 여부와 무관 — _app.tsx의 useEffect가
              항상 붙는다는 보장이 없어서 React에 기대지 않는다). */}
          {gaId && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
;(function () {
  if (typeof window.gtag !== 'function') return
  var headings = document.querySelectorAll('.notion-h[data-id]')
  if (!headings.length) return
  var seen = {}
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return
      var el = entry.target
      var id = el.getAttribute('data-id')
      if (seen[id]) return
      seen[id] = true
      var levelMatch = el.className.match(/notion-h([1-3])/)
      window.gtag('event', 'section_view', {
        page_path: location.pathname,
        section_id: id,
        section_title: (el.textContent || '').trim().slice(0, 100),
        section_level: levelMatch ? 'h' + levelMatch[1] : ''
      })
    })
  }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 })
  headings.forEach(function (h) { observer.observe(h) })
})();
`
              }}
            />
          )}

          <NextScript />
        </body>
      </Html>
    )
  }
}
