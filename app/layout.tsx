import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PackyCode API 延迟监控面板 - 实时网络延迟测试工具',
  description: '专业的API延迟监控面板，实时测试各服务节点的网络延迟性能。支持自定义域名配置，提供准确的延迟数据分析，帮助开发者优化API服务质量。',
  keywords: ['API延迟测试', '网络延迟监控', 'PackyCode', '服务器响应时间', 'API性能监控', '网络测速'],
  authors: [{ name: 'PackyCode' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'PackyCode API 延迟监控面板',
    description: '专业的API延迟监控工具，实时测试网络延迟性能',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'PackyCode API 延迟监控面板',
    description: '专业的API延迟监控工具，实时测试网络延迟性能',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
