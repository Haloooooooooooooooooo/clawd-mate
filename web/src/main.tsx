import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const GUEST_PERSIST_KEY = 'clawdmate-storage-prod';
const LAST_UNLOAD_AT_KEY = 'clawdmate-guest-last-unload-at';
const SAME_SESSION_REOPEN_MS = 4000;

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
  const lastUnloadRaw = localStorage.getItem(LAST_UNLOAD_AT_KEY);
  if (!lastUnloadRaw) return false;
  const lastUnloadAt = Number(lastUnloadRaw);
  if (!Number.isFinite(lastUnloadAt)) return false;
  return Date.now() - lastUnloadAt > SAME_SESSION_REOPEN_MS;
}

if (!getPersistedLoggedInFlag() && shouldClearGuestSnapshotOnBoot()) {
  localStorage.removeItem(GUEST_PERSIST_KEY);
}

window.addEventListener('pagehide', () => {
  localStorage.setItem(LAST_UNLOAD_AT_KEY, String(Date.now()));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
