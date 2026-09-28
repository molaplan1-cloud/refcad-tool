'use client'

// Global error boundary for the root layout.
// Cloudflare's @cloudflare/next-on-pages 1.13.15 flags /_error as missing
// edge runtime if no explicit global error page exists. This must be a Client
// Component and must include html/body tags (it replaces the root layout).

export default function GlobalError({ error, reset }) {
  return (
    <html lang="fi">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f1f5f9',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, color: '#f87171' }}>
          Sovellusvirhe
        </h1>
        <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
          Jotain meni pieleen. Yritä ladata sivu uudelleen.
        </p>
        {error?.message && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              color: '#fca5a5',
              maxWidth: '600px',
              overflow: 'auto',
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          onClick={() => reset?.()}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            background: '#22d3ee',
            color: '#0f172a',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Lataa uudelleen
        </button>
      </body>
    </html>
  )
}
