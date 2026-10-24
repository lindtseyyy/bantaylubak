import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHealth, listEvents, type HealthResponse } from '../api'
import { Chip } from '../components/Chip'
import { unlockAudio } from '../lib/audio'
import { getGreeting } from '../lib/format'
import { useSettings } from '../lib/settings'

type SystemState = 'connecting' | 'ready' | 'offline'

export function HomeScreen() {
  const navigate = useNavigate()
  const { audioEnabled, toggleAudio } = useSettings()

  const [systemState, setSystemState] = useState<SystemState>('connecting')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [savedCount, setSavedCount] = useState<number>(0)

  useEffect(() => {
    const controller = new AbortController()

    void getHealth(controller.signal)
      .then((res) => {
        setHealth(res)
        setSystemState(res.status === 'ok' ? 'ready' : 'offline')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSystemState('offline')
        }
      })

    void listEvents(0, 0, controller.signal)
      .then((res) => {
        setSavedCount(res.total)
      })
      .catch(() => {
        // Leave savedCount at 0 when offline
      })

    return () => {
      controller.abort()
    }
  }, [])

  const handleStartScanning = () => {
    unlockAudio()
    navigate('/scan')
  }

  const handleToggleAudio = () => {
    unlockAudio()
    toggleAudio()
  }

  return (
    <main className="screen screen--home">
      <h1 className="home-greeting">{getGreeting()}</h1>

      <div className="chip-row home-status-row">
        {systemState === 'ready' ? (
          <Chip variant="teal">SYSTEM READY</Chip>
        ) : systemState === 'connecting' ? (
          <Chip variant="neutral">CONNECTING</Chip>
        ) : (
          <Chip variant="red">BACKEND OFFLINE</Chip>
        )}
        {health?.detector.placeholder ? (
          <Chip variant="neutral">DEMO MODEL</Chip>
        ) : null}
      </div>

      <section className="card home-hero-card">
        <div className="eyebrow eyebrow--amber">LIVE ROAD VIEW</div>
        <h2 className="headline-xl home-hero-card__title">
          A safer view
          <br />
          of every route.
        </h2>
        <p className="body-copy home-hero-card__copy">
          Start scanning to see road hazards highlighted in real time.
        </p>
        <button
          type="button"
          className="btn btn--amber home-hero-card__cta"
          onClick={handleStartScanning}
        >
          <span>Start live scanning</span>
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </section>

      <h2 className="section-heading home-activity-heading">Your activity</h2>

      <div className="home-activity-grid">
        <div className="card home-stat-card">
          <div className="home-stat-card__value">{savedCount}</div>
          <div className="home-stat-card__label">Saved detections</div>
        </div>

        <button
          type="button"
          className="card home-stat-card home-stat-card--interactive"
          onClick={handleToggleAudio}
          aria-pressed={audioEnabled}
        >
          <div className="home-stat-card__icon" aria-hidden="true">
            ♪
          </div>
          <div className="home-stat-card__label">
            {audioEnabled ? 'Audio alerts on' : 'Audio alerts off'}
          </div>
        </button>
      </div>
    </main>
  )
}
