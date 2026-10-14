import { Cinzel, Cormorant_Garamond, Crimson_Pro } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cinzel',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const crimson = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson',
  display: 'swap',
})

export const metadata = {
  title: 'Sulyap Lasalyano',
  description: 'DLSU-D Presidents’ Memorabilia — browse, scan, and explore Lasallian heritage.',
  icons: {
    icon: '/logo/LOGO_Dark-Mode.png',
    apple: '/logo/LOGO_Dark-Mode.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1C1714',
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${cormorant.variable} ${crimson.variable}`}
    >
      <body
        style={{
          ['--font-display']: 'var(--font-cinzel), Cinzel, serif',
          ['--font-heading']: 'var(--font-cormorant), "Cormorant Garamond", serif',
          ['--font-body']: 'var(--font-crimson), "Crimson Pro", serif',
        }}
      >
        <div className="aca-paper-texture" aria-hidden="true" />
        <div className="aca-vignette" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
