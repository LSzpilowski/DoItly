import { create } from 'zustand';
import type {
  View,
  SortField,
  SortDir,
  ModalState,
  AppNotification,
  AppSettings,
  NotificationType,
  Category,
} from './types';
import { CATEGORY_COLORS } from './types';
import type { Task } from './tasksStore';

const MAX_CATEGORIES = 6;

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work',     name: 'Work',     color: 'bg-blue-500' },
  { id: 'personal', name: 'Personal', color: 'bg-purple-500' },
  { id: 'shopping', name: 'Shopping', color: 'bg-green-500' },
  { id: 'health',   name: 'Health',   color: 'bg-amber-500' },
];

// ── Per-workspace category storage ──────────────────────────────────────────
const CATS_KEY = 'doitly_categories_v2'; // keyed by workspace id

function loadAllCategories(): Record<string, Category[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllCategories(all: Record<string, Category[]>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CATS_KEY, JSON.stringify(all));
  }
}

function getCategoriesForWorkspace(all: Record<string, Category[]>, wsId: string): Category[] {
  return all[wsId] ?? [...DEFAULT_CATEGORIES];
}

interface UIState {
  // View / navigation
  currentView: View;
  currentCategory: string | null;

  // Active workspace (mirrored from workspaceStore for filtering)
  activeWorkspaceId: string | null;

  // Sort
  sortField: SortField;
  sortDir: SortDir;

  // Selection (bulk actions)
  selectedTasks: Set<string>;

  // Modal state
  modals: ModalState;
  editingTask: Task | null;

  // Notifications
  notifications: AppNotification[];

  // App settings
  settings: AppSettings;

  // Categories (for current active workspace)
  categories: Category[];
  // All categories by workspace id
  categoriesByWorkspace: Record<string, Category[]>;

  // ── Actions ──
  setView: (view: View) => void;
  setCategory: (category: string | null) => void;
  setSortField: (field: SortField) => void;
  toggleSortDir: () => void;
  setSortDir: (dir: SortDir) => void;

  /** Called from header workspace dropdown / workspaceStore to sync active workspace */
  setActiveWorkspaceId: (id: string) => void;

  openTaskModal: (task?: Task) => void;
  openSearchModal: () => void;
  openFocusModal: () => void;
  openSettingsModal: () => void;
  openWorkspaceModal: () => void;
  closeAllModals: () => void;

  toggleTaskSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  showNotification: (title: string, type?: NotificationType, body?: string) => void;
  removeNotification: (id: string) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;

  addCategory: (name: string) => void;
  removeCategory: (id: string) => void;
  renameCategory: (id: string, name: string, color: string) => void;
  reorderCategories: (ordered: Category[]) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: true,
  soundAlerts: false,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('doitly_settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('doitly_settings', JSON.stringify(settings));
  }
}

const CLOSED_MODALS: ModalState = {
  task: false,
  search: false,
  focus: false,
  settings: false,
  workspace: false,
};

let notifIdCounter = 0;

// Load initial workspace id from workspaceStore's localStorage
function loadInitialWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('doitly_workspaces');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.activeId ?? parsed.workspaces?.[0]?.id ?? null;
    }
    return null;
  } catch { return null; }
}

const _initWsId = loadInitialWorkspaceId();
const _initAllCats = loadAllCategories();
const _initCats = getCategoriesForWorkspace(_initAllCats, _initWsId ?? '');

export const useUIStore = create<UIState>((set, get) => ({
  currentView: 'all',
  currentCategory: null,

  activeWorkspaceId: _initWsId,

  sortField: 'created',
  sortDir: 'desc',

  selectedTasks: new Set<string>(),

  modals: { ...CLOSED_MODALS },
  editingTask: null,

  notifications: [],

  settings: loadSettings(),

  categories: _initCats,
  categoriesByWorkspace: _initAllCats,

  // ── Navigation ──
  setView: (view) => set({ currentView: view, currentCategory: null, selectedTasks: new Set<string>() }),
  setCategory: (category) =>
    set({ currentView: 'category', currentCategory: category }),

  // ── Workspace sync ──
  setActiveWorkspaceId: (id) => {
    const { categoriesByWorkspace } = get();
    const cats = getCategoriesForWorkspace(categoriesByWorkspace, id);
    set({
      activeWorkspaceId: id,
      categories: cats,
      currentView: 'all',
      currentCategory: null,
      selectedTasks: new Set<string>(),
    });
  },

  // ── Sort ──
  setSortField: (field) => set({ sortField: field }),
  toggleSortDir: () =>
    set(s => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
  setSortDir: (dir) => set({ sortDir: dir }),

  // ── Modals ──
  openTaskModal: (task) =>
    set({ modals: { ...CLOSED_MODALS, task: true }, editingTask: task ?? null }),
  openSearchModal: () =>
    set({ modals: { ...CLOSED_MODALS, search: true } }),
  openFocusModal: () =>
    set({ modals: { ...CLOSED_MODALS, focus: true } }),
  openSettingsModal: () =>
    set({ modals: { ...CLOSED_MODALS, settings: true } }),
  openWorkspaceModal: () =>
    set({ modals: { ...CLOSED_MODALS, workspace: true } }),
  closeAllModals: () =>
    set({ modals: { ...CLOSED_MODALS }, editingTask: null }),

  // ── Selection ──
  toggleTaskSelect: (id) => {
    const next = new Set(get().selectedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedTasks: next });
  },
  selectAll: (ids) => set({ selectedTasks: new Set(ids) }),
  clearSelection: () => set({ selectedTasks: new Set<string>() }),

  // ── Notifications ──
  showNotification: (title, type = 'info', body) => {
    const id = `notif-${++notifIdCounter}-${Date.now()}`;
    const notification: AppNotification = { id, type, title, body };
    set(s => ({ notifications: [...s.notifications, notification] }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 3500);
  },
  removeNotification: (id) =>
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),

  // ── Settings ──
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    set({ settings });
  },

  // ── Categories ──
  addCategory: (name) => {
    const { categories, categoriesByWorkspace, activeWorkspaceId } = get();
    if (categories.length >= MAX_CATEGORIES) return;
    const usedColors = categories.map((c) => c.color);
    const color = CATEGORY_COLORS.find((c) => !usedColors.includes(c)) ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    const next = [
      ...categories,
      { id: crypto.randomUUID(), name, color },
    ];
    const allCats = { ...categoriesByWorkspace, [activeWorkspaceId ?? '']: next };
    saveAllCategories(allCats);
    set({ categories: next, categoriesByWorkspace: allCats });
  },

  removeCategory: (id) => {
    const { categories, categoriesByWorkspace, activeWorkspaceId } = get();
    const next = categories.filter((c) => c.id !== id);
    const allCats = { ...categoriesByWorkspace, [activeWorkspaceId ?? '']: next };
    saveAllCategories(allCats);
    set({ categories: next, categoriesByWorkspace: allCats });
  },

  renameCategory: (id, name, color) => {
    const { categories, categoriesByWorkspace, activeWorkspaceId } = get();
    const next = categories.map((c) => c.id === id ? { ...c, name, color } : c);
    const allCats = { ...categoriesByWorkspace, [activeWorkspaceId ?? '']: next };
    saveAllCategories(allCats);
    set({ categories: next, categoriesByWorkspace: allCats });
  },

  reorderCategories: (ordered) => {
    const { categoriesByWorkspace, activeWorkspaceId } = get();
    const allCats = { ...categoriesByWorkspace, [activeWorkspaceId ?? '']: ordered };
    saveAllCategories(allCats);
    set({ categories: ordered, categoriesByWorkspace: allCats });
  },
}));
