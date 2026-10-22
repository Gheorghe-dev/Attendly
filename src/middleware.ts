import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ['/dashboard/:path*', '/api/courses/:path*', '/api/sessions/:path*', '/api/export/:path*'],
};
