import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL, fetchWithTimeout, readJsonSafely } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { askGemini, ChatApiError } from '@/lib/gemini';

export type ChatModel = 'lanna' | 'furina' | 'inori';

export type AttachmentKind = 'image' | 'document' | 'audio';

export interface MessageAttachment {
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  file?: File;
  fileUri?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachment?: MessageAttachment;
}

export interface ChatSession {
  id: string;
  title: string;
  titleKind?: 'heuristic' | 'smart' | 'manual';
  preview: string;
  modelId: ChatModel;
  pinnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

export interface ChatModelConfig {
  id: ChatModel;
  name: string;
  description: string;
  avatar: string;
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  personality: string;
}

interface RemoteChatResponse {
  sessions?: Array<{
    id?: string;
    title?: string;
    titleKind?: 'heuristic' | 'smart' | 'manual';
    preview?: string;
    modelId?: string;
    pinnedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    messages?: Array<{
      id?: string;
      role?: 'user' | 'assistant';
      content?: string;
      timestamp?: string;
      attachment?: MessageAttachment;
    }>;
  }>;
  error?: string;
}

interface ChatContextType {
  chatSessions: ChatSession[];
  activeSessionId: string;
  messages: Message[];
  currentModel: ChatModelConfig;
  maxPinnedSessions: number;
  isTyping: boolean;
  appendMessage: (
    role: 'user' | 'assistant',
    content: string,
    attachment?: MessageAttachment,
  ) => string;
  updateMessageAttachment: (
    messageId: string,
    attachment: Partial<MessageAttachment>,
  ) => void;
  setTyping: (value: boolean) => void;
  switchModel: (modelId: ChatModel) => void;
  clearChat: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  toggleSessionPin: (
    sessionId: string,
  ) => { ok: true; pinned: boolean } | { ok: false; reason: 'limit' | 'not_found' };
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lanna-chat-sessions-v2';
const MAX_STORED_SESSIONS = 20;
const MAX_PINNED_SESSIONS = 3;
const SESSION_TITLE_MAX_LENGTH = 42;

const WELCOME_MESSAGES: Record<ChatModel, string> = {
  lanna:
    'Halo! Aku Miku, teman ceritamu. Kamu bisa cerita apa pun: sedih, senang, capek, atau bingung. Aku dengerin ya.',
  furina:
    'Sparkle siap jadi spesialis generate gambarmu. Jelaskan visual yang kamu mau, nanti aku buatkan gambarnya.',
  inori: 'Halo! Furina siap bantu ngoding. Lagi bikin apa, dan pakai bahasa apa?',
};

const TOPIC_STOP_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'atau', 'pada',
  'tentang', 'mohon', 'tolong', 'bantu', 'bisa', 'dong', 'nih', 'ini', 'itu',
  'aku', 'saya', 'mau', 'ingin', 'lagi', 'kak', 'bang', 'mba', 'mas', 'deh',
  'sih', 'nya', 'buat', 'agar', 'supaya', 'gimana', 'bagaimana', 'cara',
  'jadi', 'lebih', 'seputar', 'mengenai', 'please', 'plis', 'the', 'a', 'an', 'of',
  'aja', 'saja', 'kok', 'kan', 'tuh', 'lho', 'loh', 'ya',
  'apa', 'siapa', 'kapan', 'dimana', 'kenapa', 'mengapa', 'bagaimana',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'a', 'an', 'the',
  'do', 'does', 'did', 'doing', 'in', 'on', 'at', 'for', 'with',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must'
]);

export const CHAT_MODELS: ChatModelConfig[] = [
  {
    id: 'lanna',
    name: 'Miku',
    description: 'Teman cerita yang peka mood dan suportif',
    avatar: 'images/hatsune_miku.png',
    theme: {
      primary: '#3b82f6',
      secondary: '#60a5fa',
      gradient: 'from-blue-500 to-cyan-400',
    },
    personality:
      'Hangat, empatik, dan manusiawi; fokus menemani user bercerita sesuai mood (sedih, ceria, senang, cemas, dan lainnya) dengan respons yang terasa personal.',
  },
  {
    id: 'furina',
    name: 'Sparkle',
    description: 'Spesialis generate gambar dan ilustrasi visual',
    avatar: 'images/sparkle_portrait.png',
    theme: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      gradient: 'from-indigo-500 to-purple-500',
    },
    personality:
      'Anggun dan kreatif; fokus utama menerjemahkan ide user menjadi prompt visual yang kuat dan hasil gambar yang konsisten.',
  },
  {
    id: 'inori',
    name: 'Furina',
    description: 'Asisten coding yang fokus dan rapi',
    avatar: 'images/furina_potrait.png',
    theme: {
      primary: '#ec4899',
      secondary: '#f472b6',
      gradient: 'from-pink-500 to-rose-400',
    },
    personality:
      'Teliti, to-the-point, dan jadi partner ngoding yang sabar: fokus ke solusi yang benar, rapi, dan mudah dipahami.',
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStorageKey(userId?: string) {
  return `${STORAGE_KEY_PREFIX}:${userId || 'guest'}`;
}

function createWelcomeMessage(modelId: ChatModel): Message {
  return {
    id: createId('welcome'),
    role: 'assistant',
    content: WELCOME_MESSAGES[modelId],
    timestamp: new Date(),
  };
}

function getAttachmentLabel(attachment?: MessageAttachment) {
  if (!attachment) {
    return '';
  }

  if (attachment.kind === 'image') {
    return attachment.name ? `Gambar: ${attachment.name}` : 'Gambar';
  }

  if (attachment.kind === 'audio') {
    return attachment.name ? `Audio: ${attachment.name}` : 'Audio';
  }

  return attachment.name ? `File: ${attachment.name}` : 'File';
}

function isGenericGreeting(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return (
    wordCount <= 4 &&
    /^(hi|hai|halo|hello|hey|p|ping|test|tes|woi|permisi|selamat (pagi|siang|sore|malam)|apa kabar)$/i.test(
      normalized,
    )
  );
}

function isIntroduction(text: string) {
  const normalized = text.toLowerCase().trim();
  return /^(nama saya|namaku|aku bernama|saya bernama|perkenalkan)(\s|$)/.test(normalized);
}

function normalizeTopicSource(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripConversationPrefixes(text: string) {
  return text
    .replace(/^(tolong|mohon|coba|bisa)\s+/i, '')
    .replace(/^(buatkan|bikin|buat|generate|create|ciptakan|desainkan|ilustrasikan|lukiskan|render|gambarkan|jelaskan|beritahu|kasih tau|ceritakan)\s+/i, '')
    .replace(/^(aku|saya)\s+(mau|ingin|minta|tanya|punya|ada)\s+/i, '')
    .replace(/^(pertanyaan|masalah)\s+(tentang|soal|mengenai)?/i, '')
    .replace(/^(tentang|soal|mengenai|seputar)\s+/i, '')
    .trim();
}

function formatTitleToken(token: string) {
  if (!token) {
    return token;
  }

  if (/[A-Z]/.test(token.slice(1)) || /\d/.test(token)) {
    return token;
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function truncateTitle(title: string) {
  return title.length > SESSION_TITLE_MAX_LENGTH
    ? `${title.slice(0, SESSION_TITLE_MAX_LENGTH).trimEnd()}...`
    : title;
}

function inferTitleFromText(text: string) {
  const normalized = normalizeTopicSource(text);
  if (!normalized) {
    return 'Chat Baru';
  }

  if (isIntroduction(normalized) && normalized.split(/\s+/).length <= 8) {
    return 'Perkenalan Diri';
  }

  const stripped = stripConversationPrefixes(normalized);
  const tokens = stripped.split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((token) => !TOPIC_STOP_WORDS.has(token.toLowerCase()));
  const chosenTokens = (filtered.length >= 2 ? filtered : tokens).slice(0, 6);

  if (chosenTokens.length === 0) {
    return 'Chat Baru';
  }

  return truncateTitle(chosenTokens.map(formatTitleToken).join(' '));
}

function buildSessionTitle(messages: Message[]) {
  const candidates = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim() || getAttachmentLabel(message.attachment))
    .filter(Boolean);

  if (candidates.length === 0) {
    return 'Chat Baru';
  }

  const bestCandidate =
    candidates.find((candidate) => !isGenericGreeting(candidate) && !isIntroduction(candidate)) ??
    candidates.find((candidate) => !isGenericGreeting(candidate)) ??
    candidates[0];

  // Kalau user cuma menyapa (mis. "halo"), jangan jadikan itu judul.
  if (isGenericGreeting(bestCandidate)) {
    return 'Chat Baru';
  }

  if (isIntroduction(bestCandidate)) {
    return 'Perkenalan Diri';
  }

  return inferTitleFromText(bestCandidate);
}

function isWeakSessionTitle(title: string) {
  const normalized = title.toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  if (normalized === 'chat baru') {
    return true;
  }

  if (isGenericGreeting(normalized)) {
    return true;
  }

  if (/^(lihat|lihat ini|cek|coba|ok|oke|iya|ya|sip|test|tes)$/i.test(normalized)) {
    return true;
  }

  if (/^(gambar|image|foto)\b.*\.(png|jpg|jpeg|webp|gif)$/i.test(normalized)) {
    return true;
  }

  if (/^(audio|dokumen|document|file)\b/i.test(normalized)) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 1 && normalized.length <= 6) {
    return true;
  }

  return false;
}

function buildSmartTitleSource(messages: Message[]) {
  const nonWelcome = messages.filter((message) => !String(message.id || '').startsWith('welcome'));
  const slice = nonWelcome.slice(0, 10);

  return slice
    .map((message) => {
      const role = message.role === 'user' ? 'User' : 'Asisten';
      const attachmentLabel = message.attachment ? getAttachmentLabel(message.attachment) : '';
      const text = message.content?.trim() || '';
      const combined = [attachmentLabel, text].filter(Boolean).join('\n');
      return combined ? `${role}: ${combined}` : `${role}:`;
    })
    .join('\n');
}

function normalizeSmartTitleOutput(raw: string) {
  const cleaned = String(raw || '')
    .replace(/^[\s"'\u201C\u201D\u2018\u2019]+|[\s"'\u201C\u201D\u2018\u2019]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const firstLine = cleaned.split('\n')[0]?.trim() || '';
  const withoutPunct = firstLine.replace(/[.?!,:;]+$/g, '').trim();
  const withoutFileExt = withoutPunct.replace(/\b(png|jpg|jpeg|webp|gif|pdf|docx?|txt|webm|mp3|wav|m4a)\b/gi, '').replace(/\s+/g, ' ').trim();
  const words = withoutFileExt.split(/\s+/).filter(Boolean).slice(0, 7);
  const title = words.map(formatTitleToken).join(' ');
  return truncateTitle(title);
}

function buildSessionPreview(messages: Message[]) {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message.content.trim() || message.attachment);

  if (!latestMessage) {
    return '';
  }

  const source = latestMessage.content.trim() || getAttachmentLabel(latestMessage.attachment);
  return source.length > 50 ? `${source.slice(0, 50)}...` : source;
}

function sanitizeAttachment(
  attachment?: MessageAttachment,
  options: { includePreview?: boolean } = {},
) {
  if (!attachment) {
    return undefined;
  }

  const previewUrl =
    options.includePreview &&
    attachment.previewUrl &&
    !attachment.previewUrl.startsWith('blob:') &&
    !attachment.previewUrl.startsWith('data:')
      ? attachment.previewUrl
      : undefined;

  return {
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    previewUrl,
    fileUri: attachment.fileUri,
  };
}

function createChatSession(modelId: ChatModel): ChatSession {
  const now = new Date();
  const messages = [createWelcomeMessage(modelId)];

  return {
    id: createId('session'),
    title: 'Chat Baru',
    titleKind: 'heuristic',
    preview: buildSessionPreview(messages),
    modelId,
    pinnedAt: undefined,
    createdAt: now,
    updatedAt: now,
    messages,
  };
}

function isSessionEmpty(session?: ChatSession | null) {
  if (!session) {
    return true;
  }

  return !session.messages.some((message) => message.role === 'user');
}

function dedupeSessions(sessions: ChatSession[]) {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (!session?.id || seen.has(session.id)) {
      return false;
    }

    seen.add(session.id);
    return true;
  });
}

function buildSessionListWithDraft(
  sessions: ChatSession[],
  draftModelId: ChatModel = 'lanna',
) {
  const historySessions = dedupeSessions(sessions).filter((session) => !isSessionEmpty(session));
  return [createChatSession(draftModelId), ...historySessions].slice(0, MAX_STORED_SESSIONS);
}

function hydrateSession(rawSession: any): ChatSession | null {
  const modelId = CHAT_MODELS.some((model) => model.id === rawSession?.modelId)
    ? (rawSession.modelId as ChatModel)
    : 'lanna';
  const messages = Array.isArray(rawSession?.messages)
    ? rawSession.messages.map((message: any) => ({
        id: String(message?.id || createId('message')),
        role: message?.role === 'user' ? 'user' : 'assistant',
        content: String(message?.content || ''),
        timestamp: new Date(message?.timestamp || Date.now()),
        attachment: sanitizeAttachment(message?.attachment, { includePreview: true }),
      }))
    : [];
  const safeMessages = messages.length > 0 ? messages : [createWelcomeMessage(modelId)];
  const storedTitle =
    typeof rawSession?.title === 'string' ? String(rawSession.title).trim() : '';
  const storedTitleKind =
    rawSession?.titleKind === 'smart' || rawSession?.titleKind === 'manual' || rawSession?.titleKind === 'heuristic'
      ? (rawSession.titleKind as ChatSession['titleKind'])
      : undefined;
  const resolvedTitle = truncateTitle(storedTitle || buildSessionTitle(safeMessages));
  const resolvedTitleKind = storedTitleKind ?? 'heuristic';
  const rawPinnedAt =
    typeof rawSession?.pinnedAt === 'string' && rawSession.pinnedAt.trim()
      ? new Date(rawSession.pinnedAt)
      : null;
  const pinnedAt =
    rawPinnedAt && Number.isFinite(rawPinnedAt.getTime()) ? rawPinnedAt : undefined;

  return {
    id: String(rawSession?.id || createId('session')),
    title: resolvedTitle,
    titleKind: resolvedTitleKind,
    preview: buildSessionPreview(safeMessages),
    modelId,
    pinnedAt,
    createdAt: new Date(rawSession?.createdAt || Date.now()),
    updatedAt: new Date(rawSession?.updatedAt || Date.now()),
    messages: safeMessages,
  };
}

function parseStoredSessions(userId?: string): ChatSession[] {
  if (typeof window === 'undefined') {
    return [createChatSession('lanna')];
  }

  try {
    const stored = window.localStorage.getItem(getStorageKey(userId));
    if (!stored) {
      return [createChatSession('lanna')];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createChatSession('lanna')];
    }

    const sessions = parsed
      .map((session) => hydrateSession(session))
      .filter(Boolean)
      .slice(0, MAX_STORED_SESSIONS) as ChatSession[];

    return buildSessionListWithDraft(sessions);
  } catch {
    return [createChatSession('lanna')];
  }
}

function serializeSessionsForStorage(sessions: ChatSession[]) {
  return sessions
    .filter((session) => !isSessionEmpty(session))
    .map((session) => ({
    ...session,
    pinnedAt: session.pinnedAt ? session.pinnedAt.toISOString() : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
      attachment: sanitizeAttachment(message.attachment, { includePreview: true }),
    })),
    }));
}

function serializeSessionsForRemote(sessions: ChatSession[]) {
  return sessions
    .filter((session) => !isSessionEmpty(session))
    .map((session) => ({
    id: session.id,
    title: session.title,
    titleKind: session.titleKind,
    preview: session.preview,
    modelId: session.modelId,
    pinnedAt: session.pinnedAt ? session.pinnedAt.toISOString() : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      attachment: sanitizeAttachment(message.attachment, { includePreview: false }),
    })),
    }));
}

async function fetchRemoteSessions(userId: string): Promise<ChatSession[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/chats/${userId}`);
  const data = await readJsonSafely<RemoteChatResponse>(response);

  if (!response.ok) {
    throw new Error(data?.error || 'Gagal memuat riwayat chat.');
  }

  const sessions = Array.isArray(data?.sessions)
    ? data.sessions.map((session) => hydrateSession(session)).filter(Boolean)
    : [];

  return dedupeSessions(sessions as ChatSession[]).slice(0, MAX_STORED_SESSIONS);
}

async function syncRemoteSessions(
  userId: string,
  sessions: ChatSession[],
  options: { keepalive?: boolean } = {},
) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/chats/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: Boolean(options.keepalive),
    body: JSON.stringify({
      sessions: serializeSessionsForRemote(sessions),
    }),
  });

  if (!response.ok) {
    const data = await readJsonSafely<{ error?: string }>(response);
    throw new Error(data?.error || 'Gagal menyimpan riwayat chat.');
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => parseStoredSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasLoadedRemoteSessions, setHasLoadedRemoteSessions] = useState(false);
  const remoteSyncRetryTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadChatSessions = async () => {
      const cachedSessions = parseStoredSessions(user?.id);

      if (!user?.id) {
        setChatSessions(cachedSessions);
        setActiveSessionId(cachedSessions[0]?.id || '');
        setHasLoadedRemoteSessions(true);
        return;
      }

      setHasLoadedRemoteSessions(false);
      setChatSessions(cachedSessions);
      setActiveSessionId(cachedSessions[0]?.id || '');

      try {
        const remoteSessions = await fetchRemoteSessions(user.id);
        if (cancelled) {
          return;
        }

        const baseHistory = remoteSessions.length > 0
          ? remoteSessions
          : cachedSessions.filter((session) => !isSessionEmpty(session));
        const draftModelId = cachedSessions[0]?.modelId ?? 'lanna';
        const nextSessions = buildSessionListWithDraft(baseHistory, draftModelId);
        setChatSessions(nextSessions);
        setActiveSessionId(nextSessions[0]?.id || '');
      } catch (error) {
        console.error('Failed to load chat sessions from DB:', error);
      } finally {
        if (!cancelled) {
          setHasLoadedRemoteSessions(true);
        }
      }
    };

    void loadChatSessions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeSessionId && chatSessions[0]) {
      setActiveSessionId(chatSessions[0].id);
    }
  }, [activeSessionId, chatSessions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      getStorageKey(user?.id),
      JSON.stringify(serializeSessionsForStorage(chatSessions)),
    );
  }, [chatSessions, user?.id]);

  useEffect(() => {
    if (!user?.id || !hasLoadedRemoteSessions) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncRemoteSessions(user.id, chatSessions).catch((error) => {
        console.error('Failed to sync chat sessions to DB:', error);
        if (remoteSyncRetryTimerRef.current !== null) {
          window.clearTimeout(remoteSyncRetryTimerRef.current);
        }
        remoteSyncRetryTimerRef.current = window.setTimeout(() => {
          void syncRemoteSessions(user.id, chatSessions).catch((retryError) => {
            console.error('Retry sync chat sessions failed:', retryError);
          });
        }, 2000);
      });
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [chatSessions, hasLoadedRemoteSessions, user?.id]);

  useEffect(() => {
    if (!user?.id || !hasLoadedRemoteSessions) {
      return;
    }

    const flushSync = () => {
      void syncRemoteSessions(user.id, chatSessions, { keepalive: true }).catch((error) => {
        console.error('Flush sync chat sessions failed:', error);
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };

    window.addEventListener('pagehide', flushSync);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', flushSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [chatSessions, hasLoadedRemoteSessions, user?.id]);

  useEffect(() => {
    return () => {
      if (remoteSyncRetryTimerRef.current !== null) {
        window.clearTimeout(remoteSyncRetryTimerRef.current);
      }
    };
  }, []);

  const activeSession =
    chatSessions.find((session) => session.id === activeSessionId) ?? chatSessions[0];
  const currentModel =
    CHAT_MODELS.find((model) => model.id === activeSession?.modelId) ?? CHAT_MODELS[0];
  const messages = activeSession?.messages ?? [createWelcomeMessage(currentModel.id)];
  const titleGenerationRef = React.useRef<{
    timeoutId: number | null;
    fingerprint: string;
    sessionId: string;
    inFlight: boolean;
  } | null>(null);
  const lastGeneratedFingerprintRef = React.useRef<Record<string, string>>({});
  const smartTitleCooldownUntilRef = React.useRef(0);

  const setSessionTitle = useCallback((sessionId: string, title: string, titleKind: ChatSession['titleKind'] = 'smart') => {
    const nextTitle = truncateTitle(title.trim());
    if (!nextTitle) {
      return;
    }

    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, title: nextTitle, titleKind } : session,
      ),
    );
  }, []);

  const appendMessage = useCallback(
    (role: 'user' | 'assistant', content: string, attachment?: MessageAttachment) => {
      const id = createId('message');
      const nextMessage: Message = {
        id,
        role,
        content,
        timestamp: new Date(),
        attachment,
      };

      setChatSessions((prev) => {
        const targetSession = prev.find((session) => session.id === activeSessionId);
        if (!targetSession) {
          return prev;
        }

        const nextMessages = [...targetSession.messages, nextMessage];
        const nextComputedTitle = buildSessionTitle(nextMessages);
        const shouldUpdateTitle =
          targetSession.titleKind !== 'smart' &&
          targetSession.titleKind !== 'manual' &&
          isWeakSessionTitle(targetSession.title);
        const updatedSession: ChatSession = {
          ...targetSession,
          title: shouldUpdateTitle ? nextComputedTitle : targetSession.title,
          titleKind: shouldUpdateTitle ? 'heuristic' : targetSession.titleKind,
          preview: buildSessionPreview(nextMessages),
          updatedAt: nextMessage.timestamp,
          messages: nextMessages,
        };

        return [updatedSession, ...prev.filter((session) => session.id !== activeSessionId)].slice(
          0,
          MAX_STORED_SESSIONS,
        );
      });

      return id;
    },
    [activeSessionId],
  );

  useEffect(() => {
    const session = activeSession;
    if (!session) {
      return;
    }

    if (Date.now() < smartTitleCooldownUntilRef.current) {
      return;
    }

    if (isTyping) {
      return;
    }

    if (session.titleKind === 'smart' || session.titleKind === 'manual') {
      return;
    }

    const nonWelcome = session.messages.filter((message) => !String(message.id || '').startsWith('welcome'));
    const userCount = nonWelcome.filter((message) => message.role === 'user').length;
    const assistantCount = nonWelcome.filter((message) => message.role === 'assistant').length;

    if (userCount === 0) {
      return;
    }

    const hasAttachment = nonWelcome.some((message) => Boolean(message.attachment));
    if (hasAttachment) {
      return;
    }

    if (!hasAttachment && assistantCount === 0 && userCount < 2) {
      return;
    }

    const source = buildSmartTitleSource(session.messages);
    const fingerprint = `${session.modelId}:${source}`;
    const lastFingerprint = lastGeneratedFingerprintRef.current[session.id];
    if (lastFingerprint && lastFingerprint === fingerprint) {
      return;
    }

    if (titleGenerationRef.current?.timeoutId) {
      window.clearTimeout(titleGenerationRef.current.timeoutId);
    }

    const scheduleSessionId = session.id;
    const timeoutId = window.setTimeout(() => {
      if (titleGenerationRef.current?.inFlight) {
        return;
      }

      titleGenerationRef.current = {
        timeoutId: null,
        fingerprint,
        sessionId: scheduleSessionId,
        inFlight: true,
      };

      void (async () => {
        try {
          const prompt = [
            'Buat judul singkat (2-6 kata) dalam bahasa Indonesia untuk percakapan berikut.',
            'Judul harus menggambarkan topik utama/niat user.',
            'Jangan gunakan kata umum seperti "Chat", "Obrolan", "Percakapan".',
            'Jangan pakai tanda kutip, emoji, atau titik di akhir.',
            'Jangan sebut ekstensi file (jpg, png, pdf, dll).',
            'Keluarkan HANYA judulnya saja.',
            '',
            source,
          ].join('\n');

          const systemInstruction =
            'Kamu adalah fitur penamaan sesi chat. Output hanya judul singkat.';

          const { reply } = await askGemini(prompt, [], systemInstruction);
          const normalizedTitle = normalizeSmartTitleOutput(reply);

          if (normalizedTitle && !isWeakSessionTitle(normalizedTitle)) {
            setSessionTitle(scheduleSessionId, normalizedTitle, 'smart');
            lastGeneratedFingerprintRef.current[scheduleSessionId] = fingerprint;
          }
        } catch (error) {
          console.error('Failed to generate smart title:', error);
          if (error instanceof ChatApiError) {
            const shouldCooldown =
              error.status === 429 ||
              error.code === 'GEMINI_QUOTA_EXCEEDED' ||
              error.status === 401 ||
              error.status === 403;

            if (shouldCooldown) {
              const cooldownSeconds =
                typeof error.retryAfterSeconds === 'number' && error.retryAfterSeconds > 0
                  ? error.retryAfterSeconds
                  : 30 * 60;
              smartTitleCooldownUntilRef.current =
                Date.now() + cooldownSeconds * 1000;
            }
          }
        } finally {
          titleGenerationRef.current = titleGenerationRef.current
            ? { ...titleGenerationRef.current, inFlight: false }
            : null;
        }
      })();
    }, 900);

    titleGenerationRef.current = {
      timeoutId,
      fingerprint,
      sessionId: scheduleSessionId,
      inFlight: false,
    };

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeSession, isTyping, setSessionTitle]);

  const updateMessageAttachment = useCallback(
    (messageId: string, attachment: Partial<MessageAttachment>) => {
      setChatSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) {
            return session;
          }

          const nextMessages = session.messages.map((message) => {
            if (message.id !== messageId || !message.attachment) {
              return message;
            }

            return {
              ...message,
              attachment: {
                ...message.attachment,
                ...attachment,
              },
            };
          });

          return {
            ...session,
            preview: buildSessionPreview(nextMessages),
            messages: nextMessages,
          };
        }),
      );
    },
    [activeSessionId],
  );

  const switchModel = useCallback((modelId: ChatModel) => {
    if (!CHAT_MODELS.some((model) => model.id === modelId)) {
      return;
    }

    const nextSession = createChatSession(modelId);
    setIsTyping(false);
    setChatSessions((prev) =>
      [nextSession, ...prev.filter((session) => !isSessionEmpty(session))].slice(
        0,
        MAX_STORED_SESSIONS,
      ),
    );
    setActiveSessionId(nextSession.id);
  }, []);

  const clearChat = useCallback(() => {
    const nextSession = createChatSession(currentModel.id);
    setIsTyping(false);
    setChatSessions((prev) =>
      [nextSession, ...prev.filter((session) => !isSessionEmpty(session))].slice(
        0,
        MAX_STORED_SESSIONS,
      ),
    );
    setActiveSessionId(nextSession.id);
  }, [currentModel.id]);

  const loadSession = useCallback((sessionId: string) => {
    setIsTyping(false);
    setActiveSessionId(sessionId);
  }, []);

  const deleteSession = useCallback(
    (sessionId: string) => {
      let nextActiveId = activeSessionId;

      setIsTyping(false);
      setChatSessions((prev) => {
        const remainingSessions = prev.filter((session) => session.id !== sessionId);
        const remainingHistory = remainingSessions.filter((session) => !isSessionEmpty(session));

        if (remainingHistory.length === 0) {
          const fallbackSession = createChatSession(currentModel.id);
          nextActiveId = fallbackSession.id;
          return [fallbackSession];
        }

        const nextSessions = buildSessionListWithDraft(remainingHistory, currentModel.id);

        if (sessionId === activeSessionId || !nextSessions.some((session) => session.id === nextActiveId)) {
          nextActiveId = nextSessions[0].id;
        }

        return nextSessions;
      });

      if (nextActiveId !== activeSessionId) {
        setActiveSessionId(nextActiveId);
      }
    },
    [activeSessionId, currentModel.id],
  );

  const toggleSessionPin = useCallback(
    (
      sessionId: string,
    ): { ok: true; pinned: boolean } | { ok: false; reason: 'limit' | 'not_found' } => {
      const targetSession = chatSessions.find((session) => session.id === sessionId);
      if (!targetSession || isSessionEmpty(targetSession)) {
        return { ok: false, reason: 'not_found' };
      }

      if (targetSession.pinnedAt) {
        setChatSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, pinnedAt: undefined } : session,
          ),
        );
        return { ok: true, pinned: false };
      }

      const pinnedCount = chatSessions.filter(
        (session) => Boolean(session.pinnedAt) && !isSessionEmpty(session),
      ).length;
      if (pinnedCount >= MAX_PINNED_SESSIONS) {
        return { ok: false, reason: 'limit' };
      }

      const now = new Date();
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, pinnedAt: now } : session,
        ),
      );
      return { ok: true, pinned: true };
    },
    [chatSessions],
  );

  return (
    <ChatContext.Provider
      value={{
        chatSessions,
        activeSessionId,
        messages,
        currentModel,
        maxPinnedSessions: MAX_PINNED_SESSIONS,
        isTyping,
        appendMessage,
        updateMessageAttachment,
        setTyping: setIsTyping,
        switchModel,
        clearChat,
        loadSession,
        deleteSession,
        toggleSessionPin,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
