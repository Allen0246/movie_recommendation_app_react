import { Link, useRouteError } from 'react-router-dom'

export function ErrorPage() {
  const error = useRouteError()
  console.error(error)

  return (
    <section className="page" style={{ textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred.</p>
      <Link className="btn" to="/">
        Go home
      </Link>
    </section>
  )
}
