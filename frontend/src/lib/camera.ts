import { useEffect, useRef, useState } from 'react'

/** `environment` = rear camera, `user` = front camera. */
export type CameraFacing = 'environment' | 'user'

/**
 * Opens the camera facing `facing`. If the device can't satisfy that (no facing metadata,
 * e.g. most laptop/USB webcams) and `previousDeviceId` is given, switches to a different
 * camera instead so the user-visible "switch" still changes the view.
 */
export async function openCameraStream(
  facing: CameraFacing = 'environment',
  previousDeviceId?: string,
): Promise<MediaStream | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return null
  }
  try {
    // `exact` so phones really switch lenses; devices without that camera fall back below.
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facing } },
      audio: false,
    })
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') return null
  }
  const otherDeviceId = previousDeviceId
    ? (await listVideoInputIds()).find((id) => id !== previousDeviceId)
    : undefined
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: otherDeviceId ? { deviceId: { exact: otherDeviceId } } : { facingMode: facing },
      audio: false,
    })
  } catch {
    return null
  }
}

export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // ignore stop errors
    }
  }
}

export async function requestCameraPermissionOnce(): Promise<void> {
  const stream = await openCameraStream()
  stopCameraStream(stream)
}

async function listVideoInputIds(): Promise<string[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((device) => device.kind === 'videoinput' && device.deviceId)
      .map((device) => device.deviceId)
  } catch {
    return []
  }
}

export interface CameraState {
  /** While switching, keeps the previous (stopped) stream so the feed doesn't flash. */
  stream: MediaStream | null
  /** False while a stream is being opened; frame capture should wait. */
  ready: boolean
  /** More than one camera is available, so switching facing can change the view. */
  canSwitch: boolean
}

interface OpenedCamera {
  stream: MediaStream | null
  facing: CameraFacing
  canSwitch: boolean
}

export function useCamera(active: boolean, facing: CameraFacing): CameraState {
  const [opened, setOpened] = useState<OpenedCamera | null>(null)
  // Device of the last opened stream; used to pick "the other camera" on devices without facing metadata.
  const deviceIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!active) {
      return
    }

    let cancelled = false
    let currentStream: MediaStream | null = null

    void openCameraStream(facing, deviceIdRef.current).then(async (mediaStream) => {
      if (cancelled) {
        stopCameraStream(mediaStream)
        return
      }
      currentStream = mediaStream
      deviceIdRef.current = mediaStream?.getVideoTracks()[0]?.getSettings().deviceId
      // Device lists are only complete after permission is granted.
      const canSwitch = mediaStream ? (await listVideoInputIds()).length > 1 : false
      if (cancelled) return
      setOpened({ stream: mediaStream, facing, canSwitch })
    })

    return () => {
      cancelled = true
      stopCameraStream(currentStream)
    }
  }, [active, facing])

  return {
    stream: opened?.stream ?? null,
    ready: active && opened?.facing === facing,
    canSwitch: opened?.canSwitch ?? false,
  }
}
