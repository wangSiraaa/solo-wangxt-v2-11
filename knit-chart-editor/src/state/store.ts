import { create } from 'zustand';
import type {
  CellData, ClipboardData, HistoryEntry, MasterInstance,
  Patch, PatternMaster, Project, Rect, Tool,
} from '../types';
import { db, ensureSeeded, getMeta, setMeta } from '../db/db';
import {
  applyPatches, clampRect, deleteRect, extractCells,
  invertPatches, mirrorRect, pasteCells,
} from '../lib/ops';
import { applyMasterPatches, impactKeys, placeInstancePatches } from '../lib/master';
import { cellKey } from '../lib/stitchMath';

export interface ViewState {
  x: number;       // 横向滚动（像素）
  y: number;       // 纵向滚动（像素）
  cell: number;    // 格子边长（像素）
  vw: number;      // 视口宽
  vh: number;      // 视口高
}

export interface ProjectMeta { id: string; name: string; updatedAt: number; }

interface AppState {
  ready: boolean;
  project: Project | null;
  projects: ProjectMeta[];
  masters: PatternMaster[];

  tool: Tool;
  symbolId: string;
  colorId: string;
  selection: Rect | null;
  clipboard: ClipboardData | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  view: ViewState;

  placing: { masterId: string; repX: number; repY: number } | null;
  placeRep: { x: number; y: number };
  impact: { master: PatternMaster; keys: string[] } | null;
  jump: { r: number; c: number; ts: number } | null;

  printOpen: boolean;
  settingsOpen: boolean;
  newOpen: boolean;
  openListOpen: boolean;
  masterEditor: { open: boolean; masterId: string | null };
  rightTab: 'check' | 'master';

  dirty: boolean;
  savedAt: number | null;

  // ---- 动作 ----
  loadInitial: () => Promise<void>;
  setView: (v: Partial<ViewState>) => void;
  setTool: (t: Tool) => void;
  setSymbol: (id: string) => void;
  setColor: (id: string) => void;
  setRightTab: (t: 'check' | 'master') => void;

  setSelection: (r: Rect | null) => void;
  selectAll: () => void;

  beginStroke: () => void;
  strokeCell: (r: number, c: number) => void;
  endStroke: () => void;

  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;
  deleteSelection: () => void;
  mirrorSelection: (dir: 'h' | 'v') => void;
  undo: () => void;
  redo: () => void;

  newProject: (opts: { name: string; rows: number; cols: number; castOn: number }) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateSettings: (opts: { name: string; rows: number; cols: number; castOn: number }) => void;

  startPlacing: (masterId: string) => void;
  cancelPlacing: () => void;
  placeAt: (r: number, c: number) => void;
  setPlaceRep: (x: number, y: number) => void;

  saveMasterDraft: (m: PatternMaster) => void;
  applyImpact: () => void;
  cancelImpact: () => void;
  deleteMaster: (id: string) => Promise<void>;

  jumpTo: (r: number, c: number) => void;
  setModal: (patch: Partial<Pick<AppState,
    'printOpen' | 'settingsOpen' | 'newOpen' | 'openListOpen' | 'masterEditor' | 'impact'>>) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let strokePatches: Map<string, Patch> | null = null;

/** 前后值相同的补丁不产生历史记录 */
function patchIsNoop(p: Patch): boolean {
  if (!p.prev && !p.next) return true;
  if (p.prev && p.next && !p.prev.src && !p.next.src &&
      p.prev.s === p.next.s && p.prev.c === p.next.c) return true;
  return false;
}

const uid = () =>
  'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

export const useStore = create<AppState>()((set, get) => {
  /** 提交一组补丁为一个撤销单元 */
  function commit(label: string, raw: Patch[], instNext?: MasterInstance[]) {
    const patches = raw.filter((p) => !patchIsNoop(p));
    const p = get().project;
    if (!p || (patches.length === 0 && !instNext)) return;
    const entry: HistoryEntry = {
      label, patches,
      instPrev: instNext ? p.instances : undefined,
      instNext,
    };
    const cells = applyPatches(p.cells, patches);
    set({
      project: { ...p, cells, instances: instNext ?? p.instances, updatedAt: Date.now() },
      past: [...get().past.slice(-99), entry],
      future: [],
    });
    scheduleSave();
  }

  function scheduleSave() {
    set({ dirty: true });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  }

  async function flushSave() {
    const p = get().project;
    if (!p) return;
    await db.projects.put(p);
    await setMeta('lastProjectId', p.id);
    const all = await db.projects.orderBy('updatedAt').reverse().toArray();
    set({
      dirty: false,
      savedAt: Date.now(),
      projects: all.map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt })),
    });
  }

  return {
    ready: false,
    project: null,
    projects: [],
    masters: [],
    tool: 'select',
    symbolId: 'knit',
    colorId: 'blue',
    selection: null,
    clipboard: null,
    past: [],
    future: [],
    view: { x: 0, y: 0, cell: 26, vw: 800, vh: 600 },
    placing: null,
    placeRep: { x: 3, y: 1 },
    impact: null,
    jump: null,
    printOpen: false,
    settingsOpen: false,
    newOpen: false,
    openListOpen: false,
    masterEditor: { open: false, masterId: null },
    rightTab: 'check',
    dirty: false,
    savedAt: null,

    async loadInitial() {
      await ensureSeeded();
      const masters = await db.masters.toArray();
      const all = await db.projects.orderBy('updatedAt').reverse().toArray();
      const lastId = await getMeta<string>('lastProjectId');
      const project = all.find((p) => p.id === lastId) ?? all[0] ?? null;
      set({
        ready: true,
        project,
        masters,
        projects: all.map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt })),
      });
    },

    setView: (v) => set({ view: { ...get().view, ...v } }),
    setTool: (t) => set({ tool: t }),
    setSymbol: (id) => set({ symbolId: id, tool: get().tool === 'select' ? 'symbol' : get().tool }),
    setColor: (id) => set({ colorId: id, tool: get().tool === 'select' ? 'color' : get().tool }),
    setRightTab: (t) => set({ rightTab: t }),

    setSelection: (r) => set({ selection: r }),
    selectAll: () => {
      const p = get().project;
      if (p) set({ selection: { r0: 1, c0: 1, r1: p.rows, c1: p.cols } });
    },

    beginStroke: () => { strokePatches = new Map(); },

    strokeCell: (r, c) => {
      const { project, tool, symbolId, colorId } = get();
      if (!project || !strokePatches) return;
      if (r < 1 || r > project.rows || c < 1 || c > project.cols) return;
      const key = cellKey(r, c);
      const prev = strokePatches.get(key)?.prev ?? project.cells[key];
      let next: CellData | undefined;
      if (tool === 'symbol') next = { s: symbolId, c: project.cells[key]?.c ?? 'none' };
      else if (tool === 'color') next = { s: project.cells[key]?.s ?? 'knit', c: colorId };
      else if (tool === 'erase') next = undefined;
      else return;
      const cur = project.cells[key];
      const unchanged =
        (next === undefined && cur === undefined) ||
        (next !== undefined && cur !== undefined && cur.s === next.s && cur.c === next.c && !cur.src);
      if (unchanged && !strokePatches.has(key)) return;
      strokePatches.set(key, { key, prev, next });
      // 笔迹即时生效（撤销单元在 endStroke 时成组提交）
      const cells = applyPatches(project.cells, [{ key, prev: cur, next }]);
      set({ project: { ...project, cells } });
    },

    endStroke: () => {
      if (!strokePatches) return;
      // 笔迹已在 strokeCell 中即时生效，这里只把整笔作为一条历史记录提交（分组撤销）
      const patches = [...strokePatches.values()].filter((p) => !patchIsNoop(p));
      strokePatches = null;
      if (patches.length === 0) return;
      const p = get().project!;
      const entry: HistoryEntry = { label: '绘制', patches };
      set({
        project: { ...p, updatedAt: Date.now() },
        past: [...get().past.slice(-99), entry],
        future: [],
      });
      scheduleSave();
    },

    copySelection: () => {
      const { project, selection } = get();
      if (!project || !selection) return;
      set({ clipboard: extractCells(project.cells, selection) });
    },

    cutSelection: () => {
      const { project, selection } = get();
      if (!project || !selection) return;
      set({ clipboard: extractCells(project.cells, selection) });
      commit('剪切', deleteRect(project.cells, selection));
    },

    paste: () => {
      const { project, clipboard, selection, view } = get();
      if (!project || !clipboard) return;
      let at: { r: number; c: number };
      if (selection) {
        at = { r: selection.r0, c: selection.c0 };
      } else {
        // 无选区时粘贴到当前视野中心
        const cc = Math.max(1, Math.min(project.cols, Math.round((view.x + view.vw / 2) / view.cell)));
        const rr = Math.max(1, Math.min(project.rows,
          project.rows - Math.floor((view.y + view.vh / 2) / view.cell)));
        at = { r: rr, c: cc };
      }
      const patches = pasteCells(project.cells, clipboard, at, project.rows, project.cols);
      commit('粘贴', patches);
      set({
        selection: clampRect(
          { r0: at.r, c0: at.c, r1: at.r + clipboard.h - 1, c1: at.c + clipboard.w - 1 },
          project.rows, project.cols,
        ),
      });
    },

    deleteSelection: () => {
      const { project, selection } = get();
      if (!project || !selection) return;
      commit('删除', deleteRect(project.cells, selection));
    },

    mirrorSelection: (dir) => {
      const { project, selection } = get();
      if (!project || !selection) return;
      commit(dir === 'h' ? '左右镜像' : '上下镜像', mirrorRect(project.cells, selection, dir));
    },

    undo: () => {
      const { past, future, project } = get();
      const entry = past[past.length - 1];
      if (!entry || !project) return;
      const cells = applyPatches(project.cells, invertPatches(entry.patches));
      const instances = entry.instPrev ?? project.instances;
      set({
        project: { ...project, cells, instances, updatedAt: Date.now() },
        past: past.slice(0, -1),
        future: [...future, entry],
      });
      scheduleSave();
    },

    redo: () => {
      const { past, future, project } = get();
      const entry = future[future.length - 1];
      if (!entry || !project) return;
      const cells = applyPatches(project.cells, entry.patches);
      const instances = entry.instNext ?? project.instances;
      set({
        project: { ...project, cells, instances, updatedAt: Date.now() },
        past: [...past, entry],
        future: future.slice(0, -1),
      });
      scheduleSave();
    },

    newProject: async ({ name, rows, cols, castOn }) => {
      const p: Project = {
        id: uid(), name, rows, cols, castOn,
        cells: {}, instances: [], updatedAt: Date.now(),
      };
      await db.projects.put(p);
      await setMeta('lastProjectId', p.id);
      const all = await db.projects.orderBy('updatedAt').reverse().toArray();
      set({
        project: p, selection: null, past: [], future: [],
        projects: all.map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt })),
        newOpen: false, savedAt: Date.now(), dirty: false,
      });
    },

    openProject: async (id) => {
      const p = await db.projects.get(id);
      if (!p) return;
      await setMeta('lastProjectId', id);
      set({
        project: p, selection: null, past: [], future: [],
        openListOpen: false, impact: null, placing: null, savedAt: Date.now(), dirty: false,
      });
    },

    deleteProject: async (id) => {
      await db.projects.delete(id);
      const all = await db.projects.orderBy('updatedAt').reverse().toArray();
      const metas = all.map((x) => ({ id: x.id, name: x.name, updatedAt: x.updatedAt }));
      if (get().project?.id === id) {
        const next = all[0] ?? null;
        set({ project: next, projects: metas, selection: null, past: [], future: [] });
        if (next) await setMeta('lastProjectId', next.id);
      } else {
        set({ projects: metas });
      }
    },

    updateSettings: ({ name, rows, cols, castOn }) => {
      const p = get().project;
      if (!p) return;
      // 缩小尺寸时裁剪越界格子
      const cells: typeof p.cells = {};
      for (const [k, v] of Object.entries(p.cells)) {
        const [r, c] = k.split(',').map(Number);
        if (r <= rows && c <= cols) cells[k] = v;
      }
      const instances = p.instances.filter(
        (i) => i.originR <= rows && i.originC <= cols,
      );
      set({
        project: { ...p, name, rows, cols, castOn, cells, instances, updatedAt: Date.now() },
        selection: null,
        settingsOpen: false,
      });
      scheduleSave();
    },

    startPlacing: (masterId) => {
      const { placeRep } = get();
      set({ placing: { masterId, repX: placeRep.x, repY: placeRep.y }, tool: 'select' });
    },
    cancelPlacing: () => set({ placing: null }),
    setPlaceRep: (x, y) => set({ placeRep: { x, y } }),

    placeAt: (r, c) => {
      const { project, placing, masters } = get();
      if (!project || !placing) return;
      const master = masters.find((m) => m.id === placing.masterId);
      if (!master) return;
      const inst: MasterInstance = {
        id: uid(), masterId: master.id,
        originR: r, originC: c, repX: placing.repX, repY: placing.repY,
      };
      const instNext = [...project.instances, inst];
      const patches = placeInstancePatches({ ...project, instances: instNext }, master, inst);
      commit(`放置花样「${master.name}」`, patches, instNext);
      set({ placing: null });
    },

    /** 母版编辑保存：先计算影响并进入预览态 */
    saveMasterDraft: (m) => {
      const { project, masters } = get();
      const exists = masters.some((x) => x.id === m.id);
      const next = exists ? masters.map((x) => (x.id === m.id ? m : x)) : [...masters, m];
      set({ masters: next, masterEditor: { open: false, masterId: null } });
      void db.masters.put(m);
      if (project && exists) {
        const keys = impactKeys(project, m);
        if (keys.length > 0) set({ impact: { master: m, keys } });
        else set({ impact: null });
      }
    },

    applyImpact: () => {
      const { project, impact } = get();
      if (!project || !impact) return;
      const patches = applyMasterPatches(project, impact.master);
      commit(`应用母版「${impact.master.name}」`, patches);
      set({ impact: null });
    },

    cancelImpact: () => set({ impact: null }),

    deleteMaster: async (id) => {
      await db.masters.delete(id);
      set({ masters: get().masters.filter((m) => m.id !== id) });
    },

    jumpTo: (r, c) => set({ jump: { r, c, ts: Date.now() } }),

    setModal: (patch) => set(patch),
  };
});

/** 立即落盘（页面关闭/隐藏前调用） */
export function flushSaveNow() {
  const { project, dirty } = useStore.getState();
  if (project && dirty) void db.projects.put(project);
}
