import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  ClipboardChunk,
  KnitProject,
  Rect,
} from '../types';
import {
  applyMasterUpdate,
  createMaster,
  deleteMaster,
  eraseMasterCell,
  eraseRect,
  mirrorRect,
  moveRect,
  paintCell,
  paintMasterCell,
  pasteChunk,
  placeMaster,
  resizeGrid,
  setCastOn,
} from '../lib/ops';
import { copyRect } from '../lib/patterns';
import { db, deleteProject as dbDelete, loadProject, saveProject } from '../lib/db';

export type Tool = 'paint' | 'erase' | 'select';

interface HistoryEntry {
  project: KnitProject;
  label: string;
  coalesceKey?: string;
}

interface EditorState {
  project: KnitProject | null;
  ready: boolean;
  tool: Tool;
  activeStitchId: string;
  activeColorId: string | null;
  selection: Rect | null;
  clipboard: ClipboardChunk | null;
  hover: { col: number; row: number } | null;
  /** 放置母版模式：点击画布即展开该母版 */
  placingMasterId: string | null;
  editingMasterId: string | null;

  past: HistoryEntry[];
  future: HistoryEntry[];
  lastCoalesceKey: string | null;

  // ---- 工程管理 ----
  open: (p: KnitProject) => void;
  replaceProject: (p: KnitProject) => void;
  close: () => void;
  removeProject: (id: string) => Promise<void>;

  // ---- 编辑 ----
  setTool: (t: Tool) => void;
  setActiveStitch: (id: string) => void;
  setActiveColor: (id: string | null) => void;
  setSelection: (r: Rect | null) => void;
  setHover: (h: { col: number; row: number } | null) => void;

  /** 核心变更入口；coalesceKey 相同的连续变更合并为一次撤销（如拖笔、方向键连按） */
  mutate: (label: string, fn: (p: KnitProject) => KnitProject, opts?: { coalesceKey?: string }) => void;

  paintAt: (col: number, row: number) => void;
  eraseAt: (col: number, row: number) => void;
  eraseSelection: () => void;
  mirrorSelection: () => void;
  nudgeSelection: (dc: number, dr: number) => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  selectAll: () => void;

  makeMaster: (name: string) => void;
  startPlacing: (masterId: string | null) => void;
  placeAt: (col: number, row: number) => void;
  applyPlacement: (placementId: string) => void;
  applyAllPlacements: () => void;
  editMaster: (id: string | null) => void;
  masterPaintAt: (col: number, row: number) => void;
  masterEraseAt: (col: number, row: number) => void;
  removeMaster: (id: string) => void;

  resize: (w: number, h: number) => void;
  changeCastOn: (n: number) => void;
  rename: (name: string) => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 120;
const CLIPBOARD_KEY = 'knit-chart-clipboard';

function loadClipboard(): ClipboardChunk | null {
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_KEY);
    return raw ? (JSON.parse(raw) as ClipboardChunk) : null;
  } catch {
    return null;
  }
}

function saveClipboard(chunk: ClipboardChunk | null) {
  try {
    if (chunk) sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(chunk));
    else sessionStorage.removeItem(CLIPBOARD_KEY);
  } catch {
    /* 会话存储不可用时仅影响跨会话粘贴 */
  }
}

/** 自动保存计时器（按工程 id 维护，切工程不串写） */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: KnitProject | null = null;
function scheduleSave(p: KnitProject) {
  pending = p;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (pending) {
    const p = pending;
    pending = null;
    void saveProject(p).catch((e) => console.error('自动保存失败', e));
  }
}

// 页面隐藏/关闭时立刻把防抖中的最新版本写入 IndexedDB（离线本地，无需网络）
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  ready: false,
  tool: 'paint',
  activeStitchId: 'knit',
  activeColorId: null,
  selection: null,
  clipboard: loadClipboard(),
  hover: null,
  placingMasterId: null,
  editingMasterId: null,
  past: [],
  future: [],
  lastCoalesceKey: null,

  open: (p) =>
    set({
      project: structuredClone(p),
      past: [],
      future: [],
      selection: null,
      hover: null,
      placingMasterId: null,
      editingMasterId: null,
      lastCoalesceKey: null,
      ready: true,
    }),

  replaceProject: (p) => set({ project: structuredClone(p) }),

  close: () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({
      project: null,
      past: [],
      future: [],
      selection: null,
      editingMasterId: null,
      placingMasterId: null,
    });
  },

  removeProject: async (id) => {
    await dbDelete(id);
    if (get().project?.id === id) get().close();
  },

  setTool: (t) => set({ tool: t, placingMasterId: null }),
  setActiveStitch: (id) => set({ activeStitchId: id }),
  setActiveColor: (id) => set({ activeColorId: id }),
  setSelection: (r) => set({ selection: r }),
  setHover: (h) => set({ hover: h }),

  mutate: (label, fn, opts) => {
    const { project, past, future, lastCoalesceKey } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return; // 纯函数判定无变化

    const ck = opts?.coalesceKey;
    if (ck && ck === lastCoalesceKey && past.length > 0 && future.length === 0) {
      // 同一连续手势（拖笔、拖移、长按方向键）：只替换当前版本，撤销点仍是手势开始前
      set({ project: next });
    } else {
      const entry: HistoryEntry = { project, label, coalesceKey: ck };
      set({
        project: next,
        past: [...past.slice(-(HISTORY_LIMIT - 1)), entry],
        future: [],
        lastCoalesceKey: ck ?? null,
      });
    }
    scheduleSave(next);
  },

  paintAt: (col, row) => {
    const { activeStitchId, activeColorId, mutate } = get();
    mutate(
      '绘制针法',
      (p) => paintCell(p, col, row, activeStitchId, activeColorId),
      { coalesceKey: 'paint-stroke' },
    );
  },

  eraseAt: (col, row) =>
    get().mutate('擦除', (p) => {
      // 主图擦除：按格删除
      return eraseRect(p, { c0: col, r0: row, c1: col, r1: row });
    }, { coalesceKey: 'erase-stroke' }),

  eraseSelection: () => {
    const { selection, mutate, setSelection } = get();
    if (!selection) return;
    mutate('清除选区', (p) => eraseRect(p, selection!));
    setSelection(null);
  },

  mirrorSelection: () => {
    const { selection, mutate } = get();
    if (!selection) return;
    // 镜像整体作为一个撤销组
    mutate('镜像选区（左右倾斜针法互换）', (p) => mirrorRect(p, selection!));
  },

  nudgeSelection: (dc, dr) => {
    const { selection, mutate } = get();
    if (!selection) return;
    mutate('移动选区', (p) => moveRect(p, selection!, dc, dr), {
      coalesceKey: 'nudge-selection',
    });
    const n = selection;
    get().setSelection({ c0: n.c0 + dc, r0: n.r0 + dr, c1: n.c1 + dc, r1: n.r1 + dr });
  },

  copy: () => {
    const { project, selection } = get();
    if (!project || !selection) return;
    const chunk = copyRect(project.cells, selection);
    saveClipboard(chunk);
    set({ clipboard: chunk });
  },

  cut: () => {
    const { project, selection, mutate, setSelection } = get();
    if (!project || !selection) return;
    const chunk = copyRect(project.cells, selection);
    saveClipboard(chunk);
    set({ clipboard: chunk });
    mutate('剪切', (p) => eraseRect(p, selection!));
    setSelection(null);
  },

  paste: () => {
    const { project, clipboard, selection, hover, mutate } = get();
    if (!project || !clipboard) return;
    // 粘贴锚点：优先当前悬停格 → 当前选区左上角 → (0,0)
    const baseCol = hover?.col ?? selection?.c0 ?? 0;
    const baseRow = hover?.row ?? selection?.r0 ?? 0;
    mutate('粘贴', (p) => pasteChunk(p, clipboard!, baseCol, baseRow, false).project);
    const r: Rect = {
      c0: baseCol,
      r0: baseRow,
      c1: Math.min(baseCol + clipboard.width - 1, project.settings.width - 1),
      r1: Math.min(baseRow + clipboard.height - 1, project.settings.height - 1),
    };
    set({ selection: r, tool: 'select' });
  },

  selectAll: () => {
    const { project } = get();
    if (!project) return;
    set({
      selection: { c0: 0, r0: 0, c1: project.settings.width - 1, r1: project.settings.height - 1 },
    });
  },

  makeMaster: (name) => {
    const { selection, mutate, setSelection } = get();
    if (!selection) return;
    const finalName = name.trim() || `花样 ${nanoid(4)}`;
    mutate('创建花样母版', (p) => createMaster(p, selection!, finalName).project);
    setSelection(null);
  },

  startPlacing: (masterId) => set({ placingMasterId: masterId, tool: masterId ? 'paint' : 'paint' }),

  placeAt: (col, row) => {
    const { placingMasterId, mutate } = get();
    if (!placingMasterId) return false;
    const mid = placingMasterId;
    mutate('放置循环花样', (p) => placeMaster(p, mid, col, row));
    set({ placingMasterId: null });
    return true;
  },

  applyPlacement: (placementId) =>
    get().mutate('应用母版更新', (p) => applyMasterUpdate(p, placementId)),

  applyAllPlacements: () => {
    const { project, mutate } = get();
    if (!project) return;
    const stale = project.placements
      .filter((pl) => {
        const m = project.masters.find((mm) => mm.id === pl.masterId);
        return !m || m.gen !== pl.gen;
      })
      .map((pl) => pl.id);
    if (stale.length === 0) return;
    // 全部放置的更新合为同一个撤销组
    mutate(`应用全部母版更新（${stale.length} 处）`, (p) =>
      stale.reduce((acc, id) => applyMasterUpdate(acc, id), p),
    );
  },

  editMaster: (id) => set({ editingMasterId: id, selection: null }),

  masterPaintAt: (col, row) => {
    const { editingMasterId, activeStitchId, activeColorId, mutate } = get();
    if (!editingMasterId) return;
    mutate(
      '修改母版针法',
      (p) => paintMasterCell(p, editingMasterId!, col, row, activeStitchId, activeColorId),
      { coalesceKey: 'master-paint' },
    );
  },

  masterEraseAt: (col, row) => {
    const { editingMasterId, mutate } = get();
    if (!editingMasterId) return;
    mutate('擦除母版针法', (p) => eraseMasterCell(p, editingMasterId!, col, row), {
      coalesceKey: 'master-erase',
    });
  },

  removeMaster: (id) => get().mutate('删除母版', (p) => deleteMaster(p, id)),

  resize: (w, h) => get().mutate('调整网格尺寸', (p) => resizeGrid(p, w, h)),
  changeCastOn: (n) => get().mutate('修改起针数', (p) => setCastOn(p, n)),
  rename: (name) =>
    get().mutate('重命名', (p) => ({ ...p, name: name.trim() || p.name })),

  undo: () => {
    const { project, past, future } = get();
    if (!project || past.length === 0) return;
    const prev = past[past.length - 1]!;
    set({
      project: prev.project,
      past: past.slice(0, -1),
      future: [{ project, label: prev.label }, ...future].slice(0, HISTORY_LIMIT),
      lastCoalesceKey: null,
    });
    scheduleSave(prev.project);
  },

  redo: () => {
    const { project, past, future } = get();
    if (!project || future.length === 0) return;
    const next = future[0]!;
    set({
      project: next.project,
      past: [...past, { project, label: next.label }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      lastCoalesceKey: null,
    });
    scheduleSave(next.project);
  },
}));

/** 启动时恢复最近工程（打开即编辑：由 App 在无显式选择时调用） */
export async function reopenLastProject(): Promise<KnitProject | null> {
  const all = (await db.table('projects').orderBy('updatedAt').reverse().toArray()) as KnitProject[];
  if (all.length === 0) return null;
  return (await loadProject(all[0]!.id)) ?? null;
}

export function breakCoalesce() {
  useEditor.setState({ lastCoalesceKey: null });
}
