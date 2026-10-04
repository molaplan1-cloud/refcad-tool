import './globals.css'
import { LocaleProvider } from '@/components/i18n/Locale'

export const metadata = {
  title: 'RefCAD',
  description: 'Piirrä kylmiö, talo tai halli. Pohjakuva on ilmainen, talotekniikka ja kylmätekniikka avautuvat kuitatun maksun jälkeen.',
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
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', background: '#0a0f1e', color: '#f1f5f9', minHeight: '100vh' }}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}
