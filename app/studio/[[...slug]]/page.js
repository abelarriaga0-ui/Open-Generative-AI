import { redirect } from 'next/navigation';
import StandaloneShell from '@/components/StandaloneShell';
import RealizoStudio from '@/components/RealizoStudio';
import { getWalletEnvironment } from '@/lib/wallet/server';
import { getOwnSession } from '@/lib/realizo-auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estudio de videos | Realizo' };

export default async function StudioPage({ params }) {
  // Other deployments continue using the existing full Open Generative AI studio.
  if (process.env.REALIZO_AUTH_PROVIDER !== 'native') return <StandaloneShell />;
  const route = await params;
  const slug = route?.slug || [];
  if (slug.length > 1 || (slug.length === 1 && slug[0] !== 'video')) redirect('/studio');
  const env = await getWalletEnvironment();
  const user = await getOwnSession(env);
  // Public creative showroom: visitors can browse styles and the empty library.
  // All wallet, video generation and project endpoints still require auth.
  return <RealizoStudio accountId={user?.id||null} guest={!user} />;
}
