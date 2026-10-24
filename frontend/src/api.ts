export type Point = [number, number]
export type BoundingBox = [number, number, number, number]

export interface DetectorInfo {
  name: 'placeholder' | 'yolo26s-seg' | string
  placeholder: boolean
  weights_path: string | null
}

export interface HealthResponse {
  status: 'ok' | string
  version: string
  detector: DetectorInfo
  confidence_threshold: number
}

export interface Detection {
  label: string
  confidence: number
  box: BoundingBox
  polygon: Point[]
}

export interface DetectResponse {
  detections: Detection[]
  inference_ms: number
  frame_width: number
  frame_height: number
  detector: string
}

export interface DetectionEvent {
  id: number
  code: string
  label: string
  confidence: number
  created_at: string
  image_url: string
  image_path: string
  polygon: Point[]
  box: BoundingBox
  detector: string
}

export interface EventListResponse {
  total: number
  items: DetectionEvent[]
}

export interface CreateEventInput {
  frame: Blob
  confidence: number
  label?: string
  polygon: Point[]
  box: BoundingBox
  detector: string
}

export class ApiError extends Error {
  readonly status: number
  readonly detail?: string

  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: string | undefined
    try {
      const data: unknown = await response.json()
      if (typeof data === 'object' && data !== null && 'detail' in data) {
        if (typeof data.detail === 'string') {
          detail = data.detail
        } else if (data.detail !== undefined) {
          detail = JSON.stringify(data.detail)
        }
      }
    } catch {
      try {
        const text = await response.text()
        if (text) detail = text
      } catch {
        // ignore body read error
      }
    }
    throw new ApiError(
      response.status,
      detail || `Request failed with status ${response.status}`,
      detail,
    )
  }
  return (await response.json()) as T
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  return parseResponse<HealthResponse>(response)
}

export async function detectFrame(
  blob: Blob,
  signal?: AbortSignal,
): Promise<DetectResponse> {
  const form = new FormData()
  form.append('frame', blob, 'frame.jpg')
  const response = await fetch('/api/detect', {
    method: 'POST',
    body: form,
    signal,
  })
  return parseResponse<DetectResponse>(response)
}

export async function createEvent(
  input: CreateEventInput,
): Promise<DetectionEvent> {
  const form = new FormData()
  form.append('frame', input.frame, 'capture.jpg')
  form.append('confidence', String(input.confidence))
  form.append('label', input.label ?? 'pothole')
  form.append('polygon', JSON.stringify(input.polygon))
  form.append('box', JSON.stringify(input.box))
  form.append('detector', input.detector)

  const response = await fetch('/api/events', {
    method: 'POST',
    body: form,
  })
  return parseResponse<DetectionEvent>(response)
}

export async function listEvents(
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<EventListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const response = await fetch(`/api/events?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  return parseResponse<EventListResponse>(response)
}

export async function getEvent(
  id: number | string,
  signal?: AbortSignal,
): Promise<DetectionEvent> {
  const response = await fetch(`/api/events/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  return parseResponse<DetectionEvent>(response)
}

export async function deleteEvent(
  id: number | string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/events/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    signal,
  })
  if (!response.ok) {
    await parseResponse<never>(response)
  }
}
