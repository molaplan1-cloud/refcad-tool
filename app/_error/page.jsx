// Custom /_error route for App Router.
// next-on-pages 1.13.15 detects an auto-generated /_error.func route that
// lacks edge runtime config. By providing app/_error/page.jsx with the
// runtime export, we let next-on-pages see a properly-configured source.

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default function Error() {
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
      <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, color: '#f87171' }}>
        Virhe
      </h1>
      <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
        Tapahtui odottamaton virhe
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
