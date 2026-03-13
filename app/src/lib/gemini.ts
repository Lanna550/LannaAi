import { API_BASE_URL, readJsonSafely } from '@/lib/api';

export type ChatAttachment = {
  kind: 'image' | 'document' | 'audio';
  name: string;
  mimeType: string;
  size: number;
  file?: File;
  previewUrl?: string;
  fileUri?: string;
};

type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
  attachment?: ChatAttachment;
};

type ChatResponse = {
  reply: string;
  attachment?: ChatAttachment;
};

export type AssistantFeedbackType = 'positive' | 'neutral' | 'negative';

type FeedbackResponse = {
  ok?: boolean;
  feedbackId?: number;
  error?: string;
  code?: string;
};

export type SubmitAssistantFeedbackInput = {
  userId?: string;
  messageId: string;
  modelName: string;
  feedbackType: AssistantFeedbackType;
  rating?: number;
  comment?: string;
};

type ChatApiErrorPayload = {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  attemptedModels?: string[];
};

export class ChatApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  attemptedModels?: string[];

  constructor(message: string, options: { status: number; code?: string; retryAfterSeconds?: number; attemptedModels?: string[] }) {
    super(message);
    this.name = 'ChatApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.attemptedModels = options.attemptedModels;
  }
}

function serializeAttachment(attachment?: ChatAttachment) {
  if (!attachment) {
    return undefined;
  }

  return {
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    fileUri: attachment.fileUri,
  };
}

export function normalizeImagePrompt(prompt: string) {
  const normalized = prompt.trim().replace(/^\/(image|img)\s+/i, '').trim();
  return normalized || prompt.trim();
}

export function looksLikeImageGenerationRequest(
  prompt: string,
  attachment?: ChatAttachment,
) {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/^\/(image|img)\b/i.test(normalized)) {
    return true;
  }

  const creationPatterns = [
    /\b(buatkan|bikin|buat|generate|create|ciptakan|desainkan|ilustrasikan|lukiskan|render|gambarkan)\b[\s\S]{0,80}\b(gambar|image|foto|ilustrasi|poster|logo|stiker|wallpaper|art)\b/i,
    /\b(gambar|image|foto|ilustrasi|poster|logo|stiker|wallpaper|art)\b[\s\S]{0,40}\b(buatkan|bikin|buat|generate|create|render)\b/i,
    /\b(draw|paint|render)\b[\s\S]{0,50}\b(image|art|poster|logo|illustration)\b/i,
  ];

  if (creationPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return Boolean(
    attachment?.kind === 'image' &&
      /\b(edit|ubah|ganti|jadikan|modify|restyle|tambahkan|hapus|remove|replace|background|warna|style)\b/i.test(
        normalized,
      ),
  );
}

async function sendChatRequest(
  endpoint: string,
  prompt: string,
  history: ChatHistoryItem[] = [],
  systemInstruction: string = '',
  attachment?: ChatAttachment,
  model: string = '',
) {
  const serializedHistory = history.map((item) => ({
    role: item.role,
    content: item.content,
    attachment: serializeAttachment(item.attachment),
  }));

  const hasBinaryAttachment = Boolean(attachment?.file);
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    ...(hasBinaryAttachment
      ? {
          body: (() => {
            const currentAttachment = attachment as ChatAttachment & { file: File };
            const formData = new FormData();
            formData.append('message', prompt);
            formData.append('history', JSON.stringify(serializedHistory));
            formData.append('systemInstruction', systemInstruction);
            formData.append('model', model);
            formData.append('attachment', currentAttachment.file, currentAttachment.name);
            return formData;
          })(),
        }
      : {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: prompt,
            history: serializedHistory,
            systemInstruction,
            model,
            attachment: serializeAttachment(attachment),
          }),
        }),
  });

  if (!res.ok) {
    const errorPayload = await readJsonSafely<ChatApiErrorPayload>(res);
    const fallbackMessage =
      res.status === 404
        ? `Endpoint ${endpoint} tidak ditemukan di backend. Pastikan server terbaru sedang berjalan di ${API_BASE_URL}.`
        : res.status >= 500
          ? `Backend error (${res.status}). Periksa terminal server.`
          : `Server mengembalikan status ${res.status}.`;

    throw new ChatApiError(errorPayload?.error || fallbackMessage, {
      status: res.status,
      code: errorPayload?.code,
      retryAfterSeconds: errorPayload?.retryAfterSeconds,
      attemptedModels: errorPayload?.attemptedModels,
    });
  }

  return ((await readJsonSafely<ChatResponse>(res)) || { reply: '' }) as ChatResponse;
}

export async function askGemini(
  prompt: string,
  history: ChatHistoryItem[] = [],
  systemInstruction: string = '',
  attachment?: ChatAttachment,
  model: string = '',
) {
  try {
    return await sendChatRequest('/api/chat', prompt, history, systemInstruction, attachment, model);
  } catch (error) {
    console.error('Error askGemini:', error);
    throw error;
  }
}

export async function generateGeminiImage(
  prompt: string,
  history: ChatHistoryItem[] = [],
  systemInstruction: string = '',
  attachment?: ChatAttachment,
  model: string = '',
) {
  try {
    return await sendChatRequest(
      '/api/chat/image',
      normalizeImagePrompt(prompt),
      history,
      systemInstruction,
      attachment,
      model,
    );
  } catch (error) {
    console.error('Error generateGeminiImage:', error);
    throw error;
  }
}

export async function submitAssistantFeedback(payload: SubmitAssistantFeedbackInput) {
  const response = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: payload.userId || null,
      messageId: payload.messageId,
      modelName: payload.modelName,
      feedbackType: payload.feedbackType,
      rating: payload.rating,
      comment: payload.comment,
    }),
  });

  const data = await readJsonSafely<FeedbackResponse>(response);
  if (!response.ok) {
    throw new ChatApiError(
      data?.error || `Gagal menyimpan feedback (${response.status}).`,
      {
        status: response.status,
        code: data?.code,
      },
    );
  }

  return {
    ok: Boolean(data?.ok),
    feedbackId: typeof data?.feedbackId === 'number' ? data.feedbackId : undefined,
  };
}
