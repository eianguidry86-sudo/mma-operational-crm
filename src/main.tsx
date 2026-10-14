import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import Login from './pages/Login.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import './index.css';

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#E4E0D6] flex items-center justify-center">
        <span className="font-plexMono text-[10px] uppercase tracking-[0.15em] text-ledger-muted">
          Loading…
        </span>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </StrictMode>
);
