// GA4 연동. Fathom/PostHog와 마찬가지로 Next.js router의 routeChangeComplete에
// 맞춰 pageview를 보낸다 (pages/_app.tsx 참고). 기본 page_view 자동 전송은 끄고
// (send_page_view: false) 라우트가 바뀔 때마다 gaPageview를 직접 호출한다.
declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function loadGA(measurementId: string) {
  if (typeof window === 'undefined' || window.gtag) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(script)

  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })
}

export function gaPageview(url: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_path: url,
    page_location: window.location.href,
    page_title: document.title
  })
}
