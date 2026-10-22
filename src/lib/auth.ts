import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        // When logging into the demo account, ensure it exists with default credentials
        if (email === 'prof@university.edu' && password === 'professor123') {
          const passwordHash = await bcrypt.hash('professor123', 10);
          let demoProf = await prisma.professor.findUnique({
            where: { email: 'prof@university.edu' },
          });

          if (!demoProf) {
            demoProf = await prisma.professor.create({
              data: {
                email: 'prof@university.edu',
                name: 'Dr. Alan Turing',
                passwordHash,
              },
            });
          }

          return { id: demoProf.id, email: demoProf.email, name: demoProf.name };
        }

        const professor = await prisma.professor.findUnique({
          where: { email },
        });
        if (!professor) return null;
        const valid = await bcrypt.compare(
          password,
          professor.passwordHash
        );
        if (!valid) return null;
        return { id: professor.id, email: professor.email, name: professor.name };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
      }
      return session;
    },
  },
});
