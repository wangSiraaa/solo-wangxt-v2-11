import { Dexie, type Table } from 'dexie';
import type { PatternMaster, Project } from '../types';
import { buildSamples } from '../data/samples';

/** IndexedDB 持久层（Dexie） */
class KnitDB extends Dexie {
  projects!: Table<Project, string>;
  masters!: Table<PatternMaster, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('knit-chart-editor');
    this.version(1).stores({
      projects: 'id, updatedAt',
      masters: 'id, updatedAt',
      meta: 'key',
    });
  }
}

export const db = new KnitDB();

/** 首次启动时写入两套样例工程与花样母版 */
export async function ensureSeeded(): Promise<void> {
  const seeded = await db.meta.get('seeded');
  if (seeded) return;
  const { projects, masters } = buildSamples();
  await db.transaction('rw', db.projects, db.masters, db.meta, async () => {
    await db.projects.bulkPut(projects);
    await db.masters.bulkPut(masters);
    await db.meta.put({ key: 'seeded', value: true });
    await db.meta.put({ key: 'lastProjectId', value: projects[0].id });
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
