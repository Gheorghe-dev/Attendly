import type { Metadata } from 'next';
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QR Attendance System',
  description: 'Enterprise academic attendance tracker with anti-proxy verification',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className:
                  'bg-card text-card-foreground border border-border shadow-md rounded-card text-xs font-medium',
              }}
            />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
