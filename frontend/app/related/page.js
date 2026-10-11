import ClientApp from '@/App'

export default async function RelatedPage({ searchParams }) {
  const sp = await searchParams
  const tag = typeof sp?.tag === 'string' ? sp.tag : ''
  return <ClientApp initialScreen="related-artifacts" initialRelatedTag={tag} />
}
