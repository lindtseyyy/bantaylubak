import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createEvent, detectFrame, type Detection } from '../api'
import { Chip } from '../components/Chip'
import { LiveOverlay } from '../components/DetectionView'
import { Feed } from '../components/Feed'
import { RoadScene } from '../components/RoadScene'
import { ScreenHeader } from '../components/ScreenHeader'
import { playHazardBeep, unlockAudio } from '../lib/audio'
import { useCamera, type CameraFacing } from '../lib/camera'
import { SwitchCameraIcon } from '../components/icons'
import { capitalizeLabel, formatPercent } from '../lib/format'
import { getAudioEnabled, useSettings } from '../lib/settings'

/** A hit later than this after the previous hit is a new pothole: beep + auto-save. */
const EPISODE_GAP_MS = 3000
/** Keep the hazard UI up this long after the last hit. */
const HAZARD_HOLD_MS = 1500
const MIN_FRAME_INTERVAL_MS = 250

interface Hazard {
  /** Sorted by confidence, highest first (API contract). */
  detections: Detection[]
  frameWidth: number
  frameHeight: number
}

type AutoSave =
  | { status: 'saving' }
  | { status: 'saved'; id: number; code: string }
  | { status: 'error'; message: string }

interface CapturedFrame {
  blob: Blob
  width: number
  height: number
}

function captureElementToJpegBlob(
  source: HTMLVideoElement | HTMLCanvasElement,
  offscreen: HTMLCanvasElement,
): Promise<CapturedFrame | null> {
  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height

  if (!srcW || !srcH) {
    return Promise.resolve(null)
  }

  const scale = srcW > 640 ? 640 / srcW : 1
  const targetW = Math.max(1, Math.round(srcW * scale))
  const targetH = Math.max(1, Math.round(srcH * scale))

  if (offscreen.width !== targetW) offscreen.width = targetW
  if (offscreen.height !== targetH) offscreen.height = targetH

  const ctx = offscreen.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.drawImage(source, 0, 0, targetW, targetH)

  const { promise, resolve } = Promise.withResolvers<CapturedFrame | null>()
  offscreen.toBlob(
    (blob) => resolve(blob ? { blob, width: targetW, height: targetH } : null),
    'image/jpeg',
    0.8,
  )
  return promise
}

export function ScanScreen() {
  const { audioEnabled, toggleAudio } = useSettings()
  const [facing, setFacing] = useState<CameraFacing>('environment')
  const { stream, ready: cameraReady, canSwitch } = useCamera(true, facing)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const demoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const mountedRef = useRef(true)
  const lastHitAtRef = useRef<number | null>(null)
  const hazardTimerRef = useRef<number | undefined>(undefined)

  const [hazard, setHazard] = useState<Hazard | null>(null)
  const [autoSave, setAutoSave] = useState<AutoSave | null>(null)
  const [backendError, setBackendError] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      window.clearTimeout(hazardTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !stream) return
    videoEl.srcObject = stream
    void videoEl.play().catch(() => {
      // Autoplay may be blocked until a gesture; the muted inline video usually plays.
    })
  }, [stream])

  const autoSaveFrame = useCallback(
    (frame: Blob, detection: Detection, detector: string) => {
      setAutoSave({ status: 'saving' })
      // Saves are not aborted on unmount: a detected pothole is always recorded.
      createEvent({
        frame,
        confidence: detection.confidence,
        label: detection.label,
        polygon: detection.polygon,
        box: detection.box,
        detector,
      })
        .then((saved) => {
          if (mountedRef.current) {
            setAutoSave({ status: 'saved', id: saved.id, code: saved.code })
          }
        })
        .catch((err: unknown) => {
          if (mountedRef.current) {
            setAutoSave({
              status: 'error',
              message: err instanceof Error ? err.message : 'unknown error',
            })
          }
        })
    },
    [],
  )

  const handleHit = useCallback(
    (detections: Detection[], frame: CapturedFrame, detector: string, frameWidth: number, frameHeight: number) => {
      const now = performance.now()
      const lastHitAt = lastHitAtRef.current
      lastHitAtRef.current = now

      setHazard({ detections, frameWidth, frameHeight })
      window.clearTimeout(hazardTimerRef.current)
      hazardTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setHazard(null)
      }, HAZARD_HOLD_MS)

      if (lastHitAt === null || now - lastHitAt > EPISODE_GAP_MS) {
        if (getAudioEnabled()) playHazardBeep()
        autoSaveFrame(frame.blob, detections[0], detector)
      }
    },
    [autoSaveFrame],
  )

  // Continuous detection loop: sequential, one request in flight, never paused by hits.
  useEffect(() => {
    if (!cameraReady) return

    let active = true
    const abortController = new AbortController()
    const offscreen = document.createElement('canvas')
    let timerId: number | undefined

    const step = async () => {
      const startedAt = performance.now()
      const videoEl = videoRef.current
      const source =
        stream && videoEl && videoEl.readyState >= 2 ? videoEl : demoCanvasRef.current

      if (source) {
        const captured = await captureElementToJpegBlob(source, offscreen)
        if (!active) return
        if (captured) {
          try {
            const result = await detectFrame(captured.blob, abortController.signal)
            if (!active) return
            setBackendError(false)
            if (result.detections.length > 0) {
              handleHit(
                result.detections,
                captured,
                result.detector,
                result.frame_width || captured.width,
                result.frame_height || captured.height,
              )
            }
          } catch {
            if (!active) return
            setBackendError(true)
          }
        }
      }

      if (!active) return
      const elapsed = performance.now() - startedAt
      timerId = window.setTimeout(
        () => void step(),
        Math.max(0, MIN_FRAME_INTERVAL_MS - elapsed),
      )
    }

    timerId = window.setTimeout(() => void step(), MIN_FRAME_INTERVAL_MS)

    return () => {
      active = false
      abortController.abort()
      window.clearTimeout(timerId)
    }
  }, [cameraReady, stream, handleHit])

  const handleToggleAudio = useCallback(() => {
    unlockAudio()
    toggleAudio()
  }, [toggleAudio])

  const top = hazard?.detections[0]
  const pct = top ? formatPercent(top.confidence) : ''
  const label = top?.label || 'pothole'
  const hazardCount = hazard?.detections.length ?? 0

  return (
    <main className="screen screen--scan">
      <ScreenHeader
        title={hazard ? 'Pothole detected' : 'Live scanning'}
        subtitle={hazard ? 'Visual and audio warning' : 'Camera feed'}
        backTo="/"
      />

      <div className="chip-row chip-row--spread">
        {hazard ? (
          <Chip variant="red">HAZARD AHEAD</Chip>
        ) : (
          <Chip variant="teal">SCANNING</Chip>
        )}
        {hazard && audioEnabled ? (
          <Chip variant="amber" onClick={handleToggleAudio}>
            BEEP ACTIVE
          </Chip>
        ) : (
          <Chip variant="neutral" onClick={handleToggleAudio}>
            {audioEnabled ? 'AUDIO ON' : 'AUDIO OFF'}
          </Chip>
        )}
      </div>

      <Feed
        mode={stream ? 'LIVE' : 'DEMO'}
        variant="tall"
        caption={hazard ? undefined : 'Road surface in view'}
        badge={
          hazard ? (
            <div className="detection-badge">
              {label.toUpperCase()} · {pct}
            </div>
          ) : undefined
        }
        action={
          stream && canSwitch ? (
            <button
              type="button"
              className="camera-switch"
              onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}
              disabled={!cameraReady}
              aria-label={facing === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
              title={facing === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
            >
              <SwitchCameraIcon />
            </button>
          ) : undefined
        }
      >
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="scan-video"
          />
        ) : (
          <RoadScene
            animate={true}
            width={312}
            height={367}
            canvasRef={demoCanvasRef}
          />
        )}
        {hazard ? (
          <LiveOverlay
            polygons={hazard.detections.map((d) => d.polygon)}
            frameWidth={hazard.frameWidth}
            frameHeight={hazard.frameHeight}
          />
        ) : null}
      </Feed>

      {hazard ? (
        <section className="card scan-result-card" aria-live="assertive">
          <div className="eyebrow eyebrow--dim">SEGMENTATION RESULT</div>
          <div className="scan-result-card__text">
            {hazardCount > 1
              ? `${hazardCount} ${label}s ahead · top confidence ${pct}`
              : `${capitalizeLabel(label)} ahead · confidence ${pct}`}
          </div>
        </section>
      ) : (
        <section
          className={`card scan-status-card ${backendError ? 'scan-status-card--error' : ''}`}
          aria-live="polite"
        >
          <span
            className={`status-dot ${backendError ? 'status-dot--error' : 'status-dot--teal'}`}
            aria-hidden="true"
          />
          <span className="scan-status-card__text">
            {backendError
              ? 'Backend unreachable — retrying'
              : 'Analyzing video frames'}
          </span>
        </section>
      )}

      {autoSave ? (
        <p
          className={`scan-autosave ${autoSave.status === 'error' ? 'scan-autosave--error' : ''}`}
          role="status"
        >
          {autoSave.status === 'saving' ? (
            'Saving detection…'
          ) : autoSave.status === 'saved' ? (
            <>
              Auto-saved #{autoSave.code} ·{' '}
              <Link to={`/history/${autoSave.id}`}>Review</Link>
            </>
          ) : (
            `Couldn't save detection: ${autoSave.message}`
          )}
        </p>
      ) : null}
    </main>
  )
}
