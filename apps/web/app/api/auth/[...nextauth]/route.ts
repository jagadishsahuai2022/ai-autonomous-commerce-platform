import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

// Server-side only — use Docker-internal URL. NEXT_PUBLIC_API_URL is a
// relative path (/api/v1) in Docker and cannot be used for server-side fetch.
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password Login
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          if (response.data?.token) {
            return {
              id: response.data.user?.id || credentials.email,
              email: response.data.user?.email || credentials.email,
              name: response.data.user?.name,
              image: response.data.user?.image,
              token: response.data.token,
            };
          }

          throw new Error('Invalid credentials');
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Login failed');
        }
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),

    // Microsoft/Azure Entra ID OAuth - DISABLED (not available in next-auth v4.24.5)
    // Use 'microsoft' provider config instead if needed
    /*
    MicrosoftProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    }),
    */
  ],

  callbacks: {
    // When user signs in, exchange OAuth token for app token
    async signIn({ user, account, profile, email, credentials }) {
      try {
        // For OAuth providers, exchange provider token for our JWT
        if (account?.provider === 'google' || account?.provider === 'microsoft-entra-id') {
          const response = await axios.post(`${API_URL}/auth/oauth/${account.provider}`, {
            email: user.email,
            name: user.name,
            image: user.image,
            providerId: account.providerAccountId,
          });

          if (response.data?.token) {
            // Store the app token in the user object
            (user as any).token = response.data.token;
            (user as any).id = response.data.user?.id || user.email;
          }
        }

        return true;
      } catch (error) {
        console.error('Sign-in callback error:', error);
        // Don't block sign in on oauth token exchange failure
        // The frontend can attempt to create the user
        return true;
      }
    },

    // Add token to JWT session
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id || user.email;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.token = (user as any).token;
        token.provider = account?.provider;
      }
      return token;
    },

    // Return user with token in session
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        (session.user as any).token = token.token as string;
        (session.user as any).provider = token.provider as string;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to homepage or intended page
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Redirect to dashboard if logging in
      if (url.includes('signin')) {
        return `${baseUrl}/dashboard`;
      }
      return baseUrl;
    },
  },

  pages: {
    signIn: '/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh JWT every hour
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
