import ClientApp from '@/App'

export default async function ArtifactPage({ params }) {
  const { idCode } = await params
  return <ClientApp initialScreen="artifact-detail" initialIdCode={idCode} />
}
