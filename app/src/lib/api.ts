const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const NGROK_HOST_SUFFIXES = ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'];
const DEFAULT_LOCAL_API_PORT = 3001;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const STATIC_HOST_SUFFIXES = ['.github.io'];

function isPrivateIpv4Host(hostname: string) {
  const matched = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!matched) {
    return false;
  }

  const [a, b] = matched.slice(1, 3).map((segment) => Number.parseInt(segment, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isLoopbackOrPrivateHost(hostname: string) {
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  if (!normalizedHost) {
    return false;
  }

  if (LOCALHOST_HOSTS.has(normalizedHost)) {
    return true;
  }

  if (normalizedHost.endsWith('.local')) {
    return true;
  }

  return isPrivateIpv4Host(normalizedHost);
}

function normalizeApiBaseUrl(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function isNgrokHost(hostname: string) {
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  return NGROK_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix));
}

function isLikelyStaticHost(hostname: string) {
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  return STATIC_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix));
}

function parseUrlHostname(value: string) {
  try {
    return String(new URL(value).hostname || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function resolveCurrentHostApiBaseUrl(envApiBaseUrl: string) {
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_LOCAL_API_PORT}`;
  }

  try {
    const envUrl = new URL(envApiBaseUrl);
    const pageHost = String(window.location.hostname || '').trim().toLowerCase();
    const port = String(envUrl.port || DEFAULT_LOCAL_API_PORT);
    return `${envUrl.protocol}//${pageHost}:${port}`;
  } catch {
    return resolveRuntimeDefaultApiBaseUrl();
  }
}

function resolveRuntimeDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_LOCAL_API_PORT}`;
  }

  const pageHost = String(window.location.hostname || '').trim().toLowerCase();
  if (isLoopbackOrPrivateHost(pageHost)) {
    return `${window.location.protocol}//${pageHost}:${DEFAULT_LOCAL_API_PORT}`;
  }

  // Static hosts (GitHub Pages, etc.) tidak menyediakan backend API.
  // Gunakan localhost sebagai fallback agar tetap bisa terhubung saat backend lokal aktif.
  if (isLikelyStaticHost(pageHost)) {
    return `http://localhost:${DEFAULT_LOCAL_API_PORT}`;
  }

  return window.location.origin;
}

function resolveApiBaseUrl() {
  const envApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (!envApiBaseUrl) {
    return resolveRuntimeDefaultApiBaseUrl();
  }

  if (typeof window !== 'undefined') {
    try {
      const pageHost = String(window.location.hostname || '').trim().toLowerCase();
      const envHost = parseUrlHostname(envApiBaseUrl);
      const isEnvLocalHost = isLoopbackOrPrivateHost(envHost);

      // Untuk sesi ngrok, kalau env masih localhost/private, fallback ke origin ngrok aktif.
      if (isNgrokHost(pageHost) && isEnvLocalHost) {
        return window.location.origin;
      }

      // Kalau frontend lokal tapi env menunjuk host lokal lain (IP lama/berubah),
      // pakai host frontend saat ini agar login/auth tidak putus.
      if (isLoopbackOrPrivateHost(pageHost) && isEnvLocalHost && pageHost !== envHost) {
        return resolveCurrentHostApiBaseUrl(envApiBaseUrl);
      }
    } catch {
      // Ignore malformed env URL and keep the original env value.
    }
  }

  return envApiBaseUrl;
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const rawText = await response.text().catch(() => '');
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = Number.parseInt(import.meta.env.VITE_FETCH_TIMEOUT_MS || '', 10) ||
    DEFAULT_FETCH_TIMEOUT_MS,
) {
  const headers = new Headers(
    typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
  );

  const requestInitHeaders = new Headers(init.headers);
  requestInitHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  const isNgrokRequest = (() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const requestUrl =
        input instanceof URL
          ? input
          : new URL(
              typeof Request !== 'undefined' && input instanceof Request ? input.url : String(input),
              window.location.origin,
            );
      const hostname = String(requestUrl.hostname || '').trim().toLowerCase();
      return NGROK_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    } catch {
      return false;
    }
  })();

  if (isNgrokRequest && !headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', '1');
  }

  const safeTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(timeoutMs, 0) : DEFAULT_FETCH_TIMEOUT_MS;
  if (safeTimeoutMs === 0) {
    return fetch(input, {
      ...init,
      headers,
    });
  }

  const controller = new AbortController();
  const externalSignal = init.signal;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        'abort',
        () => {
          controller.abort();
        },
        { once: true },
      );
    }
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, safeTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
