import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip } from '../components/Chip'
import { Feed } from '../components/Feed'
import { RoadScene } from '../components/RoadScene'
import { unlockAudio } from '../lib/audio'
import { requestCameraPermissionOnce } from '../lib/camera'
import { setOnboarded } from '../lib/settings'

export function WelcomeScreen() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const handleContinue = async () => {
    if (submitting) return
    setSubmitting(true)
    unlockAudio()
    try {
      await requestCameraPermissionOnce()
    } catch {
      // Ignore permission rejection; Scan screen falls back to demo scene
    }
    setOnboarded(true)
    navigate('/', { replace: true })
  }

  return (
    <main className="screen screen--welcome">
      <div className="welcome-brand">BANTAYLUBAK</div>

      <div className="welcome-chip-row">
        <Chip variant="amber">DRIVER ASSIST</Chip>
      </div>

      <h1 className="headline-xl welcome-headline">
        See the road
        <br />
        ahead clearly.
      </h1>

      <p className="body-copy welcome-copy">
        Real-time pothole detection with visual and audio alerts.
      </p>

      <div className="welcome-feed">
        <Feed mode="DEMO" variant="compact">
          <RoadScene animate={false} width={312} height={190} />
        </Feed>
      </div>

      <section className="card welcome-card" aria-label="Permissions notice">
        <h2 className="welcome-card__title">Before your first drive</h2>
        <p className="welcome-card__copy">
          Allow camera access for scanning. Alerts use device audio.
        </p>
      </section>

      <button
        type="button"
        className="btn btn--amber welcome-cta"
        onClick={() => void handleContinue()}
        disabled={submitting}
      >
        Continue to dashboard
      </button>
    </main>
  )
}
