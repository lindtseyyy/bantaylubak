export function drawRoadScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t = 0,
): void {
  const s = w / 312
  const horizonY = Math.round(h * 0.418)
  const topBarH = Math.round(40 * s)
  const horizonBandH = Math.round(23 * s)

  ctx.save()

  // 1. Sky base
  ctx.fillStyle = '#46535a'
  ctx.fillRect(0, 0, w, horizonY)

  // 2. Soft big cloud ellipse in upper-right sky
  ctx.fillStyle = '#586668'
  ctx.beginPath()
  const cloudCx = w * 0.641
  const cloudCy = horizonY * 0.54
  const cloudRx = w * 0.301
  const cloudRy = Math.max(horizonY * 0.46, 36 * s)
  ctx.ellipse(cloudCx, cloudCy, cloudRx, cloudRy, 0, 0, Math.PI * 2)
  ctx.fill()

  // 3. Top dark shade strip (produces #30393e sky top and #3a4446 cloud top)
  ctx.fillStyle = 'rgba(23, 26, 29, 0.46)'
  ctx.fillRect(0, 0, w, topBarH)

  // 4. Distant horizon band just above the road
  ctx.fillStyle = '#2a3337'
  ctx.fillRect(0, horizonY - horizonBandH, w, horizonBandH)

  // 5. Building blocks left and right (#303a3e)
  ctx.fillStyle = '#303a3e'
  // Left buildings
  ctx.fillRect(0, horizonY - 53 * s, 30 * s, 45 * s)
  ctx.fillRect(42 * s, horizonY - 43 * s, 25 * s, 43 * s)
  ctx.fillRect(87 * s, horizonY - 53 * s, 42 * s, 45 * s)
  // Right buildings
  ctx.fillRect(253 * s, horizonY - 43 * s, 29 * s, 43 * s)
  ctx.fillRect(282 * s, horizonY - 53 * s, 11 * s, 53 * s)
  ctx.fillRect(293 * s, horizonY - 53 * s, 16 * s, 45 * s)

  // 7. Dark roadside ground (#222b2e)
  ctx.fillStyle = '#222b2e'
  ctx.fillRect(0, horizonY, w, h - horizonY)

  // 8. Road bed (#30383c)
  ctx.fillStyle = '#30383c'
  ctx.fillRect(58 * s, horizonY, 196 * s, h - horizonY)

  // 9. Two converging side lane lines (#848d87)
  ctx.strokeStyle = '#848d87'
  ctx.lineWidth = Math.max(2 * s, 1.5)
  ctx.lineCap = 'round'
  const roadDepth = h - horizonY
  const laneSpread = (47 + 17 * Math.max(0, Math.min(1, (roadDepth - 106) / 108))) * s
  const laneStartY = horizonY + 16 * s
  ctx.beginPath()
  ctx.moveTo(110 * s, laneStartY)
  ctx.lineTo(110 * s - laneSpread, h)
  ctx.moveTo(202 * s, laneStartY)
  ctx.lineTo(202 * s + laneSpread, h)
  ctx.stroke()

  // 10. Center dashed line (#afab9b) whose dashes animate toward the viewer with t
  ctx.fillStyle = '#afab9b'
  const dashStartBase = horizonY + roadDepth * 0.12
  const dashSpan = h - dashStartBase

  // Phase advances smoothly with t (in seconds); t=0 gives static mockup positions
  const phase = ((t * 0.85) % 1 + 1) % 1
  const dashCount = 3

  for (let i = 0; i < dashCount; i++) {
    const rawPos = (i + phase) / dashCount
    // Perspective mapping so dashes accelerate and grow toward viewer
    const p = Math.pow(rawPos, 1.18)
    const dashY = dashStartBase + p * dashSpan
    const dashLen = (14 + p * 28) * (roadDepth / 214)
    const dashW = (4 + p * 4) * s
    const dashX = w * 0.5 - dashW * 0.5
    const radius = Math.min(dashW * 0.45, 3 * s)

    const clampedY = Math.min(dashY, h)
    const clampedLen = Math.max(0, Math.min(dashLen, h - clampedY + 4 * s))
    if (clampedLen > 1) {
      ctx.beginPath()
      ctx.roundRect(dashX, clampedY, dashW, clampedLen, radius)
      ctx.fill()
    }
  }

  ctx.restore()
}
