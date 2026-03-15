import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Brain, MessageCircle, SendHorizontal, Wrench, X } from 'lucide-react';

interface GuideChatWidgetProps {
  onNavigate: (page: string) => void;
}

type GuideMessage = {
  id: number;
  role: 'bot' | 'user';
  text: string;
};

const QUICK_QUESTIONS = [
  'fitur utama web ini apa?',
  'mulai dari mana?',
  'cara pakai tools?',
];

const QUICK_ANSWERS: Record<string, string> = {
  'fitur utama web ini apa?': 'Web ini punya 3 area inti: Chat AI, ML Features, dan Tools Downloader.',
  'mulai dari mana?':
    'Mulai dari menu Chat dulu untuk tanya apa pun, lalu coba ML Features untuk prediksi, dan Tools untuk utility.',
  'cara pakai tools?':
    'Masuk menu Tools, pilih fitur yang kamu butuhkan, lalu ikuti form di dalam halaman tool tersebut.',
};

function createBotReply(input: string) {
  const normalized = input.toLowerCase().trim();
  if (normalized.includes('chat')) {
    return {
      reply: 'Aku arahkan ke menu Chat ya, kamu bisa langsung mulai ngobrol dengan AI.',
      goTo: 'chat',
    };
  }

  if (normalized.includes('ml')) {
    return {
      reply: 'Aku arahkan ke menu ML Features ya, di sana ada beberapa model prediksi.',
      goTo: 'ml',
    };
  }

  if (normalized.includes('tools') || normalized.includes('deploy')) {
    return {
      reply: 'Aku arahkan ke menu Tools ya, termasuk fitur Auto Deploy di navbar.',
      goTo: 'tools',
    };
  }

  return {
    reply:
      'Aku bisa bantu navigasi cepat ke Chat, ML Features, atau Tools. Coba ketik "buka chat", "buka ml", atau "buka tools".',
    goTo: null,
  };
}

export function GuideChatWidget({ onNavigate }: GuideChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<GuideMessage[]>([
    {
      id: 1,
      role: 'bot',
      text: 'Hai, aku Lanna Guide. Mau tur singkat biar kamu cepat paham web ini?',
    },
  ]);
  const [input, setInput] = useState('');

  const containerStyle = useMemo(
    () => ({
      paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
    }),
    [],
  );

  const appendMessage = (role: GuideMessage['role'], text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        role,
        text,
      },
    ]);
  };

  const handleQuickQuestion = (question: string) => {
    appendMessage('user', question);
    appendMessage('bot', QUICK_ANSWERS[question] || 'Pertanyaan diterima.');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    appendMessage('user', trimmedInput);
    setInput('');

    const result = createBotReply(trimmedInput);
    appendMessage('bot', result.reply);
    if (result.goTo) {
      onNavigate(result.goTo);
    }
  };

  return (
    <div
      className="fixed right-2 bottom-16 z-[60] sm:right-4 sm:bottom-5"
      style={containerStyle}
    >
      <AnimatePresence initial={false} mode="wait">
        {isOpen ? (
          <motion.div
            key="guide-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="w-[calc(100vw-0.75rem)] max-w-[340px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl sm:max-w-[360px] dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Lanna Guide</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Asisten cepat untuk jelasin isi web</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Tutup guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[46vh] space-y-2 overflow-y-auto bg-slate-50/70 px-3 py-3 dark:bg-slate-900/60">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'bot'
                      ? 'bg-slate-200/80 text-slate-800 dark:bg-slate-700/70 dark:text-slate-100'
                      : 'ml-auto bg-sky-500 text-white'
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200/70 px-3 py-2 dark:border-white/10">
              <div className="mb-2 flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleQuickQuestion(question)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Tanya singkat tentang web ini..."
                  className="h-10 flex-1 rounded-full border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white transition-transform hover:scale-[1.03]"
                  aria-label="Kirim pesan"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('chat')}
                  className="flex items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ml')}
                  className="flex items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Brain className="h-3.5 w-3.5" />
                  ML
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="flex items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Tools
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="guide-launcher"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 shadow-xl shadow-sky-500/30 sm:h-14 sm:w-14">
              <Bot className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="max-w-[52vw] rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm sm:max-w-[58vw] sm:px-4 sm:py-2 sm:text-sm max-[359px]:hidden dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              Butuh bantuan?
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
