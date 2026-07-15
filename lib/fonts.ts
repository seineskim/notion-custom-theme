import { Inter } from 'next/font/google'
import localFont from 'next/font/local'

export const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap'
})

export const headingFont = localFont({
  src: [
    {
      path: './fonts/satoshi/Satoshi-Medium.woff2',
      weight: '500',
      style: 'normal'
    },
    {
      path: './fonts/satoshi/Satoshi-Bold.woff2',
      weight: '700',
      style: 'normal'
    },
    {
      path: './fonts/satoshi/Satoshi-Black.woff2',
      weight: '900',
      style: 'normal'
    }
  ],
  variable: '--font-heading',
  display: 'swap'
})
