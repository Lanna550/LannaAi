import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clipboard,
  Copy,
  Download,
  Link2,
  Loader2,
  Music2,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE_URL, readJsonSafely } from '@/lib/api';
import { toast } from 'sonner';

interface TiktokDownloaderProps {
  onNavigate: (page: string) => void;
}

type TiktokDownloadResult = {
  id?: string | null;
  title?: string | null;
  author?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  noWatermarkUrl: string;
  hdNoWatermarkUrl?: string | null;
  watermarkUrl?: string | null;
  audioUrl?: string | null;
};

type TiktokDownloadApiResponse = {
  ok?: boolean;
  error?: string;
  result?: TiktokDownloadResult;
};

type DownloadKind = 'video' | 'hd' | 'audio';

const TIKTOK_URL_REGEX = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/.+/i;
const DEFAULT_PREVIEW_ASPECT_RATIO = 9 / 16;
const DEFAULT_BACKEND_PORT = 3001;

function formatDuration(durationSeconds?: number | null) {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '-';
  }

  const total = Math.floor(durationSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sanitizeFileNameSegment(value: string, fallback: string) {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return cleaned || fallback;
}

function buildProxyDownloadUrl(sourceUrl: string, fileName: string, kind: DownloadKind) {
  const params = new URLSearchParams({
    url: sourceUrl,
    name: fileName,
    kind,
  });
  return `/api/tiktok/download/file?${params.toString()}`;
}

function extractFirstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match?.[0] || null;
}

type ClipboardPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

async function getClipboardReadPermissionState(): Promise<ClipboardPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const permission = await navigator.permissions.query({
      name: 'clipboard-read' as PermissionName,
    });
    if (permission.state === 'granted' || permission.state === 'denied' || permission.state === 'prompt') {
      return permission.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function normalizeApiBaseUrl(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function getApiBaseCandidates() {
  const candidates = new Set<string>();
  const normalizedEnvBase = normalizeApiBaseUrl(API_BASE_URL);
  if (normalizedEnvBase) {
    candidates.add(normalizedEnvBase);
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalHost) {
      candidates.add(`${protocol}//localhost:${DEFAULT_BACKEND_PORT}`);
      candidates.add(`${protocol}//127.0.0.1:${DEFAULT_BACKEND_PORT}`);
    }
  }

  candidates.add(`http://localhost:${DEFAULT_BACKEND_PORT}`);
  candidates.add(`http://127.0.0.1:${DEFAULT_BACKEND_PORT}`);

  return Array.from(candidates).filter(Boolean);
}

function buildEndpointCandidates(endpointPath: string) {
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return getApiBaseCandidates().map((base) => `${base}${normalizedPath}`);
}

function triggerBrowserDownload(downloadUrl: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.rel = 'noreferrer';
  link.style.display = 'none';
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function extractFileNameFromDisposition(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim() || null;
    } catch {
      return utf8Match[1].trim() || null;
    }
  }

  const fallbackMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (fallbackMatch?.[1]) {
    return fallbackMatch[1].trim() || null;
  }

  return null;
}

export function TiktokDownloader({ onNavigate }: TiktokDownloaderProps) {
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TiktokDownloadResult | null>(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [activeDownloadKind, setActiveDownloadKind] = useState<DownloadKind | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const tiktokInputRef = useRef<HTMLInputElement | null>(null);

  const hasInputValue = tiktokUrl.trim().length > 0;

  const applyPastedText = (rawText: string | null | undefined) => {
    const normalized = String(rawText || '').trim();
    if (!normalized) {
      return false;
    }

    const extractedUrl = extractFirstUrl(normalized) || normalized;
    setTiktokUrl(extractedUrl);
    toast.success('Tautan berhasil ditempel.');
    return true;
  };

  const tryLegacyPaste = () => {
    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
      return null;
    }

    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand('paste');
    } catch {
      // ignore legacy paste errors and fallback to regular toast
    }

    const value = textarea.value.trim();
    document.body.removeChild(textarea);
    if (value) {
      return value;
    }

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.setAttribute('aria-hidden', 'true');
    editable.style.position = 'fixed';
    editable.style.left = '-9999px';
    editable.style.top = '0';
    editable.style.opacity = '0';
    document.body.appendChild(editable);
    editable.focus();

    try {
      document.execCommand('paste');
    } catch {
      // ignore legacy paste errors and continue
    }

    const fallbackValue = String(editable.textContent || '').trim();
    document.body.removeChild(editable);
    return fallbackValue || null;
  };

  const focusInputForManualPaste = () => {
    const input = tiktokInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const cursorPosition = input.value.length;
    try {
      input.setSelectionRange(cursorPosition, cursorPosition);
    } catch {
      // ignore selection errors on unsupported browsers
    }
  };

  const handlePasteFromClipboard = async () => {
    if (isPasting) {
      return;
    }

    try {
      setIsPasting(true);

      // IMPORTANT: call readText directly in click handler flow so browser can show permission prompt.
      if (navigator?.clipboard?.readText) {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (applyPastedText(clipboardText)) {
            return;
          }

          focusInputForManualPaste();
          toast.error('Clipboard kosong.');
          return;
        } catch {
          // continue to permission check + fallbacks
        }
      }

      const permissionState = await getClipboardReadPermissionState();
      if (permissionState === 'denied') {
        focusInputForManualPaste();
        toast.error('Izin clipboard ditolak. Izinkan akses clipboard untuk situs ini di pengaturan browser.');
      }

      const legacyClipboardText = tryLegacyPaste();
      if (applyPastedText(legacyClipboardText)) {
        return;
      }

      focusInputForManualPaste();
      if (!window.isSecureContext) {
        toast(
          'Popup izin clipboard biasanya tidak muncul di HTTP. Gunakan HTTPS/localhost, atau tempel manual dengan tekan lama kolom URL.',
        );
        return;
      }

      toast(
        permissionState === 'prompt'
          ? 'Jika popup izin muncul, pilih Izinkan agar tempel otomatis aktif.'
          : 'Akses clipboard belum diizinkan. Tekan lama kolom URL lalu pilih Tempel.',
      );
    } catch {
      focusInputForManualPaste();
      toast('Tempel otomatis gagal. Tekan lama kolom URL lalu pilih Tempel.');
    } finally {
      setIsPasting(false);
    }
  };

  const handleClearInput = () => {
    setTiktokUrl('');
  };

  const handleCopy = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      toast.error('Tidak ada link untuk disalin.');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(trimmedValue);
        toast.success('Link berhasil disalin');
        return;
      }

      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        const textarea = document.createElement('textarea');
        textarea.value = trimmedValue;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (copied) {
          toast.success('Link berhasil disalin');
          return;
        }
      }

      window.prompt('Salin tautan ini:', trimmedValue);
      toast.success('Link berhasil disalin');
    } catch {
      window.prompt('Salin tautan ini:', trimmedValue);
    }
  };

  const handleDirectDownload = async (sourceUrl: string | null | undefined, kind: DownloadKind) => {
    const trimmedSourceUrl = String(sourceUrl || '').trim();
    if (!trimmedSourceUrl) {
      toast.error('Link download tidak tersedia.');
      return;
    }

    const normalizedTikTokInput = tiktokUrl.trim();
    const sourceForBackend =
      TIKTOK_URL_REGEX.test(normalizedTikTokInput) ? normalizedTikTokInput : trimmedSourceUrl;

    const baseName = sanitizeFileNameSegment(result?.title || result?.id || 'tiktok-video', 'tiktok-video');
    const suffix = kind === 'audio' ? 'audio' : kind === 'hd' ? 'hd' : 'video';
    const extension = kind === 'audio' ? 'mp3' : 'mp4';
    const fileName = `${baseName}-${suffix}.${extension}`;
    const downloadPath = buildProxyDownloadUrl(sourceForBackend, fileName, kind);
    const downloadUrlCandidates = buildEndpointCandidates(downloadPath);
    setActiveDownloadKind(kind);

    try {
      if (kind === 'video') {
        let lastError: Error | null = null;
        let hasNetworkError = false;

        for (let index = 0; index < downloadUrlCandidates.length; index += 1) {
          const downloadUrl = downloadUrlCandidates[index];
          const isLastCandidate = index === downloadUrlCandidates.length - 1;

          try {
            const probeResponse = await fetch(downloadUrl, {
              method: 'HEAD',
              cache: 'no-store',
            });

            if (!probeResponse.ok) {
              const payload = await readJsonSafely<{ error?: string }>(probeResponse);
              throw new Error(payload?.error || `Download gagal (${probeResponse.status}).`);
            }

            const responseContentType = String(
              probeResponse.headers.get('content-type') || '',
            ).toLowerCase();
            const looksLikeVideoPayload =
              responseContentType.startsWith('video/') ||
              responseContentType.includes('application/octet-stream');
            if (!looksLikeVideoPayload) {
              throw new Error('Server tidak mengembalikan file video MP4 yang valid.');
            }

            triggerBrowserDownload(downloadUrl);
            toast.success('Download dimulai.');
            return;
          } catch (error) {
            const rawMessage =
              error instanceof Error ? error.message : 'Terjadi kesalahan saat memulai download.';
            const isNetworkError =
              /failed to fetch|networkerror|load failed|connection|cors|aborterror/i.test(
                rawMessage.toLowerCase(),
              );
            if (isNetworkError) {
              hasNetworkError = true;
            }

            lastError =
              error instanceof Error
                ? error
                : new Error('Terjadi kesalahan saat memulai download.');

            if (!isLastCandidate) {
              continue;
            }
          }
        }

        if (hasNetworkError) {
          throw new Error(
            `Gagal terhubung ke server download (${API_BASE_URL}). Pastikan backend aktif dan bisa diakses dari browser ini.`,
          );
        }

        throw lastError || new Error('Terjadi kesalahan saat memulai download.');
      }

      let lastError: Error | null = null;
      let hasNetworkError = false;

      for (let index = 0; index < downloadUrlCandidates.length; index += 1) {
        const downloadUrl = downloadUrlCandidates[index];
        const isLastCandidate = index === downloadUrlCandidates.length - 1;

        try {
          const response = await fetch(downloadUrl, {
            method: 'GET',
            cache: 'no-store',
          });

          if (!response.ok) {
            const payload = await readJsonSafely<{ error?: string }>(response);
            throw new Error(payload?.error || `Download gagal (${response.status}).`);
          }

          const responseContentType = String(
            response.headers.get('content-type') || '',
          ).toLowerCase();
          const responseDisposition = String(
            response.headers.get('content-disposition') || '',
          ).toLowerCase();
          const looksLikeDownloadPayload =
            responseDisposition.includes('attachment') ||
            responseContentType.startsWith('video/') ||
            responseContentType.startsWith('audio/') ||
            responseContentType.includes('application/octet-stream');

          if (!looksLikeDownloadPayload) {
            throw new Error('Respons download tidak valid dari endpoint ini.');
          }

          const blob = await response.blob();
          if (!blob || blob.size === 0) {
            throw new Error('File download kosong atau tidak valid.');
          }

          const headerFileName = extractFileNameFromDisposition(
            response.headers.get('content-disposition'),
          );
          const finalFileName = sanitizeFileNameSegment(
            (headerFileName || fileName).replace(/\s+/g, '-'),
            fileName,
          );

          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = finalFileName;
          link.rel = 'noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
          toast.success('Download dimulai.');
          return;
        } catch (error) {
          const rawMessage =
            error instanceof Error ? error.message : 'Terjadi kesalahan saat memulai download.';
          const isNetworkError =
            /failed to fetch|networkerror|load failed|connection|cors|aborterror/i.test(
              rawMessage.toLowerCase(),
            );

          if (isNetworkError) {
            hasNetworkError = true;
          }

          lastError =
            error instanceof Error
              ? error
              : new Error('Terjadi kesalahan saat memulai download.');

          if (!isLastCandidate) {
            continue;
          }
        }
      }

      if (hasNetworkError && downloadUrlCandidates[0]) {
        triggerBrowserDownload(downloadUrlCandidates[0]);
        toast.success('Mencoba download lewat browser...');
        return;
      }

      throw lastError || new Error('Terjadi kesalahan saat memulai download.');
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan saat memulai download.';
      const message =
        /failed to fetch/i.test(rawMessage)
          ? `Gagal terhubung ke server download (${API_BASE_URL}). Pastikan backend aktif dan bisa diakses dari browser ini.`
          : rawMessage;
      toast.error(message);
    } finally {
      setActiveDownloadKind(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUrl = tiktokUrl.trim();
    if (!trimmedUrl) {
      toast.error('Masukkan URL TikTok terlebih dahulu');
      return;
    }

    if (!TIKTOK_URL_REGEX.test(trimmedUrl)) {
      toast.error('URL TikTok tidak valid');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setPreviewAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);

    try {
      const endpointCandidates = buildEndpointCandidates('/api/tiktok/download');
      let lastError: Error | null = null;
      let hasNetworkError = false;

      for (let index = 0; index < endpointCandidates.length; index += 1) {
        const endpoint = endpointCandidates[index];
        const isLastCandidate = index === endpointCandidates.length - 1;

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: trimmedUrl,
              hd: true,
            }),
          });

          const payload = await readJsonSafely<TiktokDownloadApiResponse>(response);
          const responseResult = payload?.result;
          const isEndpointMissing = response.status === 404 || response.status === 405;
          const responseType = String(response.headers.get('content-type') || '').toLowerCase();
          const looksLikeJson = responseType.includes('application/json');
          const isInvalidPayload = !payload || !payload.ok || !responseResult?.noWatermarkUrl;

          if (isInvalidPayload && !isLastCandidate && !looksLikeJson) {
            lastError = new Error('Respons API bukan JSON valid dari host ini.');
            continue;
          }

          if (!response.ok || isInvalidPayload) {
            if (isEndpointMissing && !isLastCandidate) {
              lastError = new Error('Endpoint TikTok downloader tidak ditemukan di host ini.');
              continue;
            }
            if (response.status === 404) {
              throw new Error('Endpoint TikTok downloader tidak ditemukan. Restart backend server terlebih dahulu.');
            }
            throw new Error(payload?.error || `Gagal mengambil video TikTok (${response.status})`);
          }

          setResult(responseResult);
          toast.success('Video TikTok berhasil diproses');
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '');
          const isNetworkError =
            /failed to fetch|networkerror|load failed|connection|cors|aborterror/i.test(
              message.toLowerCase(),
            );
          if (isNetworkError && !isLastCandidate) {
            hasNetworkError = true;
            lastError =
              error instanceof Error
                ? error
                : new Error('Gagal terhubung ke endpoint TikTok downloader.');
            continue;
          }

          throw error;
        }
      }

      if (hasNetworkError) {
        throw new Error(
          `Gagal terhubung ke server download (${API_BASE_URL}). Pastikan backend aktif dan bisa diakses dari browser ini.`,
        );
      }

      throw lastError || new Error('Gagal mengambil video TikTok.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses video TikTok.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-with-navbar pb-12 bg-gradient-to-b from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <button
              onClick={() => onNavigate('tools')}
              className="inline-flex items-center gap-2 text-gray-700 transition-colors hover:text-cyan-700 dark:text-gray-300 dark:hover:text-cyan-300"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-base font-medium">Kembali</span>
            </button>

            <div className="h-12 w-12 min-w-12 min-h-12 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 sm:h-14 sm:w-14 sm:min-w-14 sm:min-h-14">
              <Download className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              No Watermark Downloader
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Tiktok <span className="bg-gradient-to-r from-cyan-500 to-emerald-500 bg-clip-text text-transparent">Downloader</span>
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
              Tempel link TikTok, proses otomatis, lalu unduh video tanpa watermark dengan kualitas terbaik.
            </p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="lg:col-span-2"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-card">
              <h2 className="mb-5 text-center text-xl font-bold text-gray-900 dark:text-white">Masukkan Link TikTok</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Link2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    ref={tiktokInputRef}
                    value={tiktokUrl}
                    onChange={(event) => setTiktokUrl(event.target.value)}
                    placeholder="https://www.tiktok.com/@username/video/123..."
                    className="h-11 pl-9 pr-11"
                  />
                  <button
                    type="button"
                    onClick={hasInputValue ? handleClearInput : handlePasteFromClipboard}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={hasInputValue ? 'Hapus tautan' : 'Tempel tautan'}
                    title={hasInputValue ? 'Hapus tautan' : 'Tempel tautan'}
                    disabled={isPasting}
                  >
                    {hasInputValue ? (
                      <X className="h-4 w-4" />
                    ) : isPasting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Video
                    </>
                  )}
                </Button>
              </form>
            </div>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-card"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Hasil Download</h3>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <div
                      className="mx-auto w-full max-w-[300px] sm:max-w-[350px] md:max-w-[390px] rounded-xl overflow-hidden bg-black shadow-lg"
                      style={{ aspectRatio: String(previewAspectRatio) }}
                    >
                      <video
                        controls
                        preload="metadata"
                        poster={result.thumbnailUrl || undefined}
                        className="w-full h-full object-contain bg-black"
                        src={result.noWatermarkUrl}
                        onLoadedMetadata={(event) => {
                          const video = event.currentTarget;
                          if (video.videoWidth > 0 && video.videoHeight > 0) {
                            const nextRatio = video.videoWidth / video.videoHeight;
                            const clampedRatio = Math.min(1.8, Math.max(0.5, nextRatio));
                            setPreviewAspectRatio(clampedRatio);
                          }
                        }}
                      />
                    </div>
                    <p className="mx-auto max-w-[300px] text-center text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-xs">
                      Jika preview tidak tampil, langsung gunakan tombol download.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-gray-50 p-3.5 dark:bg-gray-700/50">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Judul
                      </p>
                      <p
                        className="mt-1 text-sm font-semibold leading-snug text-gray-900 dark:text-white"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={result.title || '-'}
                      >
                        {result.title || '-'}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Author
                          </p>
                          <p className="mt-0.5 truncate text-sm font-medium text-gray-800 dark:text-gray-200" title={result.author || '-'}>
                            {result.author || '-'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Durasi
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                            {formatDuration(result.durationSeconds)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <Button
                        type="button"
                        className="h-10 bg-cyan-500 hover:bg-cyan-600 text-white"
                        onClick={() => handleDirectDownload(result.noWatermarkUrl, 'video')}
                        disabled={activeDownloadKind !== null}
                      >
                        {activeDownloadKind === 'video' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Menyiapkan...
                          </>
                        ) : (
                          <>
                            <Video className="w-4 h-4" />
                            Download No Watermark
                          </>
                        )}
                      </Button>

                      {result.hdNoWatermarkUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => handleDirectDownload(result.hdNoWatermarkUrl, 'hd')}
                          disabled={activeDownloadKind !== null}
                        >
                          {activeDownloadKind === 'hd' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Menyiapkan...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download HD
                            </>
                          )}
                        </Button>
                      )}

                      {result.audioUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          onClick={() => handleDirectDownload(result.audioUrl, 'audio')}
                          disabled={activeDownloadKind !== null}
                        >
                          {activeDownloadKind === 'audio' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Menyiapkan...
                            </>
                          ) : (
                            <>
                              <Music2 className="w-4 h-4" />
                              Download Audio
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10"
                        onClick={() => handleCopy(tiktokUrl)}
                      >
                        <Copy className="w-4 h-4" />
                        Salin Link Video
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-card sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cara Pakai</h3>
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                <p>1. Copy link video TikTok dari aplikasi atau browser.</p>
                <p>2. Tempel URL ke kolom input, lalu klik Download Video.</p>
                <p>3. Klik tombol hasil download, file akan otomatis terunduh.</p>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 text-sm text-cyan-700 dark:text-cyan-300">
                Gunakan fitur ini untuk konten publik dan hormati hak cipta kreator.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
