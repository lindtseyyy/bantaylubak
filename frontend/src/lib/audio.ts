declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (sharedContext && sharedContext.state !== 'closed') {
    return sharedContext
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  try {
    sharedContext = new AudioCtx()
    return sharedContext
  } catch {
    return null
  }
}

export function unlockAudio(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // ignore resume rejection outside gesture
    })
  }
}

export function playHazardBeep(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      // ignore
    })
  }

  const now = ctx.currentTime
  const pulseDuration = 0.085
  const pulseGap = 0.055

  for (let i = 0; i < 3; i++) {
    const start = now + i * (pulseDuration + pulseGap)
    const end = start + pulseDuration

    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(880, start)

    // Soften harsh upper harmonics for a clean square-ish pulse
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, start)

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
    gain.gain.setValueAtTime(0.18, end - 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(start)
    osc.stop(end + 0.005)
  }
}
