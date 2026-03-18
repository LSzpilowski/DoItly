import { type Page, type BrowserContext, expect } from "@playwright/test";

// ─── Types (mirror tasksStore) ────────────────────────────────────────────────
export interface TestTask {
  id: string;
  text: string;
  title?: string;
  status: "active" | "inProgress" | "completed" | "deleted" | "archived" | "overdue";
  createdAt: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  /** @deprecated use status: 'overdue' instead */
  overdue?: boolean;
  /** @deprecated use status: 'overdue' instead */
  overdueAt?: string;
  isTemplate?: boolean;
  [key: string]: unknown;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for today in LOCAL timezone (mirrors tasksStore logic) */
export function todayStr(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM-DD for a day offset from today (+N or -N) */
export function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the current ISO week */
export function thisWeekMonStr(): string {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Sunday of the current ISO week */
export function thisWeekSunStr(): string {
  const mon = new Date(thisWeekMonStr() + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = "doitly_tasks_v2";

/**
 * Seed a task directly into localStorage (bypasses UI, instant).
 * Call BEFORE page.goto() or after page.evaluate() to pre-populate.
 */
export async function seedTasks(context: BrowserContext, tasks: TestTask[]): Promise<void> {
  await context.addInitScript(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: STORAGE_KEY, data: tasks },
  );
}

/**
 * Read the raw tasks array from localStorage as parsed JSON.
 */
export async function getLocalTasks(page: Page): Promise<TestTask[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, STORAGE_KEY);
}

/**
 * Read ONE task by id from localStorage.
 */
export async function getLocalTask(page: Page, id: string): Promise<TestTask | undefined> {
  const tasks = await getLocalTasks(page);
  return tasks.find((t) => t.id === id);
}

/**
 * Clear all Doitly localStorage keys so each test starts fresh.
 */
export async function clearStorage(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const KEYS = [
      "doitly_tasks_v2",
      "doitly_categories",
      "doitly_workspaces",
      "doitly_settings",
      "doitly_sidebar_collapsed",
    ];
    KEYS.forEach((k) => localStorage.removeItem(k));
  });
}

// ─── Task factory ─────────────────────────────────────────────────────────────

let _seq = 0;
/** Create a minimal valid TestTask with optional overrides */
export function makeTask(overrides: Partial<TestTask> = {}): TestTask {
  _seq++;
  return {
    id: `test-task-${_seq}-${Math.random().toString(36).slice(2, 8)}`,
    text: overrides.title ?? `Test Task ${_seq}`,
    title: overrides.title ?? `Test Task ${_seq}`,
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── UI action helpers ────────────────────────────────────────────────────────

/**
 * Navigate to a view via Sidebar by visible button/link text.
 * Works for: "Today", "This Week", "All Tasks", "Overdue", "Calendar", "Completed"
 */
export async function gotoView(page: Page, label: string): Promise<void> {
  // The sidebar renders view buttons inside a .space-y-0.5 group after the VIEWS header.
  // We scope to buttons that are within the left sidebar panel (< 320px from left edge)
  // by filtering for buttons whose bounding box x < 320.
  const allButtons = page.getByRole("button", { name: label, exact: true });
  const count = await allButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = allButtons.nth(i);
    const box = await btn.boundingBox();
    // Sidebar buttons are in the left ~280px column
    if (box && box.x < 320 && box.width < 320) {
      await btn.click();
      await page.waitForTimeout(400);
      return;
    }
  }
  // Fallback: click first match
  await allButtons.first().click();
  await page.waitForTimeout(400);
}

/**
 * Open the Planner and click on the Day or Week tab.
 */
export async function gotoPlannerTab(page: Page, tab: "Day" | "Week"): Promise<void> {
  // Click the sidebar "Planner" button (scope to sidebar by x-position)
  const plannerButtons = page.getByRole("button", { name: "Planner" });
  const count = await plannerButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = plannerButtons.nth(i);
    const box = await btn.boundingBox();
    if (box && box.x < 320) {
      await btn.click();
      await page.waitForTimeout(400);
      break;
    }
  }

  if (tab === "Week") {
    // The PlannerShell tab bar is a flex row of buttons inside a bg-muted rounded-xl pill.
    // Tab labels are: "☀️ Day" and "📅 Week". Scope to buttons that contain ONLY "Week"
    // (not "This Week") by using exact text matching via the inner span text.
    // The tab button contains a <span> with the emoji and then the label text.
    // Use getByRole scoped to the tab bar container (bg-muted rounded-xl w-fit).
    const tabBar = page.locator(".bg-muted.rounded-xl.w-fit").first();
    await tabBar.getByRole("button", { name: "Week" }).click();
    await page.waitForTimeout(400);
  }
  // "Day" is the default tab — already visible after clicking Planner
}

/**
 * Open AddTask modal, fill title + optional dueDate, submit.
 * Returns the task id found in localStorage immediately after.
 */
export async function addTaskViaModal(
  page: Page,
  title: string,
  dueDate?: string,
): Promise<string> {
  // Open modal via sidebar "Add Task" button
  await page.getByRole("button", { name: "Add Task" }).click();
  await expect(page.getByRole("heading", { name: "Add Task" })).toBeVisible();

  // Fill title
  await page.getByPlaceholder("Task title...").fill(title);

  // Fill due date if provided
  if (dueDate) {
    await page.locator('input[type="date"]').fill(dueDate);
  }

  // Submit — button text is "Create Task" (new) or "Save Changes" (edit)
  await page.getByRole("button", { name: /create task|save changes/i }).first().click();
  await expect(page.getByRole("heading", { name: /add task|edit task/i })).not.toBeVisible({ timeout: 8_000 });

  // Find the task by title in localStorage
  const tasks = await getLocalTasks(page);
  const task = tasks.find((t) => (t.title ?? t.text) === title);
  if (!task) throw new Error(`Task "${title}" not found in localStorage after add`);
  return task.id;
}

/**
 * Assert that a task with the given id has the expected dueDate in localStorage.
 */
export async function assertDueDate(
  page: Page,
  taskId: string,
  expected: string | undefined,
): Promise<void> {
  const task = await getLocalTask(page, taskId);
  if (!task) throw new Error(`Task ${taskId} not found in localStorage`);
  expect(task.dueDate).toBe(expected);
}

/**
 * Assert a task is VISIBLE in the current view list by its title.
 */
export async function assertVisibleInList(page: Page, title: string): Promise<void> {
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 5_000 });
}

/**
 * Assert a task is NOT visible in the current view list by its title.
 * We wait a tick first in case the list is still updating.
 */
export async function assertNotVisibleInList(page: Page, title: string): Promise<void> {
  await expect(page.getByText(title).first()).not.toBeVisible({ timeout: 5_000 });
}
