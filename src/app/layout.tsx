import type {Metadata} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { PWARegister } from '@/components/pwa-register';
import { GoogleTranslate } from '@/components/GoogleTranslate';

export const metadata: Metadata = {
  title: 'Glyvora - Metabolic Decision Engine',
  description: 'AI-powered glucose predictions for Type-2 Diabetics.',
  manifest: '/manifest.webmanifest',
  themeColor: '#10b981',
  applicationName: 'Glyvora',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Glyvora',
  },
  icons: {
    icon: '/Glyvora-icon.png?v=2',
    shortcut: '/Glyvora-icon.png?v=2',
    apple: '/Glyvora-icon.png?v=2',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Glyvora-icon.png?v=2" sizes="any" />
        <link rel="apple-touch-icon" href="/Glyvora-icon.png?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
          <FirebaseClientProvider>
            {children}
            <PWARegister />
            <Toaster />
            <GoogleTranslate />
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
