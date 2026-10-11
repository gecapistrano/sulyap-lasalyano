import ClientApp from '@/App'

export default async function PresidentPage({ params }) {
  const { presidentId } = await params
  return <ClientApp initialScreen="president-artifacts" initialPresidentId={presidentId} />
}
