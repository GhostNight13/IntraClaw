'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { Send, Trash2, Bot, User } from 'lucide-react';
import { api } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  durationMs?: number;
  tokens?: number;
  createdAt: number;
}

const STORAGE_KEY = 'intraclaw-chat-history';
const MAX_STORED = 100;

/* ─── Helpers ────────────────────────────────────────────────── */
function loadHistory(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  const trimmed = messages.slice(-MAX_STORED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ─── Message Bubble ─────────────────────────────────────────── */
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.createdAt).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
        style={{
          background: isUser ? 'var(--accent-blue)' : 'var(--bg-hover)',
          border: '1px solid var(--border)',
        }}>
        {isUser
          ? <User size={14} color="#fff" />
          : <Bot size={14} style={{ color: 'var(--accent-green)' }} />
        }
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            background: isUser ? 'var(--accent-blue)' : 'var(--bg-card)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            borderBottomRightRadius: isUser ? 4 : undefined,
            borderBottomLeftRadius: !isUser ? 4 : undefined,
            border: isUser ? 'none' : '1px solid var(--border)',
          }}>
          {msg.content}
        </div>
        {/* Meta */}
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{time}</span>
          {msg.model && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{msg.model}</span>
          )}
          {msg.durationMs && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {msg.durationMs < 1000 ? `${msg.durationMs}ms` : `${(msg.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
        <Bot size={14} style={{ color: 'var(--accent-green)' }} />
      </div>
      <div className="rounded-2xl rounded-bl-sm px-4 py-3 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 h-4">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--text-muted)',
                animation: `bounce 1s ${delay}ms infinite`,
              }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    saveHistory(next);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.chat(text);
      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: res.reply,
        model: res.model,
        durationMs: res.durationMs,
        tokens: res.tokens,
        createdAt: Date.now(),
      };
      const withReply = [...next, assistantMsg];
      setMessages(withReply);
      saveHistory(withReply);
    } catch (err) {
      const errMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: `Erreur: ${err instanceof Error ? err.message : 'API inaccessible. Vérifie que le serveur IntraClaw tourne sur le port 3001.'}`,
        createdAt: Date.now(),
      };
      const withErr = [...next, errMsg];
      setMessages(withErr);
      saveHistory(withErr);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, messages]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-green)20', border: '1px solid var(--accent-green)40' }}>
            <Bot size={18} style={{ color: 'var(--accent-green)' }} />
          </div>
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>IntraClaw</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
              <span className="text-xs" style={{ color: 'var(--accent-green)' }}>En ligne</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <Trash2 size={12} />
            Effacer
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent-green)15', border: '1px solid var(--accent-green)30' }}>
              <Bot size={32} style={{ color: 'var(--accent-green)' }} />
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Bonjour, je suis IntraClaw
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Ton agent IA personnel. Demande-moi un rapport, le statut des agents,
                ou lance une tâche.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {['Statut des agents', 'Rapport du jour', 'Lance la prospection', 'Combien ai-je dépensé ?'].map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        {isLoading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-6 py-4 border-t mb-16 md:mb-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-end gap-3 rounded-xl border px-4 py-3 transition-colors"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
            style={{
              color: 'var(--text-primary)',
              maxHeight: 120,
              fontFamily: 'inherit',
            }}
            placeholder="Écris un message à IntraClaw… (Entrée pour envoyer)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim() && !isLoading ? 'var(--accent-blue)' : 'var(--bg-hover)',
              color: input.trim() && !isLoading ? '#fff' : 'var(--text-muted)',
            }}>
            <Send size={14} />
          </button>
        </div>
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
          Shift+Entrée pour nouvelle ligne · Historique sauvegardé localement
        </p>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
