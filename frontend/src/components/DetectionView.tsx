import { useState } from 'react'
import type { Point } from '../api'

interface FrameSize {
  frameWidth: number
  frameHeight: number
}

export interface SegmentationShapeProps extends FrameSize {
  polygon: Point[]
}

/** Polygon + centroid crosshair in frame pixel space (an SVG `<g>`). */
export function SegmentationShape({
  polygon,
  frameWidth: w,
  frameHeight: h,
}: SegmentationShapeProps) {
  if (polygon.length < 3) return null

  const scaledPoints = polygon
    .map(([nx, ny]) => `${(nx * w).toFixed(2)},${(ny * h).toFixed(2)}`)
    .join(' ')
  const xs = polygon.map(([x]) => x * w)
  const ys = polygon.map(([, y]) => y * h)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // Crosshair sits at the mask's bounding-box center and scales with the mask (mockup ratios).
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const crossHalfX = (maxX - minX) * 0.2
  const crossHalfY = (maxY - minY) * 0.25
  const strokeW = Math.max((w / 312) * 3, 2.5)
  const crossW = Math.max((w / 312) * 2.4, 2)

  return (
    <g>
      <polygon
        points={scaledPoints}
        fill="var(--amber-line)"
        fillOpacity="0.3"
        stroke="var(--amber-line)"
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
      <line
        x1={cx - crossHalfX}
        y1={cy}
        x2={cx + crossHalfX}
        y2={cy}
        stroke="#e4d0a2"
        strokeWidth={crossW}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy - crossHalfY}
        x2={cx}
        y2={cy + crossHalfY}
        stroke="var(--amber-line)"
        strokeWidth={crossW}
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
    </g>
  )
}

export interface LiveOverlayProps {
  polygons: Point[][]
  frameWidth: number
  frameHeight: number
}

/** Overlay for a live `object-fit: cover` source; slice-crops identically. */
export function LiveOverlay({ polygons, frameWidth, frameHeight }: LiveOverlayProps) {
  return (
    <svg
      className="live-overlay"
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {polygons.map((polygon, i) => (
        <SegmentationShape
          key={i}
          polygon={polygon}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
        />
      ))}
    </svg>
  )
}

export interface DetectionViewProps {
  imageUrl: string
  polygon: Point[]
}

/** Stored frame image with its segmentation overlay. */
export function DetectionView({ imageUrl, polygon }: DetectionViewProps) {
  const [size, setSize] = useState<FrameSize | null>(null)

  return (
    <div className="detection-view">
      <img
        src={imageUrl}
        alt=""
        className="detection-view__probe"
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setSize({ frameWidth: img.naturalWidth, frameHeight: img.naturalHeight })
          }
        }}
      />
      {size ? (
        <svg
          className="detection-view__svg"
          viewBox={`0 0 ${size.frameWidth} ${size.frameHeight}`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="Detected road hazard segmentation overlay"
        >
          <image
            href={imageUrl}
            x="0"
            y="0"
            width={size.frameWidth}
            height={size.frameHeight}
            preserveAspectRatio="xMidYMid slice"
          />
          <SegmentationShape polygon={polygon} {...size} />
        </svg>
      ) : null}
    </div>
  )
}
