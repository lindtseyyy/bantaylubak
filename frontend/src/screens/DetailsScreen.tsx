import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, deleteEvent, getEvent, type DetectionEvent } from '../api'
import { Chip } from '../components/Chip'
import { DetectionView } from '../components/DetectionView'
import { Feed } from '../components/Feed'
import { ScreenHeader } from '../components/ScreenHeader'
import { capitalizeLabel, formatPercent, formatWhen } from '../lib/format'

export function DetailsScreen() {
  const { id } = useParams<{ id: string }>()

  const [event, setEvent] = useState<DetectionEvent | null>(null)
  const [notFound, setNotFound] = useState(!id)
  const [error, setError] = useState<string | null>(null)
  const [removeState, setRemoveState] = useState<'idle' | 'confirm' | 'removing'>('idle')
  const [removeError, setRemoveError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (removeState !== 'confirm') return
    const timer = window.setTimeout(() => setRemoveState('idle'), 3000)
    return () => window.clearTimeout(timer)
  }, [removeState])

  const handleRemove = async () => {
    if (!event) return
    if (removeState === 'idle') {
      setRemoveState('confirm')
      return
    }
    setRemoveState('removing')
    setRemoveError(null)
    try {
      await deleteEvent(event.id)
      navigate('/history', { replace: true })
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Unable to remove event')
      setRemoveState('idle')
    }
  }

  useEffect(() => {
    if (!id) {
      return
    }
    const controller = new AbortController()

    void getEvent(id, controller.signal)
      .then((data) => {
        setNotFound(false)
        setError(null)
        setEvent(data)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load event')
        }
      })

    return () => {
      controller.abort()
    }
  }, [id])

  if (notFound) {
    return (
      <main className="screen screen--details">
        <ScreenHeader
          title="Detection details"
          subtitle="Event not found"
          backTo="/history"
        />
        <section className="card details-card">
          <div className="details-field__value">Event not found</div>
        </section>
      </main>
    )
  }

  const codeDisplay = event?.code
    ? event.code.startsWith('#')
      ? event.code
      : `#${event.code}`
    : ''

  return (
    <main className="screen screen--details">
      <ScreenHeader
        title="Detection details"
        subtitle={event ? `Event ${codeDisplay}` : 'Loading event…'}
        backTo="/history"
      />

      {error ? (
        <section className="card details-card" role="alert">
          <div className="details-field__value">{error}</div>
        </section>
      ) : event ? (
        <>
          <Feed
            mode={event.detector === 'placeholder' ? 'DEMO' : 'LIVE'}
            variant="detail"
          >
            <DetectionView
              imageUrl={event.image_url}
              polygon={event.polygon}
            />
          </Feed>

          <div className="details-confidence-row">
            <Chip variant="amber">
              {formatPercent(event.confidence)} CONFIDENCE
            </Chip>
          </div>

          <section className="card details-card">
            <div className="details-field">
              <div className="details-field__label">CLASSIFICATION</div>
              <div className="details-field__value">
                {capitalizeLabel(event.label)}
              </div>
            </div>

            <div className="details-field">
              <div className="details-field__label">CAPTURED</div>
              <div className="details-field__value">
                {formatWhen(event.created_at)}
              </div>
            </div>

            <div className="details-field">
              <div className="details-field__label">SAVED RECORD</div>
              <div className="details-field__value details-field__value--italic">
                {event.image_path}
              </div>
            </div>
          </section>

          <div className="details-actions">
            <button
              type="button"
              className="btn btn--secondary details-actions__btn"
              onClick={() => navigate('/history')}
              disabled={removeState === 'removing'}
            >
              Keep
            </button>
            <button
              type="button"
              className="btn btn--danger details-actions__btn"
              onClick={() => void handleRemove()}
              disabled={removeState === 'removing'}
            >
              {removeState === 'removing'
                ? 'Removing…'
                : removeState === 'confirm'
                  ? 'Tap again to remove'
                  : 'Remove'}
            </button>
          </div>
          {removeError ? (
            <p className="details-actions__error" role="alert">
              Couldn't remove: {removeError}
            </p>
          ) : null}
        </>
      ) : (
        <section className="card details-card">
          <div className="details-field__value">Loading…</div>
        </section>
      )}
    </main>
  )
}
