import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/spotlight/styles.css';

import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "St Georges Water Safety Team - Water Asset Management",
  description: "Professional water asset management system with real-time monitoring, maintenance tracking, and comprehensive reporting",
  keywords: ["water asset management", "asset tracking", "facility management", "maintenance", "filters"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <MantineProvider
          defaultColorScheme="light"
          theme={{
            primaryColor: 'blue',
            fontFamily: 'var(--font-geist-sans)',
            headings: {
              fontFamily: 'var(--font-geist-sans)',
            },
            colors: {
              blue: [
                '#e3f2fd',
                '#bbdefb',
                '#90caf9',
                '#64b5f6',
                '#42a5f5',
                '#2196f3',
                '#1e88e5',
                '#1976d2',
                '#1565c0',
                '#0d47a1'
              ],
            },
            radius: {
              xs: '0.25rem',
              sm: '0.5rem',
              md: '0.75rem',
              lg: '1rem',
              xl: '1.5rem',
            },
          }}
        >
          <ModalsProvider>
            <Notifications position="top-right" />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
