import {
  askGemini,
  generateGeminiImage,
  looksLikeImageGenerationRequest,
  ChatApiError,
  submitAssistantFeedback,
  type AssistantFeedbackType,
  type ChatAttachment,
} from '@/lib/gemini';
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, 
  Mic,
  MicOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
  X,
  Search,
  History,
  Trash2,
  Pin,
  Plus,
  Image as ImageIcon,
  FileText,
  Camera,
  Copy,
  Share2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Volume2,
  VolumeX,
  Play,
  Pause,
} from 'lucide-react';
import { useChat, CHAT_MODELS } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { toast } from 'sonner';

interface ChatProps {
  onNavigate: (page: string) => void;
}

type UserMood = 'sedih' | 'bahagia' | 'salting' | 'romantis' | 'netral';

type MoodSignal = {
  mood: UserMood;
  confidence: 'low' | 'medium' | 'high';
};

type ApiHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
  attachment?: {
    kind: ChatAttachment['kind'];
    name: string;
    mimeType: string;
    size: number;
    fileUri?: string;
  };
};

type AssistantResponseVariant = {
  content: string;
  attachment?: ChatAttachment;
  timestamp: Date;
};

type AssistantResponseVariantState = {
  variants: AssistantResponseVariant[];
  selectedIndex: number;
  compareMode: boolean;
};

const VOICEVOX_BASE_URL = 'http://localhost:50021';
const VOICEVOX_SPEAKER_ID = 1;

function cloneAttachment(
  attachment?: ChatAttachment | null,
): ChatAttachment | undefined {
  if (!attachment) {
    return undefined;
  }

  return {
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    file: attachment.file,
    previewUrl: attachment.previewUrl,
    fileUri: attachment.fileUri,
  };
}

function normalizeMoodText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function inferUserMood(currentText: string, history: Array<{ role: string; content: string }>) : MoodSignal {
  const recentUserTexts = history
    .filter((item) => item.role === 'user' && typeof item.content === 'string' && item.content.trim())
    .slice(-2)
    .map((item) => item.content.trim());

  const combined = [currentText, ...recentUserTexts].join('\n').trim();
  const normalized = normalizeMoodText(combined);

  if (!normalized) {
    return { mood: 'netral', confidence: 'low' };
  }

  const isRegretSayang = /\bsayang\s+(banget|sekali|nya|deh|padahal|kalau|kalo)\b/i.test(normalized);
  const romanticSignals =
    !isRegretSayang &&
    (/\b(sayang(gg+)?|ayang|beb|babe|baby|dear|cinta|my love|love)\b/i.test(normalized) ||
      /\b(kangen|rindu|miss you)\b/i.test(normalized) ||
      /\b(muach|cium|peluk)\b/i.test(normalized) ||
      /[❤❤️💕💖🥰😘😍]/.test(normalized));

  if (romanticSignals) {
    return { mood: 'romantis', confidence: 'high' };
  }

  const sadSignals =
    /\b(sedih|capek|lelah|down|galau|nangis|menangis|patah hati|kecewa|kesepian|sendiri|cemas|takut|stress|stres)\b/i.test(
      normalized,
    ) || /[😢😭😞☹️]/.test(normalized);
  if (sadSignals) {
    return { mood: 'sedih', confidence: 'high' };
  }

  const happySignals =
    /\b(bahagia|senang|gembira|happy|excited|asik|mantap|yeay|yey|hore)\b/i.test(
      normalized,
    ) || /[🥳🎉😄😁😊]/.test(normalized);
  if (happySignals) {
    return { mood: 'bahagia', confidence: 'high' };
  }

  const saltingSignals =
    /\b(salting|malu|deg-?degan|baper|gemes|ih|hihi|hehe|wkwk)\b/i.test(normalized) ||
    /[😳🙈☺️]/.test(normalized);
  if (saltingSignals) {
    return { mood: 'salting', confidence: 'medium' };
  }

  return { mood: 'netral', confidence: 'medium' };
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type AvatarUser = {
  avatar?: string;
  displayName?: string;
};

function UserAvatar({
  user,
  size = 'md',
}: {
  user?: AvatarUser | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName || 'User'}
        className={`${sizeClass} rounded-full object-cover bg-transparent border-0 outline-none ring-0 shadow-none drop-shadow-none`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center`}>
      <span className={`text-white font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        {user?.displayName?.charAt(0).toUpperCase() || 'U'}
      </span>
    </div>
  );
}

export function Chat({ onNavigate }: ChatProps) {
  const {
    chatSessions,
    activeSessionId,
    messages,
    currentModel,
    isTyping,
    appendMessage,
    updateMessageAttachment,
    setTyping,
    switchModel,
    clearChat,
    loadSession,
    deleteSession,
    toggleSessionPin,
    maxPinnedSessions,
  } = useChat();
  const { isAuthenticated, user } = useAuth();
  const [input, setInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>(
    () => Array.from({ length: 42 }, () => 0),
  );
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(0);
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<
    Partial<Record<string, AssistantFeedbackType>>
  >({});
  const [savingFeedbackMessageId, setSavingFeedbackMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [assistantResponseVariants, setAssistantResponseVariants] = useState<
    Record<string, AssistantResponseVariantState>
  >({});
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isPlayingVoicePreview, setIsPlayingVoicePreview] = useState(false);
  const [voiceReplayWaveShift, setVoiceReplayWaveShift] = useState(0);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSampleIntervalRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const lastSoundAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRecognitionRef = useRef(false);
  const voiceTranscriptRef = useRef('');
  const resizeTickRef = useRef(0);
  const [, forceResizeTick] = useState(0);
  const lastAutoScrollMessageIdRef = useRef<string | null>(null);
  const prevKeyboardOffsetRef = useRef(0);
  const voicevoxAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicevoxAudioUrlRef = useRef<string | null>(null);
  const voicevoxAbortControllerRef = useRef<AbortController | null>(null);
  const voicevoxSessionIdRef = useRef(0);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewAudioUrlRef = useRef<string | null>(null);
  const previousSpeechModelIdRef = useRef(currentModel.id);
  const hasUserMessages = messages.some((message) => message.role === 'user');
  const latestAssistantResponse = useMemo(
    () => {
      const latestMessage =
        [...messages]
          .reverse()
          .find(
            (message) =>
              message.role === 'assistant' &&
              !String(message.id || '').startsWith('welcome') &&
              message.content.trim(),
          ) || null;

      if (!latestMessage) {
        return null;
      }

      const variantState = assistantResponseVariants[latestMessage.id];
      if (!variantState?.variants?.length) {
        return latestMessage;
      }

      const safeIndex = Math.max(
        0,
        Math.min(variantState.selectedIndex, variantState.variants.length - 1),
      );
      const variant = variantState.variants[safeIndex] || variantState.variants[0];

      return {
        ...latestMessage,
        content: variant.content,
        attachment: variant.attachment,
      };
    },
    [assistantResponseVariants, messages],
  );

  const keepWindowAtTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const focusComposerInput = useCallback(
    (options: { preventScroll?: boolean } = {}) => {
      const el = inputRef.current;
      if (!el) {
        return;
      }

      const preventScroll = options.preventScroll ?? true;
      try {
        el.focus({ preventScroll });
      } catch {
        el.focus();
      }

      try {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      } catch {
        // ignore (unsupported inputs / browsers)
      }
    },
    [],
  );

  const resizeComposerTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const isSmUp = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 640px)').matches
      : false;
    const MAX_HEIGHT_PX = isSmUp ? 160 : 96; // keep composer compact on Android; allow taller on desktop
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, []);

  const toSpeechText = useCallback((content: string) => {
    return String(content || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
      .replace(/^\s*[-*\u2022]\s+/gm, ', ')
      .replace(/\r?\n+/g, '. ')
      .replace(/\s+-\s+/g, ' ')
      .replace(/[*_~`>#|]+/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
      .replace(/([,.!?;:]){2,}/g, '$1')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const cleanupVoicevoxAudio = useCallback(() => {
    const activeAudio = voicevoxAudioRef.current;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.src = '';
      voicevoxAudioRef.current = null;
    }

    const activeAudioUrl = voicevoxAudioUrlRef.current;
    if (activeAudioUrl) {
      URL.revokeObjectURL(activeAudioUrl);
      voicevoxAudioUrlRef.current = null;
    }
  }, []);

  const stopSpeakingResponse = useCallback(() => {
    voicevoxSessionIdRef.current += 1;
    if (voicevoxAbortControllerRef.current) {
      voicevoxAbortControllerRef.current.abort();
      voicevoxAbortControllerRef.current = null;
    }
    cleanupVoicevoxAudio();
    setIsSpeakingResponse(false);
    setSpeakingMessageId(null);
  }, [cleanupVoicevoxAudio]);

  const speakWithVoicevox = useCallback(
    async (text: string) => {
      const speechText = toSpeechText(text);
      if (!speechText) {
        toast.info('Teks respons kosong, tidak ada yang dibacakan.');
        setIsSpeakingResponse(false);
        setSpeakingMessageId(null);
        return;
      }

      const sessionId = voicevoxSessionIdRef.current + 1;
      voicevoxSessionIdRef.current = sessionId;
      if (voicevoxAbortControllerRef.current) {
        voicevoxAbortControllerRef.current.abort();
      }
      cleanupVoicevoxAudio();
      setIsSpeakingResponse(false);

      const abortController = new AbortController();
      voicevoxAbortControllerRef.current = abortController;

      try {
        // Step 1: Buat audio query dari teks AI.
        const queryParams = new URLSearchParams({
          text: speechText,
          speaker: String(VOICEVOX_SPEAKER_ID),
        });
        const audioQueryResponse = await fetch(
          `${VOICEVOX_BASE_URL}/audio_query?${queryParams.toString()}`,
          {
            method: 'POST',
            signal: abortController.signal,
          },
        );

        if (!audioQueryResponse.ok) {
          throw new Error(`VOICEVOX audio_query gagal (${audioQueryResponse.status})`);
        }

        const audioQuery = await audioQueryResponse.json();

        // Step 2: Sintesis audio dari hasil query.
        const synthesisResponse = await fetch(
          `${VOICEVOX_BASE_URL}/synthesis?speaker=${VOICEVOX_SPEAKER_ID}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(audioQuery),
            signal: abortController.signal,
          },
        );

        if (!synthesisResponse.ok) {
          throw new Error(`VOICEVOX synthesis gagal (${synthesisResponse.status})`);
        }

        if (voicevoxSessionIdRef.current !== sessionId) {
          return;
        }

        const audioBlob = await synthesisResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        voicevoxAudioUrlRef.current = audioUrl;

        // Step 3: Putar blob audio di browser dengan HTML5 Audio.
        const audio = new Audio(audioUrl);
        voicevoxAudioRef.current = audio;

        const finalize = () => {
          if (voicevoxSessionIdRef.current !== sessionId) {
            return;
          }

          setIsSpeakingResponse(false);
          setSpeakingMessageId(null);
          if (voicevoxAudioRef.current === audio) {
            voicevoxAudioRef.current = null;
          }
          if (voicevoxAudioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            voicevoxAudioUrlRef.current = null;
          }
          if (voicevoxAbortControllerRef.current === abortController) {
            voicevoxAbortControllerRef.current = null;
          }
        };

        audio.onended = finalize;
        audio.onerror = () => {
          finalize();
          toast.error('Audio VOICEVOX gagal diputar.');
        };

        await audio.play();
        if (voicevoxSessionIdRef.current !== sessionId) {
          audio.pause();
          return;
        }

        setIsSpeakingResponse(true);
        if (voicevoxAbortControllerRef.current === abortController) {
          voicevoxAbortControllerRef.current = null;
        }
      } catch (error) {
        if (voicevoxAbortControllerRef.current === abortController) {
          voicevoxAbortControllerRef.current = null;
        }

        const errorName =
          error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: string }).name || '')
            : '';
        if (errorName === 'AbortError') {
          return;
        }

        setIsSpeakingResponse(false);
        setSpeakingMessageId(null);

        if (error instanceof TypeError) {
          toast.error('VOICEVOX tidak bisa dihubungi. Pastikan server berjalan di http://localhost:50021.');
          return;
        }

        toast.error('Gagal menghasilkan suara dari VOICEVOX.');
      }
    },
    [cleanupVoicevoxAudio, toSpeechText],
  );

  const handleSpeakMessage = useCallback(
    async (messageId: string, content: string) => {
      if (isSpeakingResponse && speakingMessageId === messageId) {
        stopSpeakingResponse();
        return;
      }

      setSpeakingMessageId(messageId);
      await speakWithVoicevox(content);
    },
    [isSpeakingResponse, speakWithVoicevox, speakingMessageId, stopSpeakingResponse],
  );

  const handleSpeakLatestResponse = useCallback(async () => {
    if (isSpeakingResponse) {
      stopSpeakingResponse();
      return;
    }

    const targetMessage = latestAssistantResponse;
    if (!targetMessage?.content?.trim()) {
      toast.info('Belum ada respons model yang bisa dibacakan.');
      return;
    }

    await handleSpeakMessage(targetMessage.id, targetMessage.content);
  }, [
    handleSpeakMessage,
    isSpeakingResponse,
    latestAssistantResponse,
    stopSpeakingResponse,
  ]);

  const formatAssistantErrorReply = useCallback(
    (err: unknown) => {
      const isApiError = err instanceof ChatApiError;
      const status = isApiError ? err.status : undefined;
      const code = isApiError ? err.code : undefined;
      const retryAfterSeconds = isApiError ? err.retryAfterSeconds : undefined;

      const retryHint =
        typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
          ? ` Kamu bisa coba lagi dalam ${retryAfterSeconds} detik.`
          : '';

      const prefix =
        currentModel.id === 'furina'
          ? 'Maaf.'
          : currentModel.id === 'inori'
            ? 'Aduh, maaf ya.'
            : 'Maaf ya.';

      if (code === 'FURINA_NON_IMAGE_ATTACHMENT') {
        return `${prefix} Sparkle hanya menerima lampiran gambar. Hapus lampiran audio/dokumen lalu kirim ulang prompt gambarnya.`;
      }

      if (
        status === 429 ||
        code === 'GEMINI_IMAGE_QUOTA_ZERO_LIMIT' ||
        code === 'GEMINI_QUOTA_EXCEEDED' ||
        code?.toLowerCase().includes('rate') ||
        code?.toLowerCase().includes('quota') ||
        code?.toLowerCase().includes('limit')
      ) {
        return `${prefix} Lagi kena limit. Coba lagi sebentar ya.${retryHint}`;
      }

      if (status === 413) {
        return `${prefix} Lampirannya terlalu besar untuk diproses. Coba kirim file yang lebih kecil atau kompres dulu.`;
      }

      if (status === 400) {
        return `${prefix} Permintaannya tidak valid atau formatnya tidak bisa diproses. Coba kirim ulang dengan teks yang lebih sederhana.`;
      }

      if (typeof status === 'number' && status >= 500) {
        return `${prefix} Server sedang bermasalah. Coba lagi beberapa saat ya.${retryHint}`;
      }

      return `${prefix} Ada kendala saat memproses permintaan. Coba kirim ulang ya.${retryHint}`;
    },
    [currentModel.id],
  );

  useLayoutEffect(() => {
    resizeComposerTextarea();
  }, [input, resizeComposerTextarea]);

  useEffect(() => {
    // Mobile browsers (terutama Chrome Android) kadang auto-scroll document saat input di composer (fixed)
    // difokuskan. Kita lock scroll pada root supaya yang scroll hanya container pesan.
    const root = document.documentElement;
    const body = document.body;

    const prev = {
      rootOverflow: root.style.overflow,
      rootHeight: root.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    };

    root.style.overflow = 'hidden';
    root.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.overscrollBehavior = 'none';

    return () => {
      root.style.overflow = prev.rootOverflow;
      root.style.height = prev.rootHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.overscrollBehavior = prev.bodyOverscrollBehavior;
    };
  }, []);

  useEffect(
    () => () => {
      voicevoxSessionIdRef.current += 1;
      if (voicevoxAbortControllerRef.current) {
        voicevoxAbortControllerRef.current.abort();
        voicevoxAbortControllerRef.current = null;
      }
      cleanupVoicevoxAudio();
    },
    [cleanupVoicevoxAudio],
  );

  useEffect(() => {
    const previousModelId = previousSpeechModelIdRef.current;
    previousSpeechModelIdRef.current = currentModel.id;

    if (previousModelId === currentModel.id || !isSpeakingResponse) {
      return;
    }

    stopSpeakingResponse();
  }, [currentModel.id, isSpeakingResponse, stopSpeakingResponse]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  const formatAudioType = (attachment: ChatAttachment) => {
    const mime = (attachment.mimeType || '').toLowerCase();
    if (mime.includes('webm')) return 'WEBM';
    if (mime.includes('ogg')) return 'OGG';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'M4A';
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'MP3';
    if (mime.includes('wav')) return 'WAV';
    return mime ? mime.split('/')[1]?.toUpperCase?.() || 'AUDIO' : 'AUDIO';
  };

  const formatDocumentType = useCallback((attachment: ChatAttachment) => {
    const name = attachment.name || '';
    const extMatch = name.match(/\.([a-z0-9]{1,8})$/i);
    const ext = extMatch?.[1]?.toUpperCase();
    if (ext) return ext;

    const mime = (attachment.mimeType || '').toLowerCase();
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('word') || mime.includes('doc')) return 'DOC';
    if (mime.includes('excel') || mime.includes('sheet') || mime.includes('xls')) return 'XLS';
    if (mime.includes('powerpoint') || mime.includes('presentation') || mime.includes('ppt')) return 'PPT';
    if (mime.startsWith('text/')) return 'TEXT';
    return 'FILE';
  }, []);

  const resetVoiceDraft = useCallback(() => {
    voiceTranscriptRef.current = '';
    setVoiceTranscript('');
    setVoiceInterimTranscript('');
    setVoiceWaveform(Array.from({ length: 42 }, () => 0));
  }, []);

  const stopVoicePreview = useCallback(() => {
    const audio = voicePreviewAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.pause();
      audio.currentTime = 0;
    }
    voicePreviewAudioRef.current = null;
    voicePreviewAudioUrlRef.current = null;
    setIsPlayingVoicePreview(false);
  }, []);

  const handleToggleVoicePreview = useCallback(async () => {
    if (isRecording) {
      toast.info('Tunggu sampai rekaman selesai.');
      return;
    }

    if (!pendingAttachment || pendingAttachment.kind !== 'audio' || !pendingAttachment.previewUrl) {
      toast.error('Audio rekaman belum tersedia.');
      return;
    }

    const activeAudio = voicePreviewAudioRef.current;
    const activeAudioUrl = voicePreviewAudioUrlRef.current;
    const previewUrl = pendingAttachment.previewUrl;
    const isSameAudio = Boolean(activeAudio && activeAudioUrl && activeAudioUrl === previewUrl);

    if (isSameAudio && activeAudio) {
      if (activeAudio.paused || activeAudio.ended) {
        try {
          await activeAudio.play();
          setIsPlayingVoicePreview(true);
        } catch (error) {
          console.error(error);
          stopVoicePreview();
          toast.error('Gagal memutar audio rekaman.');
        }
        return;
      }

      activeAudio.pause();
      activeAudio.currentTime = 0;
      setIsPlayingVoicePreview(false);
      return;
    }

    stopVoicePreview();
    const audio = new Audio(previewUrl);
    voicePreviewAudioRef.current = audio;
    voicePreviewAudioUrlRef.current = previewUrl;
    audio.preload = 'auto';

    audio.onended = () => {
      if (voicePreviewAudioRef.current === audio) {
        setIsPlayingVoicePreview(false);
      }
    };
    audio.onpause = () => {
      if (voicePreviewAudioRef.current === audio && !audio.ended) {
        setIsPlayingVoicePreview(false);
      }
    };
    audio.onerror = () => {
      if (voicePreviewAudioRef.current === audio) {
        setIsPlayingVoicePreview(false);
      }
      toast.error('Gagal memutar audio rekaman.');
    };

    try {
      await audio.play();
      if (voicePreviewAudioRef.current === audio) {
        setIsPlayingVoicePreview(true);
      }
    } catch (error) {
      console.error(error);
      stopVoicePreview();
      toast.error('Gagal memutar audio rekaman.');
    }
  }, [isRecording, pendingAttachment, stopVoicePreview]);

  const clearVoiceDraft = useCallback(() => {
    stopVoicePreview();
    resetVoiceDraft();
    setPendingAttachment((prev) => {
      if (prev?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, [resetVoiceDraft, stopVoicePreview]);

  const renderVoiceWaveform = (values: number[], options: { active?: boolean } = {}) => {
    const active = Boolean(options.active);
    const barColor = active ? 'bg-blue-500/70 dark:bg-cyan-300/70' : 'bg-gray-500/60 dark:bg-gray-300/60';
    const shiftedValues =
      voiceReplayWaveShift > 0 && values.length > 0
        ? values.map((_, index) => values[(index + voiceReplayWaveShift) % values.length] ?? 0)
        : values;

    return (
      <div className={`flex items-center justify-start gap-[2px] h-11 ${active ? 'opacity-100' : 'opacity-95'}`}>
        {shiftedValues.map((value, index) => {
          const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
          const height = Math.round(8 + normalized * 28);
          return (
            <div
              key={index}
              className={`w-[3.5px] rounded-full ${barColor} transition-[height] duration-150 ease-out`}
              style={{ height }}
            />
          );
        })}
      </div>
    );
  };

  const renderAttachment = (attachment: ChatAttachment | undefined, isUser: boolean) => {
    if (!attachment) {
      return null;
    }

    if (attachment.kind === 'image') {
      const src = attachment.previewUrl;
      if (!src) {
        return (
          <div
            className={`rounded-xl px-3 py-2 ${
              isUser ? 'bg-white/15 text-white' : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 opacity-90" />
              <span className="text-sm font-medium truncate">{attachment.name || 'Gambar'}</span>
            </div>
          </div>
        );
      }

      return (
        <div className="w-full max-w-[min(64vw,212px)] sm:max-w-[280px] md:max-w-[340px] overflow-hidden rounded-[14px] ring-1 ring-black/10 dark:ring-white/10">
          <img
            src={src}
            alt={attachment.name || 'Gambar'}
            className="block max-h-[min(42vh,248px)] sm:max-h-[320px] w-full object-contain bg-black/5 dark:bg-white/5"
            loading="lazy"
          />
        </div>
      );
    }

    if (attachment.kind === 'audio') {
      const src = attachment.previewUrl;
      const metaTextColor = isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400';

      return (
        <div className="mt-1 w-[280px] sm:w-[340px]">
          {src ? (
            <audio controls src={src} preload="metadata" className="w-full" />
          ) : (
            <div className={`text-xs ${metaTextColor}`}>
              Preview audio tidak tersedia.
            </div>
          )}
          <div className={`mt-1 flex items-center justify-between gap-2 text-[11px] ${metaTextColor}`}>
            <span className="truncate">{attachment.name || 'Audio'}</span>
            <span className="shrink-0">
              {formatAudioType(attachment)} • {formatBytes(attachment.size)}
            </span>
          </div>
        </div>
      );
    }

    const href = attachment.previewUrl;
    const docType = formatDocumentType(attachment);
    const docCardClass = isUser
      ? 'bg-white/95 border-white/50 hover:bg-white'
      : 'bg-white dark:bg-slate-900/70 border-gray-200/80 dark:border-white/15 hover:bg-white dark:hover:bg-slate-900/80';

    const documentCard = (
      <div className={`mt-1 w-[min(62vw,216px)] sm:w-[260px] rounded-xl border px-2 py-1.5 transition-colors ${docCardClass}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate" title={attachment.name || undefined}>
              {attachment.name || 'Dokumen'}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              Document | {docType} | {formatBytes(attachment.size)}
            </div>
          </div>
        </div>
      </div>
    );

    if (!href) {
      return documentCard;
    }

    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className="block">
        {documentCard}
      </a>
    );
  };

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }

      try {
        shouldRestartRecognitionRef.current = false;
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }

      if (audioSampleIntervalRef.current !== null) {
        window.clearInterval(audioSampleIntervalRef.current);
        audioSampleIntervalRef.current = null;
      }

      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      analyserRef.current = null;
      if (ctx) {
        ctx.close().catch(() => undefined);
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      stopVoicePreview();
    };
  }, [stopVoicePreview]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      return;
    }

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(Math.round(offset));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (!keyboardOffset) {
      return;
    }

    // Sebagian browser akan tetap mencoba menggeser window saat keyboard muncul.
    // Jaga window tetap di top agar header + pesan tidak "hilang" (kasus foto ke-3).
    const reset = () => keepWindowAtTop();
    reset();
    const raf = window.requestAnimationFrame(reset);
    const t1 = window.setTimeout(reset, 80);
    const t2 = window.setTimeout(reset, 240);
    const t3 = window.setTimeout(reset, 420);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [keyboardOffset, keepWindowAtTop]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) {
      return;
    }

    const update = () => {
      setComposerHeight(Math.round(el.getBoundingClientRect().height));
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let raf = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        resizeTickRef.current += 1;
        forceResizeTick(resizeTickRef.current);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const userMessageCount = messages.filter((message) => message.role === 'user').length;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || userMessageCount === 0) {
      lastAutoScrollMessageIdRef.current = lastMessage?.id ?? null;
      container.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const isNearBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight) < 160;

    const isNewMessage = lastAutoScrollMessageIdRef.current !== lastMessage.id;
    lastAutoScrollMessageIdRef.current = lastMessage.id;

    if (!isNewMessage) {
      return;
    }

    if (lastMessage.role === 'user' || isTyping || isNearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const userMessageCount = messages.filter((message) => message.role === 'user').length;
    const keyboardJustOpened = prevKeyboardOffsetRef.current === 0 && keyboardOffset > 0;
    prevKeyboardOffsetRef.current = keyboardOffset;

    if (userMessageCount !== 0) {
      return;
    }

    if (!keyboardOffset || (!keyboardJustOpened && container.scrollTop === 0)) {
      return;
    }

    const scrollToTop = () => {
      container.scrollTo({ top: 0, behavior: 'auto' });
      keepWindowAtTop();
    };
    scrollToTop();
    window.requestAnimationFrame(scrollToTop);
    window.setTimeout(scrollToTop, 80);
    window.setTimeout(scrollToTop, 240);
    window.setTimeout(scrollToTop, 420);
  }, [keyboardOffset, keepWindowAtTop, messages]);

  const handleInputFocus = useCallback(() => {
    if (hasUserMessages) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    keepWindowAtTop();
    const scrollToTop = () => {
      container.scrollTo({ top: 0, behavior: 'auto' });
      keepWindowAtTop();
    };
    scrollToTop();
    window.requestAnimationFrame(scrollToTop);
    window.setTimeout(scrollToTop, 120);
    window.setTimeout(scrollToTop, 320);
  }, [hasUserMessages, keepWindowAtTop]);

  const handleInputPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLTextAreaElement>) => {
      if (event.pointerType !== 'touch') {
        return;
      }

      const el = event.currentTarget;
      if (document.activeElement === el) {
        return;
      }

      // Ambil alih fokus untuk mencegah browser melakukan auto-scroll ke bawah.
      event.preventDefault();
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }

      try {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      } catch {
        // ignore
      }

      keepWindowAtTop();
    },
    [keepWindowAtTop],
  );

  useEffect(() => {
    if (!showAttachmentMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (target && attachmentMenuRef.current?.contains(target)) {
        return;
      }

      setShowAttachmentMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAttachmentMenu]);

  const clearPendingAttachment = useCallback(
    (eventOrOptions?: React.SyntheticEvent | { revoke?: boolean }) => {
      stopVoicePreview();
      const revoke =
        eventOrOptions &&
        typeof eventOrOptions === 'object' &&
        'revoke' in eventOrOptions
          ? (eventOrOptions as { revoke?: boolean }).revoke ?? true
          : true;
      setPendingAttachment((prev) => {
        if (revoke && prev?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return null;
      });
    },
    [stopVoicePreview],
  );

  useEffect(() => {
    if (!pendingAttachment || pendingAttachment.kind !== 'audio') {
      stopVoicePreview();
      return;
    }

    if (
      voicePreviewAudioUrlRef.current &&
      pendingAttachment.previewUrl !== voicePreviewAudioUrlRef.current
    ) {
      stopVoicePreview();
    }
  }, [pendingAttachment, stopVoicePreview]);

  useEffect(() => {
    if (!isPlayingVoicePreview) {
      setVoiceReplayWaveShift(0);
      return;
    }

    const timerId = window.setInterval(() => {
      setVoiceReplayWaveShift((prev) => (prev + 1) % 42);
    }, 85);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isPlayingVoicePreview]);

  useEffect(() => {
    if (currentModel.id !== 'furina' || !pendingAttachment || pendingAttachment.kind === 'image') {
      return;
    }

    if (pendingAttachment.kind === 'audio') {
      clearVoiceDraft();
    } else {
      clearPendingAttachment();
    }

    toast.info('Sparkle hanya menerima lampiran gambar. Lampiran non-gambar dilepas otomatis.');
  }, [clearPendingAttachment, clearVoiceDraft, currentModel.id, pendingAttachment]);

  const serializeHistoryForApi = useCallback(
    (history: ApiHistoryItem[]) =>
      history.map((item) => ({
        role: item.role,
        content: item.content,
        attachment: item.attachment
          ? ({
              kind: item.attachment.kind,
              name: item.attachment.name,
              mimeType: item.attachment.mimeType,
              size: item.attachment.size,
              fileUri: item.attachment.fileUri,
            } satisfies ChatAttachment)
          : undefined,
      })),
    [],
  );

  const getPromptForModel = useCallback(
    (messageText: string, attachment?: ChatAttachment | null) =>
      messageText.trim() ||
      (attachment?.kind === 'image'
        ? 'Tolong jelaskan isi gambar ini.'
        : attachment
          ? 'Tolong jelaskan isi dokumen ini.'
          : messageText),
    [],
  );

  const buildAssistantSystemInstruction = useCallback(
    (
      userMessageText: string,
      historyForMood: Array<{ role: 'user' | 'assistant'; content: string }>,
      promptForModel: string,
      attachment?: ChatAttachment | null,
    ) => {
      const isCodingCompanion = currentModel.id === 'inori';
      const isEmotionalCompanion = currentModel.id === 'lanna';
      const isImageCompanion = currentModel.id === 'furina';
      const wantsImageGeneration = looksLikeImageGenerationRequest(
        promptForModel,
        attachment ?? undefined,
      );
      const moodSignal = inferUserMood(userMessageText, historyForMood);
      const moodGuidance =
        moodSignal.mood === 'romantis'
          ? isCodingCompanion
            ? [
                `Mood user (perkiraan): romantis/flirty (${moodSignal.confidence}).`,
                '- Balas ramah dan hangat, tapi arahkan pelan-pelan ke topik coding.',
                '- Jangan flirting berlebihan; fokus utama tetap bantu ngoding.',
              ]
            : [
                `Mood user (perkiraan): romantis/flirty (${moodSignal.confidence}).`,
                '- Balas hangat, manis, dan sopan (tanpa asumsi sedih).',
                '- Kalau user pakai panggilan sayang/beb/dear, boleh dibalas serupa secukupnya.',
                '- Tetap ajak ngobrol balik dengan pertanyaan ringan.',
              ]
          : moodSignal.mood === 'salting'
            ? [
                `Mood user (perkiraan): salting/malu (${moodSignal.confidence}).`,
                '- Balas playful dan menenangkan, jangan bikin user makin canggung.',
                '- Beri ruang: tanya pelan-pelan dan jangan terlalu agresif.',
              ]
            : moodSignal.mood === 'bahagia'
              ? [
                  `Mood user (perkiraan): bahagia/antusias (${moodSignal.confidence}).`,
                  '- Ikuti antusiasnya, beri respon positif, lalu tanya detailnya.',
                ]
              : moodSignal.mood === 'sedih'
                ? [
                    `Mood user (perkiraan): sedih/tertekan (${moodSignal.confidence}).`,
                    '- Validasi perasaan user, respons lembut, lalu tanya apa yang terjadi.',
                    '- Beri bantuan langkah kecil yang realistis; jangan menghakimi.',
                  ]
                : [`Mood user (perkiraan): netral (${moodSignal.confidence}).`];

      const systemInstruction = [
        `Kamu adalah ${currentModel.name}. ${currentModel.description}.`,
        `Kepribadian: ${currentModel.personality}`,
        ...(isCodingCompanion
          ? [
              '',
              'Spesialisasi (wajib):',
              '- Kamu adalah asisten coding/pair programmer. Fokus utama: pemrograman, debugging, desain, dan best practice.',
              '- Kalau user bertanya di luar coding, jawab singkat lalu arahkan kembali ke konteks ngoding (atau sarankan pakai model lain untuk ngobrol santai).',
              '- Saat memberi kode, utamakan correctness, readability, dan contoh yang bisa langsung dijalankan.',
            ]
          : []),
        ...(isEmotionalCompanion
          ? [
              '',
              'Spesialisasi (wajib):',
              '- Kamu adalah teman cerita yang peka terhadap mood manusia. Prioritas utama: menemani user, mendengarkan, dan merespons dengan empati.',
              '- Gunakan bahasa yang hangat, natural, manusiawi, dan suportif.',
              '- Saat user sedih/cemas, validasi perasaan user dulu lalu beri dukungan langkah kecil yang realistis.',
              '- Saat user bahagia/ceria, ikut antusias secukupnya dan ajak lanjut bercerita.',
              '- Hindari nada kaku seperti bot; balasan harus terasa seperti teman ngobrol.',
            ]
          : []),
        ...(isImageCompanion
          ? [
              '',
              'Spesialisasi (wajib):',
              '- Kamu adalah spesialis generate gambar/ilustrasi. Prioritas utama: menghasilkan gambar, bukan paragraf panjang.',
              '- Ubah ide user menjadi prompt visual yang jelas (subjek, style, pencahayaan, komposisi, warna, detail).',
              '- Jika prompt kurang jelas, ajukan maksimal 1-2 klarifikasi singkat lalu langsung lanjut generate.',
              '- Untuk permintaan non-visual, arahkan user kembali ke konteks pembuatan gambar dengan singkat.',
            ]
          : []),
        '',
        ...moodGuidance,
        '',
        'Aturan gaya (wajib):',
        '- Jawab ringkas, natural, dan to-the-point.',
        '- Jika permintaan ambigu, ajukan 1-3 pertanyaan klarifikasi dulu (jangan langsung memberi banyak contoh).',
        '- Jika pesan singkat bernuansa romantis/salting/sapaan, balas hangat dulu baru tanya pertanyaan ringan.',
        '- Fokus pada solusi; hindari pengulangan, basa-basi panjang, dan respon berlebihan.',
        '- Bahasa default: Indonesia (kecuali user minta bahasa lain).',
        '- Gunakan Markdown seperlunya (daftar & blok kode). Jangan tampilkan escape seperti \\\" kecuali diminta.',
        '- Emoji seperlunya (maks 1, dan hanya jika user memakai emoji).',
        '',
        'Empati:',
        '- Jangan menyimpulkan emosi negatif tanpa sinyal jelas.',
        '- Perhatikan emosi user (sedih/bahagia/salting/romantis/netral) dan sesuaikan gaya bahasa.',
        ...(isCodingCompanion
          ? [
              '',
              'Jika user minta coding:',
              '- Tanyakan spesifikasi minimal jika belum jelas (tujuan, input/output, contoh, batasan).',
              '- Beri satu solusi terbaik yang rapi dan siap jalan.',
              '- Tulis kode dalam blok ```language``` dan setelahnya beri 1-3 langkah cara menjalankan.',
            ]
          : []),
        ...(isImageCompanion
          ? [
              '',
              'Jika user minta gambar:',
              '- Prioritaskan output berupa gambar jika prompt sudah cukup jelas.',
              '- Ringkas teks pendamping, fokus pada hasil visual.',
            ]
          : []),
        ...(isEmotionalCompanion
          ? [
              '',
              'Jika user minta gambar:',
              '- Kamu bisa generate gambar dengan kualitas standar.',
              '- Jika user butuh kualitas gambar paling bagus, sarankan gunakan model Sparkle.',
            ]
          : []),
      ].join('\n');

      return {
        isCodingCompanion,
        isEmotionalCompanion,
        isImageCompanion,
        wantsImageGeneration,
        systemInstruction,
      };
    },
    [currentModel],
  );

  const requestAssistantResponse = useCallback(
    async ({
      promptForModel,
      historyForApi,
      systemInstruction,
      attachmentToSend,
      isCodingCompanion,
      isEmotionalCompanion,
      isImageCompanion,
      wantsImageGeneration,
    }: {
      promptForModel: string;
      historyForApi: ApiHistoryItem[];
      systemInstruction: string;
      attachmentToSend?: ChatAttachment | null;
      isCodingCompanion: boolean;
      isEmotionalCompanion: boolean;
      isImageCompanion: boolean;
      wantsImageGeneration: boolean;
    }) => {
      if (isImageCompanion && attachmentToSend && attachmentToSend.kind !== 'image') {
        throw new ChatApiError('Sparkle hanya menerima lampiran gambar.', {
          status: 400,
          code: 'FURINA_NON_IMAGE_ATTACHMENT',
        });
      }

      const canUseImageRoute =
        (isImageCompanion || (isEmotionalCompanion && wantsImageGeneration)) &&
        (!attachmentToSend || attachmentToSend.kind === 'image');

      return canUseImageRoute
        ? generateGeminiImage(
            promptForModel,
            historyForApi,
            systemInstruction,
            attachmentToSend ?? undefined,
            isImageCompanion ? 'lan-image-worker' : 'gemini-2.5-flash-image',
          )
        : askGemini(
            promptForModel,
            historyForApi,
            systemInstruction,
            attachmentToSend ?? undefined,
            isCodingCompanion ? 'gemini-2.5-pro' : '',
          );
    },
    [],
  );

  const copyText = useCallback(async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }, []);

  const handleCopyResponse = useCallback(
    async (messageId: string, content: string) => {
      if (!content.trim()) {
        toast.info('Tidak ada teks untuk disalin.');
        return;
      }

      try {
        await copyText(content);
        setCopiedMessageId(messageId);
        toast.success('Respons disalin.');
      } catch {
        toast.error('Gagal menyalin respons.');
      }
    },
    [copyText],
  );

  const handleShareResponse = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) {
        toast.info('Tidak ada teks untuk dibagikan.');
        return;
      }

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Respons ${currentModel.name}`,
            text,
          });
          return;
        } catch (error) {
          const errorName =
            error && typeof error === 'object' && 'name' in error
              ? String((error as { name?: string }).name || '')
              : '';
          if (errorName === 'AbortError') {
            return;
          }
        }
      }

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      toast.success('Membuka WhatsApp untuk berbagi respons.');
    },
    [currentModel.name],
  );

  const handleSubmitFeedback = useCallback(
    async (messageId: string, feedbackType: AssistantFeedbackType) => {
      if (savingFeedbackMessageId) {
        return;
      }

      const previousValue = feedbackByMessageId[messageId];
      if (previousValue === feedbackType) {
        toast.info('Feedback ini sudah dipilih.');
        return;
      }

      const feedbackRatingMap: Record<AssistantFeedbackType, number> = {
        positive: 5,
        neutral: 3,
        negative: 1,
      };

      setSavingFeedbackMessageId(messageId);
      try {
        await submitAssistantFeedback({
          userId: user?.id,
          messageId,
          modelName: currentModel.id,
          feedbackType,
          rating: feedbackRatingMap[feedbackType],
        });
        setFeedbackByMessageId((prev) => ({
          ...prev,
          [messageId]: feedbackType,
        }));
        toast.success('Feedback terkirim.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menyimpan feedback.';
        toast.error(message);
      } finally {
        setSavingFeedbackMessageId(null);
      }
    },
    [currentModel.id, feedbackByMessageId, savingFeedbackMessageId, user?.id],
  );

  const handleChooseAssistantVariant = useCallback(
    (messageId: string, variantIndex: number) => {
      setAssistantResponseVariants((prev) => {
        const current = prev[messageId];
        if (!current || !Array.isArray(current.variants) || current.variants.length === 0) {
          return prev;
        }

        const safeIndex = Math.max(0, Math.min(variantIndex, current.variants.length - 1));
        return {
          ...prev,
          [messageId]: {
            ...current,
            selectedIndex: safeIndex,
            compareMode: false,
          },
        };
      });
    },
    [],
  );

  const handleNavigateAssistantVariant = useCallback(
    (messageId: string, direction: -1 | 1) => {
      setAssistantResponseVariants((prev) => {
        const current = prev[messageId];
        if (!current || !Array.isArray(current.variants) || current.variants.length <= 1) {
          return prev;
        }

        const nextIndex = Math.max(
          0,
          Math.min(current.selectedIndex + direction, current.variants.length - 1),
        );
        if (nextIndex === current.selectedIndex) {
          return prev;
        }

        return {
          ...prev,
          [messageId]: {
            ...current,
            selectedIndex: nextIndex,
            compareMode: false,
          },
        };
      });
    },
    [],
  );

  const handleRegenerateResponse = useCallback(
    async (assistantMessageId: string) => {
      if (isTyping || regeneratingMessageId) {
        return;
      }

      const assistantIndex = messages.findIndex(
        (message) => message.id === assistantMessageId && message.role === 'assistant',
      );
      if (assistantIndex < 0) {
        toast.error('Pesan asisten tidak ditemukan.');
        return;
      }

      const userIndex = (() => {
        for (let index = assistantIndex - 1; index >= 0; index -= 1) {
          if (messages[index]?.role === 'user') {
            return index;
          }
        }
        return -1;
      })();
      if (userIndex < 0) {
        toast.error('Pesan user sebelum respons ini tidak ditemukan.');
        return;
      }

      const sourceUserMessage = messages[userIndex];
      const sourceAssistantMessage = messages[assistantIndex];
      const historyBeforeUser = messages.slice(0, userIndex).map((item) => ({
        role: item.role,
        content: item.content,
        attachment: item.attachment
          ? {
              kind: item.attachment.kind,
              name: item.attachment.name,
              mimeType: item.attachment.mimeType,
              size: item.attachment.size,
              fileUri: item.attachment.fileUri,
            }
          : undefined,
      })) as ApiHistoryItem[];
      const attachmentToSend = sourceUserMessage.attachment as ChatAttachment | undefined;
      const promptForModel = getPromptForModel(
        sourceUserMessage.content,
        attachmentToSend ?? undefined,
      );
      const regeneratePromptForModel = [
        promptForModel,
        '',
        'Instruksi regenerasi:',
        '- Berikan jawaban alternatif yang jelas berbeda dari jawaban sebelumnya.',
        '- Jangan menyalin ulang kalimat yang sama.',
        `Jawaban sebelumnya:\n${String(sourceAssistantMessage.content || '').trim() || '(kosong)'}`,
      ].join('\n');
      const assistantSetup = buildAssistantSystemInstruction(
        sourceUserMessage.content,
        historyBeforeUser.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        promptForModel,
        attachmentToSend ?? undefined,
      );

      setRegeneratingMessageId(assistantMessageId);
      setTyping(true);

      try {
        const response = await requestAssistantResponse({
          promptForModel: regeneratePromptForModel,
          historyForApi: serializeHistoryForApi(historyBeforeUser),
          systemInstruction: assistantSetup.systemInstruction,
          attachmentToSend,
          isCodingCompanion: assistantSetup.isCodingCompanion,
          isEmotionalCompanion: assistantSetup.isEmotionalCompanion,
          isImageCompanion: assistantSetup.isImageCompanion,
          wantsImageGeneration: assistantSetup.wantsImageGeneration,
        });

        const regeneratedVariant: AssistantResponseVariant = {
          content: response.reply,
          attachment: response.attachment,
          timestamp: new Date(),
        };

        setAssistantResponseVariants((prev) => {
          const existingState = prev[assistantMessageId];
          const originalVariant: AssistantResponseVariant =
            existingState?.variants?.[0] || {
              content: sourceAssistantMessage.content,
              attachment: sourceAssistantMessage.attachment as ChatAttachment | undefined,
              timestamp:
                sourceAssistantMessage.timestamp instanceof Date
                  ? sourceAssistantMessage.timestamp
                  : new Date(sourceAssistantMessage.timestamp),
            };

          return {
            ...prev,
            [assistantMessageId]: {
              variants: [originalVariant, regeneratedVariant],
              selectedIndex: 1,
              compareMode: true,
            },
          };
        });
        toast.success('Respons alternatif siap. Pilih respons yang kamu suka.');
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengulang respons model. Coba lagi.');
      } finally {
        setTyping(false);
        setRegeneratingMessageId(null);
      }
    },
    [
      buildAssistantSystemInstruction,
      getPromptForModel,
      isTyping,
      messages,
      regeneratingMessageId,
      requestAssistantResponse,
      serializeHistoryForApi,
      setAssistantResponseVariants,
      setTyping,
    ],
  );

  useEffect(() => {
    if (!copiedMessageId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedMessageId(null);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedMessageId]);

  const handleSend = async () => {
    if (!input.trim() && !pendingAttachment) return;
    if (isTyping) return;

    const draftBeforeSend = input;
    const attachmentBeforeSend = pendingAttachment;
    const isVoiceDraft = pendingAttachment?.kind === 'audio';
    const resolvedVoiceText = isVoiceDraft
      ? (input.trim() || voiceTranscriptRef.current.trim() || voiceTranscript.trim() || voiceInterimTranscript.trim())
      : '';

    if (isVoiceDraft && !resolvedVoiceText) {
      toast.error('Belum ada suara yang bisa dikirim. Coba rekam ulang.');
      return;
    }

    const userMessage = isVoiceDraft ? resolvedVoiceText : input;
    const attachmentToSend = isVoiceDraft ? null : pendingAttachment;

    setInput('');
    if (isVoiceDraft) {
      clearVoiceDraft();
    } else {
      clearPendingAttachment({ revoke: false });
    }

    let userMessageId: string | null = null;

    try {
      userMessageId = appendMessage('user', userMessage, cloneAttachment(attachmentToSend));
      setTyping(true);

      const historyForApi = serializeHistoryForApi(
        messages.map((item) => ({
          role: item.role,
          content: item.content,
          attachment: item.attachment
            ? {
                kind: item.attachment.kind,
                name: item.attachment.name,
                mimeType: item.attachment.mimeType,
                size: item.attachment.size,
                fileUri: item.attachment.fileUri,
              }
            : undefined,
        })) as ApiHistoryItem[],
      );

      const promptForModel = getPromptForModel(userMessage, attachmentToSend ?? undefined);
      const assistantSetup = buildAssistantSystemInstruction(
        userMessage,
        messages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        promptForModel,
        attachmentToSend ?? undefined,
      );
      const response = await requestAssistantResponse({
        promptForModel,
        historyForApi,
        systemInstruction: assistantSetup.systemInstruction,
        attachmentToSend,
        isCodingCompanion: assistantSetup.isCodingCompanion,
        isEmotionalCompanion: assistantSetup.isEmotionalCompanion,
        isImageCompanion: assistantSetup.isImageCompanion,
        wantsImageGeneration: assistantSetup.wantsImageGeneration,
      });
      const { reply, attachment: responseAttachment } = response;

      if (attachmentToSend && responseAttachment?.fileUri) {
        updateMessageAttachment(userMessageId, {
          kind: responseAttachment.kind,
          name: responseAttachment.name,
          mimeType: responseAttachment.mimeType,
          size: responseAttachment.size,
          fileUri: responseAttachment.fileUri,
        });
      }

      if (responseAttachment?.previewUrl) {
        appendMessage('assistant', reply, responseAttachment);
      } else {
        appendMessage('assistant', reply);
      }
    } catch (err) {
      console.error(err);
      // Jangan tampilkan toast error; error dijelaskan lewat balasan asisten.

      // Jelaskan error sebagai balasan asisten (fallback) + restore draft agar bisa resend.
      if (userMessageId) {
        appendMessage('assistant', formatAssistantErrorReply(err));
      }

      if (!isVoiceDraft) {
        setInput(draftBeforeSend);
        if (attachmentBeforeSend) {
          setPendingAttachment(cloneAttachment(attachmentBeforeSend) ?? null);
        }
      }
    } finally {
      setTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleViewVoiceText = useCallback(() => {
    const text =
      voiceTranscriptRef.current.trim() ||
      voiceTranscript.trim() ||
      voiceInterimTranscript.trim();

    if (!text) {
      toast.info('Teks belum tersedia. Coba rekam lebih jelas.');
      return;
    }

    setInput(text);
    window.setTimeout(() => focusComposerInput({ preventScroll: true }), 0);
  }, [focusComposerInput, voiceInterimTranscript, voiceTranscript]);

  const handleMicClick = useCallback(() => {
    const SILENCE_STOP_AFTER_MS = 1600;
    const NO_SPEECH_STOP_AFTER_MS = 4000;
    const MIN_RECORDING_MS = 1200;
    const SOUND_RMS_THRESHOLD = 0.02;
    const SAMPLE_INTERVAL_MS = 150;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    const pickAudioMimeType = () => {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ];
      return candidates.find((type) => (window.MediaRecorder?.isTypeSupported?.(type) ? true : false)) || '';
    };

    const extensionFromMimeType = (mimeType: string) => {
      if (mimeType.includes('ogg')) return 'ogg';
      if (mimeType.includes('mp4')) return 'm4a';
      return 'webm';
    };

    const stopRecording = () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch (_error) {
        // ignore
      }

      try {
        shouldRestartRecognitionRef.current = false;
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }

      if (audioSampleIntervalRef.current !== null) {
        window.clearInterval(audioSampleIntervalRef.current);
        audioSampleIntervalRef.current = null;
      }

      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      analyserRef.current = null;
      if (ctx) {
        ctx.close().catch(() => undefined);
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      hasSpokenRef.current = false;
      lastSoundAtRef.current = null;
      recordingStartedAtRef.current = null;
    };

    if (isRecording) {
      stopRecording();
      setIsRecording(false);
      toast.info('Rekaman dihentikan.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('Browser tidak mendukung perekaman audio. Gunakan Chrome/Edge terbaru.');
      return;
    }

    void (async () => {
      try {
        if (pendingAttachment?.kind === 'audio') {
          clearVoiceDraft();
        }
        resetVoiceDraft();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = pickAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        hasSpokenRef.current = false;
        lastSoundAtRef.current = null;
        recordingStartedAtRef.current = Date.now();

        if (SpeechRecognitionCtor) {
          try {
            const recognition = new SpeechRecognitionCtor();
            recognitionRef.current = recognition;
            shouldRestartRecognitionRef.current = true;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'id-ID';

            recognition.onresult = (event: SpeechRecognitionEvent) => {
              let interim = '';
              let finalText = voiceTranscriptRef.current;

              for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const transcriptPiece = result?.[0]?.transcript || '';
                if (!transcriptPiece) {
                  continue;
                }
                if (result.isFinal) {
                  finalText = `${finalText} ${transcriptPiece}`.trim();
                } else {
                  interim = `${interim} ${transcriptPiece}`.trim();
                }
              }

              voiceTranscriptRef.current = finalText;
              setVoiceTranscript(finalText);
              setVoiceInterimTranscript(interim);
            };

            recognition.onerror = () => {
              // speech recognition optional
            };

            recognition.onend = () => {
              if (!shouldRestartRecognitionRef.current) {
                return;
              }
              window.setTimeout(() => {
                try {
                  recognition.start();
                } catch {
                  // ignore
                }
              }, 250);
            };

            recognition.start();
          } catch {
            // ignore
          }
        }

        try {
          const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextCtor) {
            const ctx = new AudioContextCtor() as AudioContext;
            await ctx.resume().catch(() => undefined);
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            audioContextRef.current = ctx;
            analyserRef.current = analyser;

            const buffer = new Uint8Array(analyser.fftSize);
            audioSampleIntervalRef.current = window.setInterval(() => {
              const currentAnalyser = analyserRef.current;
              const startedAt = recordingStartedAtRef.current ?? Date.now();
              if (!currentAnalyser) {
                return;
              }

              currentAnalyser.getByteTimeDomainData(buffer);
              let sumSquares = 0;
              for (let i = 0; i < buffer.length; i += 1) {
                const v = (buffer[i] - 128) / 128;
                sumSquares += v * v;
              }
              const rms = Math.sqrt(sumSquares / buffer.length);
              const now = Date.now();

              const level = Math.min(1, Math.max(0, rms * 10));
              setVoiceWaveform((prev) => {
                const next = prev.length >= 42 ? [...prev.slice(1), level] : [...prev, level];
                return next;
              });

              if (rms >= SOUND_RMS_THRESHOLD) {
                hasSpokenRef.current = true;
                lastSoundAtRef.current = now;
                return;
              }

              if (now - startedAt < MIN_RECORDING_MS) {
                return;
              }

              if (hasSpokenRef.current) {
                const lastSoundAt = lastSoundAtRef.current ?? startedAt;
                if (now - lastSoundAt >= SILENCE_STOP_AFTER_MS) {
                  stopRecording();
                  setIsRecording(false);
                  toast.info('Rekaman selesai. Klik "Lihat teks" atau langsung kirim.');
                }
                return;
              }

              if (now - startedAt >= NO_SPEECH_STOP_AFTER_MS) {
                stopRecording();
                setIsRecording(false);
                toast.info('Rekaman selesai. Klik "Lihat teks" atau langsung kirim.');
              }
            }, SAMPLE_INTERVAL_MS);
          }
        } catch {
          // Kalau VAD gagal, user tetap bisa stop manual.
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const previewUrl = URL.createObjectURL(blob);
          const safeMimeType = blob.type || recorder.mimeType || 'audio/webm';
          const extension = extensionFromMimeType(safeMimeType);
          const fileName = `recording-${Date.now()}.${extension}`;
          const file = new File([blob], fileName, { type: safeMimeType });

          setPendingAttachment((prev) => {
            if (prev?.previewUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(prev.previewUrl);
            }
            return {
              kind: 'audio',
              name: fileName,
              mimeType: safeMimeType,
              size: file.size,
              file,
              previewUrl,
            };
          });

          setVoiceInterimTranscript('');
          toast.success('Rekaman tersimpan.');
        };

        recorder.start();
        setIsRecording(true);
        toast.info('Merekam... Bicara sekarang.');
      } catch (error) {
        console.error(error);
        setIsRecording(false);
        toast.error('Gagal mengakses mikrofon. Pastikan izin mic aktif.');
      }
    })();
  }, [clearVoiceDraft, isRecording, pendingAttachment?.kind, resetVoiceDraft]);

  const handleAttachmentClick = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  const handleFileSelect = (type: 'image' | 'file' | 'camera') => {
    setShowAttachmentMenu(false);

    if (currentModel.id === 'furina' && type === 'file') {
      toast.info('Sparkle fokus untuk generate gambar. Gunakan lampiran gambar.');
      return;
    }

    if (type === 'camera') {
      toast.info('Fitur kamera segera hadir!');
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.accept =
          type === 'image'
            ? 'image/*'
            : [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                '.pdf',
                '.doc',
                '.docx',
                '.txt',
              ].join(',');
      }
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = file.type?.startsWith('image/');
      const kind: ChatAttachment['kind'] = isImage ? 'image' : 'document';
      const previewUrl = URL.createObjectURL(file);

      setPendingAttachment((prev) => {
        if (prev?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return {
          kind,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          file,
          previewUrl,
        };
      });
      toast.success(`${isImage ? 'Gambar' : 'Dokumen'} "${file.name}" ditambahkan.`);
    }
    e.target.value = '';
  };

  const handleLoadChat = (sessionId: string) => {
    loadSession(sessionId);
    setShowSidebar(false);
    toast.info('Riwayat chat dimuat.');
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession(id);
    toast.success('Chat dihapus');
  };

  const handleTogglePinChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = toggleSessionPin(id);
    if (!result.ok) {
      if (result.reason === 'limit') {
        toast.error(`Maksimal ${maxPinnedSessions} chat yang bisa di-pin.`);
      } else {
        toast.error('Chat tidak ditemukan.');
      }
      return;
    }

    toast.success(result.pinned ? 'Chat dipin ke atas.' : 'Pin chat dilepas.');
  };

  const getSessionModel = useCallback(
    (modelId: string) => CHAT_MODELS.find((model) => model.id === modelId) ?? CHAT_MODELS[0],
    [],
  );

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();

    return chatSessions
      .filter((session) => session.messages.some((message) => message.role === 'user'))
      .filter(
        (session) =>
          session.title.toLowerCase().includes(normalizedSearch) ||
          session.preview.toLowerCase().includes(normalizedSearch) ||
          getSessionModel(session.modelId).name.toLowerCase().includes(normalizedSearch),
      )
      .sort((left, right) => {
        const leftPinnedAt = left.pinnedAt ? left.pinnedAt.getTime() : 0;
        const rightPinnedAt = right.pinnedAt ? right.pinnedAt.getTime() : 0;
        const leftIsPinned = leftPinnedAt > 0;
        const rightIsPinned = rightPinnedAt > 0;

        if (leftIsPinned && !rightIsPinned) return -1;
        if (!leftIsPinned && rightIsPinned) return 1;
        if (leftIsPinned && rightIsPinned) {
          return rightPinnedAt - leftPinnedAt;
        }

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });
  }, [chatSessions, getSessionModel, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20 bg-gray-50 dark:bg-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Silakan Masuk</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Masuk untuk mulai chat dengan Lanna!</p>
          <Button onClick={() => onNavigate('login')} className="bg-gradient-to-r from-blue-500 to-cyan-400">
            Masuk
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] h-[100dvh] pt-20 flex flex-col relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/25 via-blue-500/20 to-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-48 -right-28 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-blue-500/15 to-cyan-400/10 blur-3xl" />
      </div>
      {/* Chat Header */}
      <div className="bg-white/75 dark:bg-slate-900/65 backdrop-blur border-b border-white/40 dark:border-slate-800/70 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-white/5 transition-colors"
              title="Buka riwayat"
            >
              <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={handleSpeakLatestResponse}
              disabled={!isSpeakingResponse && !latestAssistantResponse}
              className={`p-2 rounded-xl transition-colors ${
                isSpeakingResponse
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'hover:bg-gray-100/80 dark:hover:bg-white/5'
              } ${
                !isSpeakingResponse && !latestAssistantResponse
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              title={
                isSpeakingResponse
                  ? `Hentikan suara${speakingMessageId ? ' respons aktif' : ''}`
                  : 'Bacakan respons model'
              }
            >
              {isSpeakingResponse ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          </div>

          <button
            onClick={() => setShowModelSelector(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-white/5 transition-colors"
            title="Pilih teman"
          >
            <span className="font-medium text-gray-900 dark:text-white">{currentModel.name}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          <button 
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            title="Profil"
          >
            <UserAvatar user={user} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">{user?.displayName?.split(' ')[0]}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{
          paddingBottom: composerHeight + (hasUserMessages ? keyboardOffset : 0) + 24,
          overflowAnchor: 'none',
        }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              (() => {
                const compareState =
                  message.role === 'assistant' ? assistantResponseVariants[message.id] : null;
                const userAttachment = message.attachment as ChatAttachment | undefined;
                const isUserImageOnlyMessage =
                  message.role === 'user' &&
                  userAttachment?.kind === 'image' &&
                  !message.content.trim();
                const isUserDocumentOnlyMessage =
                  message.role === 'user' &&
                  userAttachment?.kind === 'document' &&
                  !message.content.trim();
                const isCompareActive = Boolean(
                  compareState?.compareMode &&
                    Array.isArray(compareState?.variants) &&
                    compareState.variants.length > 1,
                );

                return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex min-w-0 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex min-w-0 gap-3 ${
                    isCompareActive
                      ? 'w-full max-w-full gap-1.5 sm:gap-3'
                      : isUserImageOnlyMessage
                        ? 'max-w-[80%] sm:max-w-[80%] gap-2 sm:gap-3'
                        : isUserDocumentOnlyMessage
                          ? 'max-w-[89%] sm:max-w-[78%] gap-5 sm:gap-4'
                          : 'max-w-[86%] sm:max-w-[80%]'
                  } ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  {/* Avatar - Clean without shadow */}
                  {message.role === 'assistant' && (
                    <img
                      src={currentModel.avatar}
                      alt={currentModel.name}
                      className={`rounded-xl object-cover flex-shrink-0 ${
                        isCompareActive ? 'hidden sm:block w-10 h-10' : 'w-10 h-10'
                      }`}
                    />
                  )}
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <UserAvatar user={user} />
                    </div>
                  )}

                  {/* Message content */}
                  {(() => {
                    const isUser = message.role === 'user';
                    const variantState = !isUser ? assistantResponseVariants[message.id] : null;
                    const fallbackVariant: AssistantResponseVariant = {
                      content: message.content,
                      attachment: message.attachment as ChatAttachment | undefined,
                      timestamp:
                        message.timestamp instanceof Date
                          ? message.timestamp
                          : new Date(message.timestamp),
                    };
                    const variants =
                      !isUser && Array.isArray(variantState?.variants) && variantState.variants.length > 0
                        ? variantState.variants
                        : [fallbackVariant];
                    const selectedVariantIndex =
                      !isUser && variantState
                        ? Math.max(0, Math.min(variantState.selectedIndex, variants.length - 1))
                        : 0;
                    const currentVariant = variants[selectedVariantIndex] || fallbackVariant;
                    const compareMode =
                      !isUser && Boolean(variantState?.compareMode && variants.length > 1);
                    const displayMessageContent = isUser
                      ? message.content
                      : currentVariant.content;
                    const displayMessageAttachment = isUser
                      ? (message.attachment as ChatAttachment | undefined)
                      : currentVariant.attachment;
                    const displayTimestamp = isUser
                      ? message.timestamp
                      : currentVariant.timestamp;
                    const displayTimeValue =
                      displayTimestamp instanceof Date
                        ? displayTimestamp
                        : new Date(displayTimestamp);
                    const hasAudioAttachment =
                      (displayMessageAttachment as ChatAttachment | undefined)?.kind === 'audio';
                    const hasImageAttachment =
                      (displayMessageAttachment as ChatAttachment | undefined)?.kind === 'image';
                    const hasDocumentAttachment =
                      (displayMessageAttachment as ChatAttachment | undefined)?.kind === 'document';
                    const isImageOnlyMessage = hasImageAttachment && !displayMessageContent.trim();
                    const isDocumentOnlyMessage =
                      hasDocumentAttachment && !displayMessageContent.trim();
                    const bubblePaddingClass = hasAudioAttachment
                      ? 'px-0 py-0'
                      : hasImageAttachment
                        ? isImageOnlyMessage
                          ? 'p-2 sm:p-2.5'
                          : 'px-2.5 py-2.5'
                        : hasDocumentAttachment
                          ? isDocumentOnlyMessage
                            ? 'px-0 py-0'
                            : 'px-4 py-2.5'
                        : 'px-4 py-2.5';
                    const bubbleClass = hasAudioAttachment || (isUser && isDocumentOnlyMessage)
                      ? 'bg-transparent text-gray-900 dark:text-white shadow-none ring-0'
                      : `shadow-xs ring-1 ring-black/5 dark:ring-white/10 ${
                          isUser
                            ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white'
                            : 'bg-white/80 dark:bg-slate-900/60 backdrop-blur text-gray-900 dark:text-white'
                        }`;
                    const timeClass =
                      isUser && hasDocumentAttachment
                        ? 'mt-1 ml-2 text-[10px] text-gray-500 dark:text-gray-400'
                        : `text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`;
                    const isActionableAssistant =
                      !isUser && !String(message.id || '').startsWith('welcome');
                    const selectedFeedback = feedbackByMessageId[message.id];
                    const isFeedbackBusy = savingFeedbackMessageId === message.id;
                    const isRegenerating = regeneratingMessageId === message.id;

                    return (
                      <div className={`min-w-0 ${compareMode ? 'w-full' : 'max-w-full'}`}>
                        <div className={`min-w-0 max-w-full rounded-2xl ${bubblePaddingClass} ${bubbleClass}`}>
                          {!compareMode &&
                            renderAttachment(displayMessageAttachment as ChatAttachment | undefined, isUser)}
                          {!compareMode &&
                            displayMessageContent.trim() &&
                            (isUser ? (
                              <p
                                className={`text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${displayMessageAttachment ? 'mt-2' : ''}`}
                              >
                                {displayMessageContent}
                              </p>
                            ) : (
                              <MarkdownMessage
                                variant="assistant"
                                content={displayMessageContent}
                                className={displayMessageAttachment ? 'mt-2' : undefined}
                              />
                            ))}
                          {!compareMode && (
                            <p className={timeClass}>
                              {displayTimeValue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {compareMode && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Pilih salah satu dari 2 respons di bawah untuk dipakai.
                            </p>
                          )}
                        </div>

                        {isActionableAssistant && compareMode && variants.length > 1 && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {variants.map((variant, variantIndex) => (
                              <div
                                key={`${message.id}-variant-${variantIndex}`}
                                className={`flex h-[220px] sm:h-[248px] min-h-0 min-w-0 flex-col rounded-md border p-1.5 sm:p-2 ${
                                  selectedVariantIndex === variantIndex
                                    ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500/60 dark:bg-blue-900/20'
                                    : 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/60'
                                }`}
                              >
                                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                  Respons {variantIndex + 1}
                                </div>
                                <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto pr-1">
                                  {renderAttachment(variant.attachment as ChatAttachment | undefined, false)}
                                  {variant.content.trim() ? (
                                    <p
                                      className={`text-[13px] leading-[1.35] sm:text-[14px] sm:leading-[1.45] whitespace-pre-wrap break-words ${
                                        variant.attachment ? 'mt-2' : ''
                                      }`}
                                    >
                                      {toSpeechText(variant.content)}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      Respons kosong.
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleChooseAssistantVariant(message.id, variantIndex)}
                                  className={`mt-2 w-full rounded-md px-2 py-1.5 text-[10px] sm:text-[11px] leading-tight font-semibold whitespace-nowrap ${
                                    selectedVariantIndex === variantIndex
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-black text-white dark:bg-white dark:text-black'
                                  }`}
                                >
                                  {selectedVariantIndex === variantIndex
                                    ? 'Respons dipilih'
                                    : 'Pilih respons ini'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {isActionableAssistant && !compareMode && (
                          <div className="mt-1.5 flex flex-col items-start gap-1 text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:gap-0.5">
                            {variants.length > 1 && (
                              <div className="inline-flex items-center gap-1 rounded-md bg-black/5 px-1 py-0.5 dark:bg-white/10 sm:mr-1">
                                <button
                                  type="button"
                                  onClick={() => handleNavigateAssistantVariant(message.id, -1)}
                                  disabled={selectedVariantIndex <= 0}
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded sm:h-6 sm:w-6 ${
                                    selectedVariantIndex <= 0
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                                  }`}
                                  title="Lihat respons sebelumnya"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="min-w-[2.8rem] text-center text-[11px] font-semibold">
                                  {selectedVariantIndex + 1}/{variants.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleNavigateAssistantVariant(message.id, 1)}
                                  disabled={selectedVariantIndex >= variants.length - 1}
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded sm:h-6 sm:w-6 ${
                                    selectedVariantIndex >= variants.length - 1
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                                  }`}
                                  title="Lihat respons terbaru"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="flex w-full flex-wrap items-center gap-0.5 sm:w-auto">
                            <button
                              type="button"
                              onClick={() => handleCopyResponse(message.id, displayMessageContent)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
                                copiedMessageId === message.id
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10'
                              }`}
                              title={copiedMessageId === message.id ? 'Tersalin' : 'Salin respons'}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitFeedback(message.id, 'positive')}
                              disabled={Boolean(savingFeedbackMessageId)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
                                selectedFeedback === 'positive'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/35 dark:text-blue-300'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10'
                              } ${savingFeedbackMessageId ? 'opacity-60 cursor-not-allowed' : ''}`}
                              title="Feedback bagus"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitFeedback(message.id, 'neutral')}
                              disabled={Boolean(savingFeedbackMessageId)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
                                selectedFeedback === 'neutral'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10'
                              } ${savingFeedbackMessageId ? 'opacity-60 cursor-not-allowed' : ''}`}
                              title="Feedback biasa saja"
                            >
                              <Meh className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitFeedback(message.id, 'negative')}
                              disabled={Boolean(savingFeedbackMessageId)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
                                selectedFeedback === 'negative'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10'
                              } ${savingFeedbackMessageId ? 'opacity-60 cursor-not-allowed' : ''}`}
                              title="Feedback jelek"
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareResponse(displayMessageContent)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:h-7 sm:w-7"
                              title="Bagikan respons"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerateResponse(message.id)}
                              disabled={isTyping || isRegenerating}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:h-7 sm:w-7 ${
                                isTyping || isRegenerating ? 'opacity-60 cursor-not-allowed' : ''
                              }`}
                              title={isRegenerating ? 'Mengulang respons...' : 'Ulang respons model'}
                            >
                              <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                            </button>
                            {isFeedbackBusy && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 sm:ml-1 sm:text-[11px]">Menyimpan...</span>
                            )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
                );
              })()
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex gap-3">
                <img
                  src={currentModel.avatar}
                  alt={currentModel.name}
                  className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                />
                <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur ring-1 ring-black/5 dark:ring-white/10 rounded-2xl px-4 py-3 shadow-xs">
                  <div className="flex gap-1">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <motion.div
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-30 bg-transparent px-4 pt-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        animate={{ y: -keyboardOffset }}
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          className="max-w-4xl mx-auto"
        >
          {(isRecording || pendingAttachment?.kind === 'audio') && (
            <div className="mb-2 rounded-2xl bg-white/70 dark:bg-slate-800/60 px-3.5 py-2.5 ring-1 ring-black/5 dark:ring-white/10">
              <div className="grid grid-cols-[44px_1fr_44px] items-center">
                <div aria-hidden="true" className="w-11 h-11" />
                <button
                  type="button"
                  onClick={handleViewVoiceText}
                  disabled={isRecording}
                  className={`justify-self-center text-base font-semibold leading-none ${
                    isRecording
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'text-gray-800 dark:text-gray-100 hover:opacity-80'
                  }`}
                  title={isRecording ? 'Tunggu sampai rekaman selesai' : 'Lihat teks hasil rekaman'}
                >
                  Lihat teks
                </button>

                {pendingAttachment?.kind === 'audio' && (
                  <div className="justify-self-end flex items-center">
                    <button
                      type="button"
                      onClick={clearVoiceDraft}
                      className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Hapus rekaman"
                    >
                      <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {pendingAttachment?.kind !== 'audio' && <div aria-hidden="true" className="w-11 h-11 justify-self-end" />}
              </div>

              <div className="mt-0.5 grid grid-cols-[48px_1fr] items-center gap-1.5">
                {pendingAttachment?.kind === 'audio' && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleVoicePreview();
                    }}
                    disabled={isRecording || !pendingAttachment.previewUrl}
                    className={`h-11 w-11 rounded-full transition-colors shrink-0 flex items-center justify-center ${
                      isRecording || !pendingAttachment.previewUrl
                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-200'
                    }`}
                    title={isPlayingVoicePreview ? 'Stop dengarkan suara' : 'Dengarkan suara'}
                    aria-label={isPlayingVoicePreview ? 'Stop dengarkan suara' : 'Dengarkan suara'}
                    >
                      {isPlayingVoicePreview ? (
                        <Pause className="w-6 h-6" />
                      ) : (
                        <Play className="w-6 h-6" />
                      )}
                  </button>
                )}
                {pendingAttachment?.kind !== 'audio' && <div aria-hidden="true" className="h-11 w-11" />}
                <div className="flex-1">
                  {renderVoiceWaveform(voiceWaveform, {
                    active: isRecording || isPlayingVoicePreview,
                  })}
                </div>
              </div>
            </div>
          )}

          {pendingAttachment && pendingAttachment.kind !== 'audio' && (
            <div className="mb-2 rounded-2xl bg-white/70 dark:bg-slate-800/60 px-3 py-2 ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Lampiran: {pendingAttachment.kind === 'image' ? 'Gambar' : 'Dokumen'}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white truncate">{pendingAttachment.name}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={clearPendingAttachment}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    title="Hapus lampiran"
                    type="button"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3 bg-white/70 dark:bg-slate-800/60 rounded-3xl sm:rounded-full px-3 sm:px-4 py-2 sm:py-3 shadow-xs ring-1 ring-black/5 dark:ring-white/10">
            {/* Attachment Button */}
            <div ref={attachmentMenuRef} className="relative">
              <button 
                onClick={handleAttachmentClick}
                className="p-1.5 sm:p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              
              {/* Attachment Menu */}
              <AnimatePresence>
                {showAttachmentMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-2 min-w-[140px]"
                  >
                    <button
                      onClick={() => handleFileSelect('image')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left"
                    >
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Gambar</span>
                    </button>
                    {currentModel.id !== 'furina' && (
                      <button
                        onClick={() => handleFileSelect('file')}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left"
                      >
                        <FileText className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Dokumen</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleFileSelect('camera')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-left"
                    >
                      <Camera className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Kamera</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
 
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPointerDownCapture={handleInputPointerDownCapture}
              onFocus={handleInputFocus}
              placeholder={`Tanya ${currentModel.name}`}
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm sm:text-base min-w-0 leading-5 resize-none py-1"
              enterKeyHint="send"
              onInput={resizeComposerTextarea}
            />
 
            {/* Mic Button */}
            <button 
              onClick={handleMicClick}
              className={`p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0 ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>

            {/* Send Button - Always visible */}
            <button
              onClick={handleSend}
              disabled={!input.trim() && !pendingAttachment}
              className="p-2 sm:p-2.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-[filter] flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Sidebar - Chat History - Clean Design */}
      <AnimatePresence>
        {showSidebar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-x-0 bottom-0 top-20 bg-black/40 z-40"
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-20 bottom-0 w-72 sm:w-80 bg-white dark:bg-gray-800 z-40 shadow-xl flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-gray-900 dark:text-white">Lanna</span>
                  </div>
                  <button 
                    onClick={() => setShowSidebar(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* New Chat Button */}
                <button
                  onClick={() => {
                    clearChat();
                    setShowSidebar(false);
                    toast.success('Chat baru dimulai!');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">Chat Baru</span>
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari riwayat..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Chat History List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Riwayat</span>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada riwayat</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredHistory.map((session) => {
                      const sessionModel = getSessionModel(session.modelId);

                      return (
                        <motion.div
                          key={session.id}
                          onClick={() => handleLoadChat(session.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleLoadChat(session.id);
                            }
                          }}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`w-full text-left p-3 rounded-lg transition-colors group ${
                            session.id === activeSessionId
                              ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/50'
                              : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="mb-1 flex items-center gap-1.5">
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                  style={{ backgroundColor: sessionModel.theme.primary }}
                                >
                                  {sessionModel.name}
                                </span>
                                {session.pinnedAt && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    Pin
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {session.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {session.preview}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {session.updatedAt.toLocaleDateString('id-ID')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleTogglePinChat(session.id, e)}
                                className={`p-1.5 rounded transition-colors ${
                                  session.pinnedAt
                                    ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                                    : 'opacity-70 group-hover:opacity-100 text-gray-400 hover:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                                }`}
                                title={session.pinnedAt ? 'Lepas pin' : 'Pin chat'}
                              >
                                <Pin className={`w-3.5 h-3.5 ${session.pinnedAt ? 'fill-current' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteChat(session.id, e)}
                                className="opacity-70 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                                title="Hapus chat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => onNavigate('settings')}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserAvatar user={user} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{user?.displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Model Selector Modal */}
      <AnimatePresence>
        {showModelSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowModelSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pilih Teman</h3>
                <button
                  onClick={() => setShowModelSelector(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-2">
                {CHAT_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      switchModel(model.id);
                      setShowModelSelector(false);
                      setInput('');
                      toast.success(`Chat baru dengan ${model.name} dimulai.`);
                    }}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                      currentModel.id === model.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <img
                      src={model.avatar}
                      alt={model.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="text-left flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{model.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{model.description}</p>
                    </div>
                    {currentModel.id === model.id && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
