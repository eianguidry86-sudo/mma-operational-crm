import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : signInError.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#E4E0D6] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-ledger-paper border border-ledger-navy/20 shadow-ledger-frame">
        {/* Header band, matching the command bar treatment */}
        <div className="h-[50px] bg-ledger-navy flex items-center px-4 gap-2.5">
          <div className="grid grid-cols-2 gap-0.5 w-5 h-5 flex-shrink-0">
            <div className="bg-white" />
            <div className="bg-white" />
            <div className="bg-white" />
            <div className="bg-ledger-crimson" />
          </div>
          <span className="font-geist font-semibold text-[16px] text-white leading-none">MarketMap</span>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-8">
          <div className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-muted mb-1">
            Sign In
          </div>
          <h1 className="font-serifLedger text-[28px] leading-none text-ledger-navy mb-6">
            Welcome back
          </h1>

          <label className="block font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mb-4 px-3 py-2.5 font-plexSans text-sm text-ledger-navy bg-white border border-ledger-hairline focus:outline-none focus:border-ledger-navy transition-colors"
            placeholder="you@marketmapanalytics.com"
          />

          <label className="block font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-5 px-3 py-2.5 font-plexSans text-sm text-ledger-navy bg-white border border-ledger-hairline focus:outline-none focus:border-ledger-navy transition-colors"
            placeholder="••••••••"
          />

          {error && (
            <div className="mb-4 px-3 py-2 bg-ledger-crimson/10 border border-ledger-crimson/30 font-plexSans text-xs text-ledger-crimson">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 bg-ledger-navy text-white font-plexMono text-[11px] uppercase tracking-[0.1em] px-4 py-3 hover:bg-ledger-navyHover transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="mt-5 font-plexSans text-xs text-ledger-muted text-center">
            Need an account? Ask your administrator to add you in Supabase.
          </p>
        </form>
      </div>
    </div>
  );
}
