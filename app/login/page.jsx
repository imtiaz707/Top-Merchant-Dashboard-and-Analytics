import { isDemo } from '@/lib/config';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic'; // demo mode is decided by runtime env

export default function LoginPage() {
  return <LoginForm demo={isDemo()} />;
}
