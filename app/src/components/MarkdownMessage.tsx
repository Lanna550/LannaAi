import { Check, Copy } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

type MarkdownMessageProps = {
  content: string;
  variant: 'assistant' | 'user';
  className?: string;
};

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object') {
    const maybeElement = node as { props?: { children?: unknown } };
    if (maybeElement.props && 'children' in maybeElement.props) {
      return extractText(maybeElement.props.children);
    }
  }

  return '';
}

function tryCopyToClipboard(text: string) {
  if (!text) {
    return Promise.resolve(false);
  }

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve(Boolean(ok));
  } catch {
    return Promise.resolve(false);
  }
}

function CopyablePre({
  children,
  variant,
}: {
  children: ReactNode;
  variant: 'assistant' | 'user';
}) {
  const [copied, setCopied] = useState(false);

  const codeText = useMemo(() => extractText(children).replace(/\n$/, ''), [children]);
  const canCopy = Boolean(codeText.trim());

  const buttonClassName =
    variant === 'user'
      ? 'bg-white/15 hover:bg-white/20 text-white'
      : 'bg-white/10 hover:bg-white/15 text-white';

  const onCopy = useCallback(async () => {
    const ok = await tryCopyToClipboard(codeText);
    if (!ok) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [codeText]);

  return (
    <pre className="m-0 relative min-w-0 w-full max-w-full overflow-x-auto rounded-xl p-3 text-xs leading-relaxed bg-gray-950 text-gray-50 dark:bg-black/50 dark:text-gray-50">
      {children}
      <button
        type="button"
        onClick={onCopy}
        disabled={!canCopy}
        className={`absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${buttonClassName} ${
          canCopy ? '' : 'opacity-50 cursor-not-allowed'
        }`}
        title={copied ? 'Tersalin' : 'Salin kode'}
        aria-label={copied ? 'Tersalin' : 'Salin kode'}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Tersalin' : 'Salin'}
      </button>
    </pre>
  );
}

export function MarkdownMessage({ content, variant, className }: MarkdownMessageProps) {
  const isUser = variant === 'user';
  const inlineCodeClassName = isUser
    ? 'bg-white/15 text-white'
    : 'bg-black/5 text-gray-900 dark:bg-white/10 dark:text-white';

  return (
    <div className={`min-w-0 w-full max-w-full space-y-2 ${className || ''}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => (
            <p className="m-0 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
              {children}
            </p>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="m-0 ml-5 list-disc space-y-1 text-sm leading-relaxed">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="m-0 ml-5 list-decimal space-y-1 text-sm leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="[overflow-wrap:anywhere]">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={isUser ? 'underline underline-offset-2 text-white' : 'text-blue-600 dark:text-blue-400 underline underline-offset-2'}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => <CopyablePre variant={variant}>{children}</CopyablePre>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock =
              typeof codeClassName === 'string' ||
              String(children).includes('\n');
            if (isBlock) {
              return (
                <code {...props} className="block min-w-max font-mono whitespace-pre">
                  {String(children).replace(/\n$/, '')}
                </code>
              );
            }

            return (
              <code
                {...props}
                className={`rounded-md px-1.5 py-0.5 font-mono text-[0.85em] ${inlineCodeClassName}`}
              >
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote
              className={
                isUser
                  ? 'm-0 border-l-2 border-white/30 pl-3 italic text-white/90'
                  : 'm-0 border-l-2 border-gray-300 dark:border-white/20 pl-3 italic text-gray-700 dark:text-gray-200'
              }
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
