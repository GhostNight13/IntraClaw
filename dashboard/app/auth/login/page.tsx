'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid credentials');
      setLoading(false);
      return;
    }

    router.push('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div
        className="w-full max-w-md p-8 rounded-2xl backdrop-blur"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            🐾
          </div>
          <span className="font-semibold text-xl" style={{ color: 'var(--text-primary)' }}>IntraClaw</span>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Sign in to your agent dashboard</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors focus:outline-none"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm block mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors focus:outline-none"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-medium py-3 rounded-lg transition-all disabled:opacity-50 text-white bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
