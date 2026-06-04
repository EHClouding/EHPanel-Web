const BASE_URL = import.meta.env.VITE_API_URL ?? ""
export const SESSION_EXPIRED_EVENT = "ehpanel:session-expired"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

const ACCESS_KEY = "eh_access"
const REFRESH_KEY = "eh_refresh"

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

type RequestOptions = RequestInit & {
  auth?: boolean
  retry?: boolean
}

export type UploadProgress = {
  loaded: number
  percent: number
  total: number
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && options.retry !== false) {
    const refreshed = await refreshToken()
    if (refreshed) {
      return apiFetch<T>(path, { ...options, retry: false })
    }
    throw new ApiError(401, "Tu sesion expiro. Inicia sesion nuevamente.")
  }

  if (!response.ok) {
    const message = await readError(response.clone())
    if (response.status === 403 && options.retry !== false && isTokenError(message)) {
      const refreshed = await refreshToken()
      if (refreshed) {
        return apiFetch<T>(path, { ...options, retry: false })
      }
      throw new ApiError(401, "Tu sesion expiro. Inicia sesion nuevamente.")
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function rawApiRequest<T>(
  path: string,
  options: {
    body?: XMLHttpRequestBodyInit | null
    method?: string
    onProgress?: (progress: UploadProgress) => void
  } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = `${BASE_URL}/api${path}`
    xhr.open(options.method ?? "GET", url)

    const token = tokenStorage.getAccess()
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        options.onProgress?.({ loaded: event.loaded, percent: 0, total: 0 })
        return
      }
      options.onProgress?.({
        loaded: event.loaded,
        percent: Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
        total: event.total,
      })
    }

    xhr.onerror = () => reject(new ApiError(0, `No se pudo conectar con el servidor (${url}).`))
    xhr.onload = () => {
      if (xhr.status === 401) {
        reject(new ApiError(401, "Tu sesion expiro. Inicia sesion nuevamente."))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(xhr.status, readXhrError(xhr)))
        return
      }
      if (xhr.status === 204 || !xhr.responseText) {
        resolve(undefined as T)
        return
      }
      try {
        resolve(JSON.parse(xhr.responseText) as T)
      } catch {
        reject(new ApiError(xhr.status, "Respuesta invalida del servidor."))
      }
    }
    xhr.send(options.body ?? null)
  })
}

function readXhrError(xhr: XMLHttpRequest) {
  const contentType = xhr.getResponseHeader("Content-Type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const data = JSON.parse(xhr.responseText) as Record<string, unknown>
      const detail = data.detail ?? data.error ?? data.message
      if (typeof detail === "string") return detail
    } catch {
      return `Error HTTP ${xhr.status}`
    }
  }
  const body = xhr.responseText.trim()
  if (!body) return `Error HTTP ${xhr.status}`
  if (body.startsWith("<!doctype html") || body.startsWith("<html")) return `Error HTTP ${xhr.status}`
  return body.length > 300 ? `${body.slice(0, 300)}...` : body
}

function isTokenError(message: string) {
  const value = message.toLowerCase()
  return value.includes("token not valid") || value.includes("given token") || value.includes("token type")
}

async function rawFetch(path: string, options: RequestOptions) {
  const headers = new Headers(options.headers)
  const token = tokenStorage.getAccess()
  const url = `${BASE_URL}/api${path}`

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
    })
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` Detalle: ${error.message}` : ""
    throw new ApiError(0, `No se pudo conectar con el servidor (${url}).${detail}`)
  }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshToken() {
  if (refreshPromise) return refreshPromise

  refreshPromise = requestTokenRefresh().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function requestTokenRefresh() {
  const refresh = tokenStorage.getRefresh()

  if (!refresh) {
    clearSession()
    return false
  }

  try {
    const url = `${BASE_URL}/api/auth/refresh/`
    const response = await fetch(url, {
      body: JSON.stringify({ refresh }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })

    if (!response.ok) {
      clearSession()
      return false
    }

    const data = (await response.json()) as { access: string }
    tokenStorage.setAccess(data.access)
    return true
  } catch {
    clearSession()
    return false
  }
}

async function readError(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? ""

  if (contentType.includes("application/json")) {
    try {
      const data = (await response.json()) as Record<string, unknown>
      const detail = data.detail ?? data.error ?? data.message
      if (typeof detail === "string") return detail

      const firstFieldError = Object.values(data).flat().find((value) => typeof value === "string")
      return typeof firstFieldError === "string" ? firstFieldError : `Error HTTP ${response.status}`
    } catch {
      return `Error HTTP ${response.status}`
    }
  }

  const body = (await response.text()).trim()
  if (!body) return `Error HTTP ${response.status}`
  if (body.startsWith("<!doctype html") || body.startsWith("<html")) {
    if (response.status >= 500) return "Error interno del servidor."
    return `Error HTTP ${response.status}`
  }
  return body.length > 300 ? `${body.slice(0, 300)}...` : body
}

function clearSession() {
  tokenStorage.clear()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}
