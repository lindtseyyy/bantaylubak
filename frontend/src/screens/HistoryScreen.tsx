import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEvents, type DetectionEvent } from '../api'
import { ScreenHeader } from '../components/ScreenHeader'
import { formatPercent, formatWhen } from '../lib/format'

const PAGE_SIZE = 50

interface EventThumbnailProps {
  imageUrl: string
  code: string
  isNewest: boolean
}

function EventThumbnail({ imageUrl, code, isNewest }: EventThumbnailProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className={`history-thumb ${isNewest ? 'history-thumb--newest' : ''}`}
    >
      {!imgError && imageUrl ? (
        <img
          src={imageUrl}
          alt={`Frame for ${code}`}
          className="history-thumb__img"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="history-thumb__bar" aria-hidden="true" />
      )}
    </div>
  )
}

export function HistoryScreen() {
  const navigate = useNavigate()

  const [items, setItems] = useState<DetectionEvent[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void listEvents(PAGE_SIZE, 0, controller.signal)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Unable to load event history',
        )
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [])

  const handleLoadMore = async () => {
    if (loadingMore || items.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listEvents(PAGE_SIZE, items.length)
      setItems((prev) => [...prev, ...res.items])
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  const countLabel = `${total} ${total === 1 ? 'detection' : 'detections'}`

  return (
    <main className="screen screen--history">
      <ScreenHeader
        title="Detection history"
        subtitle="Saved events on this device"
        backTo="/"
      />

      <h2 className="history-count">{countLabel}</h2>

      {error ? (
        <div className="card history-empty-card" role="alert">
          <p className="history-empty-card__title">{error}</p>
        </div>
      ) : loading ? (
        <div className="card history-empty-card">
          <p className="history-empty-card__title">Loading detections…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card history-empty-card">
          <p className="history-empty-card__title">No detections yet</p>
          <Link to="/scan" className="history-empty-card__link">
            Start live scanning →
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {items.map((item, idx) => {
            const codeDisplay = item.code.startsWith('#')
              ? item.code
              : `#${item.code}`
            const sourceTag =
              item.detector === 'placeholder' ? 'sample' : 'model'

            return (
              <button
                key={item.id}
                type="button"
                className="card history-card"
                onClick={() => navigate(`/history/${item.id}`)}
              >
                <EventThumbnail
                  imageUrl={item.image_url}
                  code={codeDisplay}
                  isNewest={idx === 0}
                />
                <div className="history-card__body">
                  <div className="history-card__code">{codeDisplay}</div>
                  <div className="history-card__meta">
                    Road surface · {sourceTag}
                  </div>
                  <div className="history-card__time">
                    {formatWhen(item.created_at)}
                  </div>
                </div>
                <span className="history-card__pill">
                  {formatPercent(item.confidence)}
                </span>
              </button>
            )
          })}

          {total > items.length ? (
            <button
              type="button"
              className="btn btn--secondary history-load-more"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      )}
    </main>
  )
}
