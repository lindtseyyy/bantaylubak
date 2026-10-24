import { useEffect, useRef } from 'react'
import { drawRoadScene } from './drawRoadScene'

export interface RoadSceneProps {
  animate?: boolean
  width?: number
  height?: number
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
}

export function RoadScene({
  animate = false,
  width = 624,
  height = 734,
  canvasRef,
}: RoadSceneProps) {
  const internalRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = canvasRef ?? internalRef

  useEffect(() => {
    const canvas = targetRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!animate) {
      drawRoadScene(ctx, canvas.width, canvas.height, 0)
      return
    }

    let frameId = 0
    const start = performance.now()

    const render = (now: number) => {
      const elapsedSec = (now - start) / 1000
      drawRoadScene(ctx, canvas.width, canvas.height, elapsedSec)
      frameId = window.requestAnimationFrame(render)
    }

    drawRoadScene(ctx, canvas.width, canvas.height, 0)
    frameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [animate, width, height, targetRef])

  return (
    <canvas
      ref={targetRef}
      width={width}
      height={height}
      className="road-scene-canvas"
      aria-label="Road surface view"
    />
  )
}
