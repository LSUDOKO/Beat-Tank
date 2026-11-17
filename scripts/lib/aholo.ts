import type { Lux3dClient, Lux3dTaskResult } from '@manycore/aholo-sdk-lux3d';

/**
 * tasks.waitFor() throws on the first network error, and connections to the
 * gateway time out now and then while the task keeps running server-side.
 * This poller retries transient errors and only fails on a failed/cancelled task or timeout.
 */
export async function waitTask(lux3d: Lux3dClient, taskId: number, intervalMs = 10_000, timeoutMs = 30 * 60_000): Promise<Lux3dTaskResult> {
  const end = Date.now() + timeoutMs;
  let errors = 0;
  while (Date.now() < end) {
    try {
      const r = await lux3d.tasks.retrieve(taskId);
      errors = 0;
      if (r.status === 3) return r;
      if (r.status === 4 || r.status === 6) throw Object.assign(new Error(`task ${taskId} ended with status ${r.status}`), { fatal: true });
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || ++errors > 20) throw e;
      console.warn(`poll ${taskId}: ${(e as Error).message} (retry ${errors})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`task ${taskId} timed out`);
}

/** Task outputs as plain URLs (some endpoints return a JSON-encoded array in one output). */
export const outputUrls = (r: Lux3dTaskResult) =>
  r.outputs.flatMap((o) => { const c = o.content ?? ''; return c.startsWith('[') ? (JSON.parse(c) as string[]) : [c]; }).filter((c) => c.startsWith('http'));

/** fetch with retries for downloads. */
export async function download(url: string, tries = 5): Promise<Buffer> {
  for (let i = 1; ; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}
