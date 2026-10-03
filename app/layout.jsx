import './globals.css'
import { LocaleProvider } from '@/components/i18n/Locale'

export const metadata = {
  title: 'RefCAD Tool | Cold Room Designer',
  description: 'Design the room around the business, not the enquiry. RefCAD Tool turns the discovery conversation into the cold room layout for refrigeration contractors.',
  manifest: '/manifest.json'
}

export const viewport = {
  themeColor: '#0a0f1e',
  width: 'device-width',
  initialScale: 1
}

export default function RootLayout({ children }) {
  return (
    <html lang="fi" className="dark">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', background: '#0a0f1e', color: '#f1f5f9', overflow: 'hidden', height: '100vh' }}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}
