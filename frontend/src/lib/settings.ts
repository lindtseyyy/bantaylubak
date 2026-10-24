import { useCallback, useEffect, useState } from 'react'

const ONBOARDED_KEY = 'bantaylubak.onboarded'
const AUDIO_ENABLED_KEY = 'bantaylubak.audioEnabled'
const SETTINGS_EVENT = 'bantaylubak:settings-change'

export function getOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setOnboarded(value: boolean): void {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, value ? 'true' : 'false')
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

export function getAudioEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(AUDIO_ENABLED_KEY)
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

export function setAudioEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(AUDIO_ENABLED_KEY, value ? 'true' : 'false')
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

export interface SettingsState {
  onboarded: boolean
  audioEnabled: boolean
  setOnboarded: (value: boolean) => void
  setAudioEnabled: (value: boolean) => void
  toggleAudio: () => void
}

export function useSettings(): SettingsState {
  const [onboarded, setOnboardedState] = useState<boolean>(() => getOnboarded())
  const [audioEnabled, setAudioEnabledState] = useState<boolean>(() =>
    getAudioEnabled(),
  )

  useEffect(() => {
    const sync = () => {
      setOnboardedState(getOnboarded())
      setAudioEnabledState(getAudioEnabled())
    }
    window.addEventListener(SETTINGS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const updateOnboarded = useCallback((value: boolean) => {
    setOnboarded(value)
  }, [])

  const updateAudioEnabled = useCallback((value: boolean) => {
    setAudioEnabled(value)
  }, [])

  const toggleAudio = useCallback(() => {
    setAudioEnabled(!getAudioEnabled())
  }, [])

  return {
    onboarded,
    audioEnabled,
    setOnboarded: updateOnboarded,
    setAudioEnabled: updateAudioEnabled,
    toggleAudio,
  }
}
