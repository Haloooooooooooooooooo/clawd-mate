const BRIDGE_BASE = 'http://127.0.0.1:43141';
const bridgeEnvFlag = (import.meta.env.VITE_ENABLE_LOCAL_BRIDGE || '').toString().toLowerCase();
const isTauriRuntime =
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
const isBridgeForceDisabled = bridgeEnvFlag === '0' || bridgeEnvFlag === 'false';

// Web should auto-attempt localhost bridge so downloaded Island can sync with browser out of box.
// If desktop app is not running, all bridge APIs fail softly and return fallback values.
export const isLocalBridgeEnabled = !isBridgeForceDisabled;

export interface BridgeSubtaskPayload {
  title: string;
  status?: 'pending' | 'active' | 'completed' | 'skipped' | 'done';
}

export interface BridgeTaskPayload {
  sync_id?: string;
  title: string;
  duration_minutes: number;
  mode: string;
  subtasks: Array<string | BridgeSubtaskPayload>;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  elapsed_seconds?: number;
  focused?: boolean;
  updated_at_ms?: number;
}

export async function getIslandState(): Promise<boolean | null> {
  if (!isLocalBridgeEnabled) return null;
  try {
    const response = await fetch(`${BRIDGE_BASE}/island/state`, { method: 'GET' });
    if (!response.ok) return null;
    const data = (await response.json()) as { visible?: boolean };
    return typeof data.visible === 'boolean' ? data.visible : null;
  } catch {
    return null;
  }
}

export async function setIslandVisibility(visible: boolean): Promise<boolean | null> {
  if (!isLocalBridgeEnabled) return null;
  try {
    const response = await fetch(
      `${BRIDGE_BASE}/island/${visible ? 'show' : 'hide'}`,
      { method: 'POST' }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { visible?: boolean };
    return typeof data.visible === 'boolean' ? data.visible : null;
  } catch {
    return null;
  }
}

export async function pushTaskFromWeb(task: BridgeTaskPayload): Promise<boolean> {
  if (!isLocalBridgeEnabled) return false;
  try {
    const response = await fetch(`${BRIDGE_BASE}/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'web',
        task
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pullTasksForWeb(): Promise<BridgeTaskPayload[]> {
  if (!isLocalBridgeEnabled) return [];
  try {
    const response = await fetch(`${BRIDGE_BASE}/tasks/pull?target=web`, { method: 'GET' });
    if (!response.ok) return [];
    const data = (await response.json()) as { tasks?: BridgeTaskPayload[] };
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch {
    return [];
  }
}
