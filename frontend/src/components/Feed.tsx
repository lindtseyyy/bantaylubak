import type { ReactNode } from 'react'

export interface FeedProps {
  mode?: 'DEMO' | 'LIVE'
  variant?: 'compact' | 'tall' | 'detail'
  caption?: string
  badge?: ReactNode
  /** Interactive control pinned top-right (e.g. camera switch). */
  action?: ReactNode
  children: ReactNode
}

export function Feed({
  mode = 'DEMO',
  variant = 'tall',
  caption,
  badge,
  action,
  children,
}: FeedProps) {
  return (
    <div className={`feed-frame feed-frame--${variant}`}>
      <div className="feed-frame__viewport">{children}</div>
      <div className="feed-frame__cam-pill">CAM 01 · {mode}</div>
      {caption ? (
        <>
          <span className="feed-frame__hud-tick feed-frame__hud-tick--left" aria-hidden="true" />
          <span className="feed-frame__hud-tick feed-frame__hud-tick--right" aria-hidden="true" />
          <div className="feed-frame__caption">{caption}</div>
        </>
      ) : null}
      {badge ? <div className="feed-frame__badge">{badge}</div> : null}
      {action ? <div className="feed-frame__action">{action}</div> : null}
    </div>
  )
}
