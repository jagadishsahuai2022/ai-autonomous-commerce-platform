import type { Metadata } from 'next';
import { LayoutClient } from './layout-client';

export const metadata: Metadata = {
  title: 'DelegateCart - AI-Powered E-Commerce Platform',
  description:
    'Enterprise AI-enabled e-commerce platform with intelligent product recommendations, smart shopping assistant, and advanced analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen dark:from-slate-900 dark:to-blue-950" suppressHydrationWarning>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
