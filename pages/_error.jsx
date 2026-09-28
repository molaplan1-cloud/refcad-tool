// Pages Router fallback error page.
// next-on-pages 1.13.15 generates a /_error route automatically when wrapping
// the Next.js build. Without this file, that route has no runtime export and
// fails with:
//   The following routes were not configured to run with the Edge Runtime:
//     - /_error
//
// Pages Router and App Router can coexist; this only handles the auto-generated
// fallback while app/error.jsx and app/global-error.jsx handle App Router errors.

export const config = {
  runtime: 'experimental-edge',
}

function Error({ statusCode }) {
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
        {statusCode || 'Virhe'}
      </h1>
      <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
        {statusCode === 404 ? 'Sivua ei löytynyt' : 'Tapahtui odottamaton virhe'}
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

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
