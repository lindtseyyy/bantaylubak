import { Link, useLocation } from 'react-router-dom'
import { HistoryIcon, HomeIcon, ScanIcon } from './icons'

export function BottomNav() {
  const { pathname } = useLocation()

  if (pathname === '/welcome') {
    return null
  }

  const isHome = pathname === '/'
  const isScan = pathname.startsWith('/scan')
  const isHistory = pathname.startsWith('/history')

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div className="bottom-nav__inner">
        <Link
          to="/"
          className={`bottom-nav__item ${isHome ? 'bottom-nav__item--active' : ''}`}
          aria-current={isHome ? 'page' : undefined}
        >
          <span className="bottom-nav__pill">
            <HomeIcon />
          </span>
          <span className="bottom-nav__label">Home</span>
        </Link>

        <Link
          to="/scan"
          className={`bottom-nav__item ${isScan ? 'bottom-nav__item--active' : ''}`}
          aria-current={isScan ? 'page' : undefined}
        >
          <span className="bottom-nav__pill">
            <ScanIcon />
          </span>
          <span className="bottom-nav__label">Scan</span>
        </Link>

        <Link
          to="/history"
          className={`bottom-nav__item ${isHistory ? 'bottom-nav__item--active' : ''}`}
          aria-current={isHistory ? 'page' : undefined}
        >
          <span className="bottom-nav__pill">
            <HistoryIcon />
          </span>
          <span className="bottom-nav__label">History</span>
        </Link>
      </div>
    </nav>
  )
}
