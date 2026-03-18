import { create } from 'zustand';
import type { Workspace } from './types';

const MAX_WORKSPACES = 3;
const STORAGE_KEY = 'doitly_workspaces';

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default-workspace',
  name: 'Default',
  color: 'bg-green-500',
  createdAt: new Date().toISOString(),
};

function load(): { workspaces: Workspace[]; activeId: string | null } {
  if (typeof window === 'undefined') return { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // migrate: if empty workspaces array, seed with default
      if (!parsed.workspaces || parsed.workspaces.length === 0) {
        return { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id };
      }
      return parsed;
    }
    return { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id };
  } catch {
    return { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id };
  }
}

function save(workspaces: Workspace[], activeId: string | null) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workspaces, activeId }));
  }
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  addWorkspace: (name: string, color: string) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string, color: string) => void;
  setActiveWorkspace: (id: string) => void;
  reorderWorkspaces: (ordered: Workspace[]) => void;
}

const initial = load();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: initial.workspaces,
  activeWorkspaceId: initial.activeId,

  addWorkspace: (name, color) => {
    const { workspaces } = get();
    if (workspaces.length >= MAX_WORKSPACES) return;
    const newWs: Workspace = {
      id: crypto.randomUUID(),
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    const next = [...workspaces, newWs];
    const activeId = get().activeWorkspaceId ?? newWs.id;
    save(next, activeId);
    set({ workspaces: next, activeWorkspaceId: activeId });
  },

  removeWorkspace: (id) => {
    const { workspaces, activeWorkspaceId } = get();
    if (workspaces.length <= 1) return; // keep at least one
    const next = workspaces.filter((w) => w.id !== id);
    const activeId = activeWorkspaceId === id ? (next[0]?.id ?? null) : activeWorkspaceId;
    save(next, activeId);
    set({ workspaces: next, activeWorkspaceId: activeId });
  },

  renameWorkspace: (id, name, color) => {
    const next = get().workspaces.map((w) => (w.id === id ? { ...w, name, color } : w));
    save(next, get().activeWorkspaceId);
    set({ workspaces: next });
  },

  reorderWorkspaces: (ordered) => {
    save(ordered, get().activeWorkspaceId);
    set({ workspaces: ordered });
  },

  setActiveWorkspace: (id) => {
    save(get().workspaces, id);
    set({ activeWorkspaceId: id });
  },
}));
