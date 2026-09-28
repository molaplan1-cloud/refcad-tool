// Pages Router 500 page (used by Vercel/next-on-pages fallback for the /_error route).

export const config = {
  runtime: 'experimental-edge',
}

export default function ServerError() {
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
      <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, color: '#f87171' }}>500</h1>
      <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
        Palvelinvirhe
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
