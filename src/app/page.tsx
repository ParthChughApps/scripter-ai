import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  // Redirect to generate page if authenticated, otherwise to login
  redirect('/generate');
}

