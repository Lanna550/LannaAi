export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001';

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
