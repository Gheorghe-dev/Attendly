import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return <LoginForm />;
}
