import './globals.css'

export const metadata = {
  title: 'Sulyap Lasalyano',
  description: 'DLSU-D Presidents’ Memorabilia — browse, scan, and explore Lasallian heritage.',
  icons: {
    icon: '/logo/LOGO_Light-Mode.png',
    apple: '/logo/LOGO_Light-Mode.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2c2416',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
