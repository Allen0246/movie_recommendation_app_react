import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <>
      <Navbar />
      <main>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </>
  )
}
