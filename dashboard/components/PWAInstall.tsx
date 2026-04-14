'use client';
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (installed || !prompt) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 rounded-lg p-3 shadow-xl max-w-xs border"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
        Install IntraClaw as an app
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            void prompt.prompt();
            setPrompt(null);
          }}
          className="flex-1 text-white text-xs py-1.5 px-3 rounded transition-colors"
          style={{ background: 'var(--accent-blue)' }}
        >
          Install
        </button>
        <button
          onClick={() => setPrompt(null)}
          className="text-xs py-1.5 px-3 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
