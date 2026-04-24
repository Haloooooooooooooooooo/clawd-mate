const BRIDGE_BASE = 'http://127.0.0.1:43141';

export interface BridgeTaskPayload {
  title: string;
  duration_minutes: number;
  mode: string;
  subtasks: string[];
}

export async function getIslandState(): Promise<boolean | null> {
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
  try {
    const response = await fetch(`${BRIDGE_BASE}/tasks/pull?target=web`, { method: 'GET' });
    if (!response.ok) return [];
    const data = (await response.json()) as { tasks?: BridgeTaskPayload[] };
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch {
    return [];
  }
}
