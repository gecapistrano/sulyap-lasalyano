import ClientApp from '@/App'

export const metadata = {
  title: 'Curator desk — Sulyap Lasalyano',
  robots: { index: false, follow: false },
}

export default function CuratorPage() {
  return <ClientApp initialScreen="curator" />
}
