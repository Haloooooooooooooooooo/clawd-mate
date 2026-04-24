export interface BridgeTaskPayload {
  title: string;
  duration_minutes: number;
  mode: string;
  subtasks: string[];
}

const BRIDGE_BASE = 'http://127.0.0.1:43141';

export async function pushTaskFromIsland(task: BridgeTaskPayload): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_BASE}/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'island',
        task
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pullTasksForIsland(): Promise<BridgeTaskPayload[]> {
  try {
    const response = await fetch(`${BRIDGE_BASE}/tasks/pull?target=island`, { method: 'GET' });
    if (!response.ok) return [];
    const data = (await response.json()) as { tasks?: BridgeTaskPayload[] };
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch {
    return [];
  }
}
