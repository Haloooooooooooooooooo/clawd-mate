import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const GUEST_PERSIST_KEY = 'clawdmate-storage-prod';

function getPersistedLoggedInFlag(): boolean {
  try {
    const raw = localStorage.getItem(GUEST_PERSIST_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { isLoggedIn?: boolean } };
    return Boolean(parsed?.state?.isLoggedIn);
  } catch {
    return false;
  }
}

function shouldClearGuestSnapshotOnBoot(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === 'reload' || nav?.type === 'back_forward') {
    return false;
  }
  return true;
}

function clearPersistedHistoryOnBoot() {
  try {
    if (getPersistedLoggedInFlag()) {
      return;
    }
    const raw = localStorage.getItem(GUEST_PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (!parsed?.state) return;
    parsed.state = {
      ...parsed.state,
      history: [],
      recentCelebrationAt: 0
    };
    localStorage.setItem(GUEST_PERSIST_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore malformed local snapshots.
  }
}

if (!getPersistedLoggedInFlag() && shouldClearGuestSnapshotOnBoot()) {
  localStorage.removeItem(GUEST_PERSIST_KEY);
}

clearPersistedHistoryOnBoot();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
