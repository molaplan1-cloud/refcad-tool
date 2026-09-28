// Custom 404 page that opts into Edge runtime explicitly.
// Cloudflare's @cloudflare/next-on-pages 1.13.15 requires every non-static
// route — including the auto-generated /_not-found — to declare edge runtime.
// Without this file, the build fails with:
//   The following routes were not configured to run with the Edge Runtime:
//     - /_not-found

export default function NotFound() {
  return (
    <div
      style={{
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
      <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, color: '#22d3ee' }}>
        404
      </h1>
      <p style={{ fontSize: '1.25rem', marginTop: '1rem', color: '#94a3b8' }}>
        Sivua ei löytynyt
      </p>
      <a
        href="/"
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#22d3ee',
          color: '#0f172a',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Takaisin etusivulle
      </a>
    </div>
  )
}
