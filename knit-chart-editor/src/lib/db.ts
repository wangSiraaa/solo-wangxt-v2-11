import Dexie, { type Table } from 'dexie';
import type { KnitProject } from '../types';

/**
 * IndexedDB 封装（离线本地持久化）。
 * 整个工程以单条记录保存；settings/cells/masters/placements 随工程一起事务写入。
 */
class KnitDB extends Dexie {
  projects!: Table<KnitProject, string>;

  constructor() {
    super('knit-chart-editor');
    this.version(1).stores({
      // 主键 id，并按更新时间建索引用于最近工程列表
      projects: '&id, updatedAt',
    });
  }
}

export const db = new KnitDB();

export async function loadAllProjects(): Promise<KnitProject[]> {
  const all = await db.projects.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<KnitProject | undefined> {
  return db.projects.get(id);
}

/** 整体保存一个工程版本（撤销分组内若多次调用，调用方负责节流） */
export async function saveProject(project: KnitProject): Promise<void> {
  await db.transaction('rw', db.projects, async () => {
    await db.projects.put({ ...project, updatedAt: Date.now() });
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

export async function duplicateProject(project: KnitProject, newId: string): Promise<KnitProject> {
  const copy: KnitProject = {
    ...structuredClone(project),
    id: newId,
    name: `${project.name} 副本`,
    updatedAt: Date.now(),
  };
  await db.projects.put(copy);
  return copy;
}
