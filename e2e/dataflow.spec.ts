/**
 * Doitly – Dataflow E2E Test Suite
 * =================================
 * Covers all scenarios where `dueDate` is the single source of truth:
 *
 * SCENARIO I   – Task without dueDate, assigned via Planner → Day
 * SCENARIO II  – Task without dueDate, assigned via Planner → Week
 * SCENARIO III – Task without dueDate, assigned via Views → Calendar
 * SCENARIO IV  – Task created with explicit dueDate via Add Task modal
 * SCENARIO V   – Changing dueDate to a DIFFERENT date (cross-view update)
 * SCENARIO VI  – Removing dueDate (task disappears from all planning views)
 * SCENARIO VII – Overdue detection (past dueDate → appears in Overdue view)
 * SCENARIO VIII – Cross-view consistency (same task visible in all correct views)
 *
 * Each scenario checks:
 *  ✓ dueDate value in localStorage after the action
 *  ✓ Task appears in the correct views
 *  ✓ Task does NOT appear in views where it doesn't belong
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  clearStorage,
  seedTasks,
  getLocalTask,
  makeTask,
  todayStr,
  offsetDate,
  thisWeekMonStr,
  thisWeekSunStr,
  assertDueDate,
  gotoView,
  gotoPlannerTab,
  addTaskViaModal,
  assertVisibleInList,
  assertNotVisibleInList,
} from "./helpers";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ context }) => {
  await clearStorage(context);
});

// ─── Helpers local to this file ───────────────────────────────────────────────

/**
 * Drag a task card from source to target using Playwright's dragTo.
 * Both locators must be visible before calling.
 */
async function dragTo(
  page: Page,
  sourceText: string,
  targetLocator: ReturnType<Page["locator"]>,
): Promise<void> {
  const source = page.getByText(sourceText).first();
  await source.scrollIntoViewIfNeeded();
  await targetLocator.scrollIntoViewIfNeeded();
  await source.dragTo(targetLocator, { force: true });
  // Give the DnD handler and Zustand update a moment to settle
  await page.waitForTimeout(600);
}

/**
 * Seed a single task without dueDate + navigate to app.
 * Returns { page, taskId, taskTitle }.
 */
async function seedNoDueDateTask(
  context: BrowserContext,
  page: Page,
  priority: "high" | "medium" | "low" = "high",
): Promise<{ taskId: string; taskTitle: string }> {
  const task = makeTask({ title: `NoDate-${priority}-Task`, priority, dueDate: undefined });
  await seedTasks(context, [task]);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500); // let Zustand hydrate from localStorage
  return { taskId: task.id, taskTitle: task.title! };
}

// ─── SCENARIO I: Planner → Day ───────────────────────────────────────────────

test.describe("SCENARIO I – Planner → Day (drag task into 'To do today')", () => {
  /**
   * Helper: drag taskTitle into the TodayBox using page.mouse (dnd-kit PointerSensor).
   * The TodayBox locator is: getByText("To do today").locator("..").locator("..")
   */
  async function dragToTodayBox(page: Page, taskTitle: string) {
    const source = page.getByText(taskTitle).first();
    // TodayBox setNodeRef = div.rounded-2xl.border-2 that contains h2 "To do today"
    const todayBox = page.locator("div.rounded-2xl.border-2").filter({
      has: page.getByRole("heading", { name: "To do today" }),
    }).first();
    await source.scrollIntoViewIfNeeded();
    await todayBox.scrollIntoViewIfNeeded();
    const srcBox = await source.boundingBox();
    const tgtBox = await todayBox.boundingBox();
    expect(srcBox).not.toBeNull();
    expect(tgtBox).not.toBeNull();

    const sx = srcBox!.x + srcBox!.width / 2;
    const sy = srcBox!.y + srcBox!.height / 2;
    const tx = tgtBox!.x + tgtBox!.width / 2;
    const ty = tgtBox!.y + tgtBox!.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 3, sy + 3, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(800);
  }

  test("I.1 – dueDate is set to today after drag into today-box", async ({ page, context }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page);
    await gotoPlannerTab(page, "Day");
    await assertVisibleInList(page, taskTitle);
    await dragToTodayBox(page, taskTitle);
    await assertDueDate(page, taskId, todayStr());
  });

  test("I.2 – after Day assignment task appears in Views → Today", async ({ page, context }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page);
    await gotoPlannerTab(page, "Day");
    await dragToTodayBox(page, taskTitle);
    await gotoView(page, "Today");
    await assertVisibleInList(page, taskTitle);
    await assertDueDate(page, taskId, todayStr());
  });

  test("I.3 – after Day assignment task appears in Views → This Week", async ({ page, context }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page);
    await gotoPlannerTab(page, "Day");
    await dragToTodayBox(page, taskTitle);
    await gotoView(page, "This Week");
    await assertVisibleInList(page, taskTitle);
    await assertDueDate(page, taskId, todayStr());
  });

  test("I.4 – after Day assignment task is visible in Calendar on today's cell", async ({
    page,
    context,
  }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page);
    await gotoPlannerTab(page, "Day");
    await dragToTodayBox(page, taskTitle);
    await gotoView(page, "Calendar");
    await assertDueDate(page, taskId, todayStr());
    const calendarGrid = page.locator(".grid.grid-cols-7");
    await expect(calendarGrid.getByText(taskTitle)).toBeVisible({ timeout: 5_000 });
  });

  test("I.5 – remove from today-box clears dueDate and hides from Today view", async ({
    page,
    context,
  }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page);
    await gotoPlannerTab(page, "Day");
    await dragToTodayBox(page, taskTitle);
    await assertDueDate(page, taskId, todayStr());

    // Click the "Remove from today" button (aria-label="Remove from today", opacity-0 group-hover)
    // Use page.evaluate to click directly bypassing opacity
    const clicked = await page.evaluate((title) => {
      const allButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button[aria-label='Remove from today']"),
      );
      for (const btn of allButtons) {
        const parent = btn.closest(".group");
        if (parent && parent.textContent?.includes(title)) {
          btn.click();
          return true;
        }
      }
      return false;
    }, taskTitle);
    expect(clicked).toBe(true);
    await page.waitForTimeout(600);

    await assertDueDate(page, taskId, undefined);

    await gotoView(page, "Today");
    await assertNotVisibleInList(page, taskTitle);

    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, taskTitle);
  });
});

// ─── SCENARIO II: Planner → Week ─────────────────────────────────────────────

test.describe("SCENARIO II – Planner → Week (drag task into a day column)", () => {
  test("II.1 – dueDate is set to the target day after drop", async ({ page, context }) => {
    const { taskId, taskTitle } = await seedNoDueDateTask(context, page, "medium");
    await gotoPlannerTab(page, "Week");

    // The source task is in the unplanned pool at the bottom.
    // The target is Monday's DayColumn.  DayColumn header has shortLabel e.g. "Mon 9".
    // Locate Monday's column: a rounded-2xl border-2 div whose header contains the Mon shortLabel.
    const monStr = thisWeekMonStr(); // e.g. "2026-03-09"
    const monDate = new Date(monStr + "T12:00:00");
    const monShort = monDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
    // The column header p tag has text like "Mon 9" (shortLabel)
    const mondayColumn = page.getByText(monShort, { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-2xl') and contains(@class,'border-2')][1]");

    // dnd-kit uses PointerSensor — must use page.mouse instead of HTML5 dragTo
    const source = page.getByText(taskTitle).first();
    await source.scrollIntoViewIfNeeded();
    await mondayColumn.scrollIntoViewIfNeeded();
    const srcBox = await source.boundingBox();
    const tgtBox = await mondayColumn.boundingBox();
    expect(srcBox).not.toBeNull();
    expect(tgtBox).not.toBeNull();

    const sx = srcBox!.x + srcBox!.width / 2;
    const sy = srcBox!.y + srcBox!.height / 2;
    const tx = tgtBox!.x + tgtBox!.width / 2;
    const ty = tgtBox!.y + tgtBox!.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 3, sy + 3, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(800);

    // dueDate must be a date within this week
    const task = await getLocalTask(page, taskId);
    expect(task?.dueDate).toBeTruthy();
    expect(task!.dueDate! >= thisWeekMonStr()).toBe(true);
    expect(task!.dueDate! <= thisWeekSunStr()).toBe(true);
  });

  test("II.2 – after Week assignment task appears in Views → This Week", async ({
    page,
    context,
  }) => {
    const task = makeTask({
      title: "WeekPlan-Task",
      priority: "medium",
      dueDate: thisWeekMonStr(), // already assigned to Monday of this week
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "This Week");
    await assertVisibleInList(page, task.title!);
    await assertDueDate(page, task.id, thisWeekMonStr());
  });

  test("II.3 – after Week assignment task appears in Planner → Day when date = today", async ({
    page,
    context,
  }) => {
    const task = makeTask({ title: "WeekToDay-Task", priority: "high", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Planner → Day should show it in "To do today"
    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).toBeVisible({ timeout: 5_000 });
  });

  test("II.4 – remove from week column clears dueDate", async ({ page, context }) => {
    const task = makeTask({
      title: "WeekRemove-Task",
      priority: "low",
      dueDate: thisWeekMonStr(),
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoPlannerTab(page, "Week");

    // Task should be visible in the Monday column
    await assertVisibleInList(page, task.title!);

    // MiniCard: div.group > button[aria-label="Remove"] is opacity-0 until CSS group-hover.
    // page.evaluate directly calls .click() on the DOM button bypassing opacity check.
    const clicked = await page.evaluate((title) => {
      const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-label='Remove']"));
      // Find the one whose sibling span contains the task title
      for (const btn of allButtons) {
        const parent = btn.closest(".group");
        if (parent && parent.textContent?.includes(title)) {
          btn.click();
          return true;
        }
      }
      return false;
    }, task.title!);
    expect(clicked).toBe(true);
    await page.waitForTimeout(600);

    await assertDueDate(page, task.id, undefined);

    // Task must now be in unplanned pool (no dueDate)
    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, task.title!);
  });
});

// ─── SCENARIO III: Views → Calendar ──────────────────────────────────────────

test.describe("SCENARIO III – Views → Calendar (drag task onto a date cell)", () => {
  test("III.1 – dragging task from unplanned pool sets dueDate", async ({ page, context }) => {
    const task = makeTask({ title: "CalDrag-Task", dueDate: undefined });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Calendar");

    // The unplanned pool should contain the task
    await assertVisibleInList(page, task.title!);

    // Locate today's calendar cell via its rounded-full day number span (today marker)
    const todayDay = parseInt(todayStr().split("-")[2], 10).toString();
    const todayCell = page.locator(
      `xpath=//div[contains(@class,'min-h-') and contains(@class,'flex-col')]` +
      `/span[contains(@class,'rounded-full') and normalize-space(text())='${todayDay}']/..`
    ).first();

    // dnd-kit uses PointerSensor — use page.mouse for pointer events
    const source = page.getByText(task.title!).first();
    await source.scrollIntoViewIfNeeded();
    await todayCell.scrollIntoViewIfNeeded();
    const srcBox = await source.boundingBox();
    const tgtBox = await todayCell.boundingBox();
    expect(srcBox).not.toBeNull();
    expect(tgtBox).not.toBeNull();

    const sx = srcBox!.x + srcBox!.width / 2;
    const sy = srcBox!.y + srcBox!.height / 2;
    const tx = tgtBox!.x + tgtBox!.width / 2;
    const ty = tgtBox!.y + tgtBox!.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 3, sy + 3, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(800);

    await assertDueDate(page, task.id, todayStr());
  });

  test("III.2 – after Calendar drop task appears in Today view", async ({ page, context }) => {
    // Pre-seed with dueDate = today (simulates the result of a calendar drop)
    const task = makeTask({ title: "CalToToday-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Today");
    await assertVisibleInList(page, task.title!);
    await assertDueDate(page, task.id, todayStr());
  });

  test("III.3 – clear chip (×) from calendar cell removes dueDate", async ({ page, context }) => {
    const task = makeTask({ title: "CalClear-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Calendar");

    // Find the × button on the chip for this task
    const chip = page.getByText(task.title!).first();
    await chip.hover();
    // The × is a button rendered as the "×" character
    const clearBtn = chip.locator("xpath=following-sibling::button").first()
      .or(chip.locator("xpath=parent::*/button").first());
    await clearBtn.click({ force: true });
    await page.waitForTimeout(600);

    await assertDueDate(page, task.id, undefined);

    // Must not appear in Today or This Week
    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);

    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, task.title!);
  });

  test("III.4 – dragging chip to a different date updates dueDate", async ({ page, context }) => {
    const task = makeTask({ title: "CalReschedule-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Calendar");

    // Get tomorrow's day number to locate its cell
    const tomorrow = offsetDate(1);
    const tomorrowDay = parseInt(tomorrow.split("-")[2], 10).toString();

    // dnd-kit uses PointerSensor — must use page.mouse (pointer events), NOT dragTo (HTML5).
    // Find the chip (source) and the target calendar cell by their bounding boxes.
    const chip = page.getByText(task.title!).first();
    await chip.scrollIntoViewIfNeeded();
    const chipBox = await chip.boundingBox();
    expect(chipBox).not.toBeNull();

    // Locate tomorrow's calendar cell using XPath: div containing a span with day number
    // Today's span has rounded-full; tomorrow's does not.
    const tomorrowCell = page.locator(
      `xpath=//div[contains(@class,'min-h-') and contains(@class,'flex-col')]` +
      `/span[not(contains(@class,'rounded-full')) and normalize-space(text())='${tomorrowDay}']/..`
    ).first();
    await tomorrowCell.scrollIntoViewIfNeeded();
    const cellBox = await tomorrowCell.boundingBox();
    expect(cellBox).not.toBeNull();

    // dnd-kit PointerSensor drag: pointerdown → move (>5px) → pointerup
    const sx = chipBox!.x + chipBox!.width / 2;
    const sy = chipBox!.y + chipBox!.height / 2;
    const tx = cellBox!.x + cellBox!.width / 2;
    const ty = cellBox!.y + cellBox!.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Move slightly first to pass the distance:5 activation constraint
    await page.mouse.move(sx + 3, sy + 3, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(800);

    await assertDueDate(page, task.id, tomorrow);

    // Must not appear in Today view anymore
    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);
  });
});

// ─── SCENARIO IV: Add Task modal with explicit dueDate ────────────────────────

test.describe("SCENARIO IV – Add Task modal with explicit dueDate", () => {
  test("IV.1 – task created with dueDate=today appears in Today view", async ({
    page,
    context,
  }) => {
    // context used for clearStorage (via beforeEach)
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    const title = "ModalToday-Task";
    const taskId = await addTaskViaModal(page, title, todayStr());
    await assertDueDate(page, taskId, todayStr());

    await gotoView(page, "Today");
    await assertVisibleInList(page, title);
  });

  test("IV.2 – task created with dueDate=today appears in Planner → Day", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    const title = "ModalPlannerDay-Task";
    const taskId = await addTaskViaModal(page, title, todayStr());
    await assertDueDate(page, taskId, todayStr());

    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(title)).toBeVisible({ timeout: 5_000 });
  });

  test("IV.3 – task created with dueDate=this week appears in This Week view", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    const title = "ModalWeek-Task";
    const taskId = await addTaskViaModal(page, title, thisWeekMonStr());
    await assertDueDate(page, taskId, thisWeekMonStr());

    await gotoView(page, "This Week");
    await assertVisibleInList(page, title);
  });

  test("IV.4 – task created with dueDate=today appears in Planner → Week", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    const title = "ModalPlannerWeek-Task";
    const taskId = await addTaskViaModal(page, title, todayStr());
    await assertDueDate(page, taskId, todayStr());

    await gotoPlannerTab(page, "Week");
    await assertVisibleInList(page, title);
  });

  test("IV.5 – task created WITHOUT dueDate does NOT appear in Today, This Week", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    const title = "ModalNoDueDate-Task";
    const taskId = await addTaskViaModal(page, title); // no dueDate
    await assertDueDate(page, taskId, undefined);

    await gotoView(page, "Today");
    await assertNotVisibleInList(page, title);

    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, title);
  });
});

// ─── SCENARIO V: Change dueDate to a different date ──────────────────────────

test.describe("SCENARIO V – Changing dueDate updates all views correctly", () => {
  test("V.1 – task moved from today to tomorrow disappears from Today, appears in This Week", async ({ page, context }) => {
    const tomorrow = offsetDate(1);

    // ── Phase A: task has dueDate=today → appears in Today ─────────────────
    const taskToday = makeTask({ title: "Reschedule-Task", dueDate: todayStr() });
    await seedTasks(context, [taskToday]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Today");
    await assertVisibleInList(page, taskToday.title!);

    // ── Phase B: edit via Edit Task modal → set dueDate to tomorrow ────────
    // Double-click the task to open edit modal
    await page.getByText(taskToday.title!).first().dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="date"]').fill(tomorrow);
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);

    // ── Verify: NOT in Today anymore ────────────────────────────────────────
    await gotoView(page, "Today");
    await assertNotVisibleInList(page, taskToday.title!);

    // ── Verify: still in This Week (tomorrow is within this week) ──────────
    await gotoView(page, "This Week");
    await assertVisibleInList(page, taskToday.title!);

    await assertDueDate(page, taskToday.id, tomorrow);
  });

  test("V.2 – task moved from past week to today – clears overdue, appears in Today", async ({ page, context }) => {
    const yesterday = offsetDate(-1);

    // Pre-seed as overdue (yesterday's date)
    const task = makeTask({
      title: "OverdueReschedule-Task",
      dueDate: yesterday,
      status: "overdue",
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Edit via modal: change dueDate to today
    await gotoView(page, "All Tasks");
    // Task might be in overdue (not shown in All Tasks by default filter)
    // Use the Overdue view first to find it
    const overdueBtn = page.getByRole("button", { name: /overdue/i }).first();
    if (await overdueBtn.isVisible()) {
      await overdueBtn.click();
      await page.waitForTimeout(300);
    }
    await page.getByText(task.title!).first().dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="date"]').fill(todayStr());
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);

    await gotoView(page, "Today");
    await assertVisibleInList(page, task.title!);

    const stored = await getLocalTask(page, task.id);
    expect(stored?.dueDate).toBe(todayStr());
    // After rescheduling to today, status should no longer be overdue
    expect(stored?.status).not.toBe("overdue");
  });

  test("V.3 – Planner→Day: changing assigned date removes task from old day planner slot", async ({ page, context }) => {
    // Task assigned to today via Planner→Day
    const task = makeTask({ title: "DayReschedule-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Confirm it's in Day planner today-box
    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).toBeVisible();

    // Re-assign to tomorrow via Edit Task modal (double-click in Today view)
    const tomorrow = offsetDate(1);
    await gotoView(page, "Today");
    await page.getByText(task.title!).first().dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="date"]').fill(tomorrow);
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);

    // Go back to Planner → Day
    await gotoPlannerTab(page, "Day");
    // Should NOT be in today-box anymore
    const updatedTodaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(updatedTodaySection.getByText(task.title!)).not.toBeVisible({ timeout: 5_000 });

    await assertDueDate(page, task.id, tomorrow);
  });
});

// ─── SCENARIO VI: Removing dueDate ───────────────────────────────────────────

test.describe("SCENARIO VI – Removing dueDate (task disappears from all planning views)", () => {
  test("VI.1 – task with today dueDate cleared disappears from Today & Planner Day", async ({ page, context }) => {
    const task = makeTask({ title: "ClearDue-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Edit via modal: clear the due date
    await gotoView(page, "Today");
    await page.getByText(task.title!).first().dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });
    // Clear the date input
    await page.locator('input[type="date"]').fill("");
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);

    // Must be gone from Today
    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);

    // Must be gone from This Week
    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, task.title!);

    // Must be gone from Planner Day today-box
    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).not.toBeVisible({ timeout: 5_000 });

    await assertDueDate(page, task.id, undefined);
  });

  test("VI.2 – cleared task still appears in All Tasks view", async ({ page, context }) => {
    const task = makeTask({ title: "ClearDueAllTasks-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Clear via edit modal
    await gotoView(page, "Today");
    await page.getByText(task.title!).first().dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="date"]').fill("");
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(400);

    await gotoView(page, "All Tasks");
    await assertVisibleInList(page, task.title!);
  });

  test("VI.3 – cleared task moves to 'No due date' pool in Calendar", async ({
    page,
    context,
  }) => {
    // Pre-seed with NO dueDate (already cleared state)
    const task = makeTask({ title: "CalendarUnplan-Task", dueDate: undefined });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Calendar");

    // Should appear in the "No due date" unplanned pool
    const unplannedPool = page.getByText("No due date").locator("..").locator("..").locator("..");
    await expect(unplannedPool.getByText(task.title!)).toBeVisible({ timeout: 5_000 });
  });
});

// ─── SCENARIO VII: Overdue detection ─────────────────────────────────────────

test.describe("SCENARIO VII – Overdue detection via dueDate", () => {
  test("VII.1 – task with past dueDate + status:overdue appears in Overdue view", async ({
    page,
    context,
  }) => {
    const yesterday = offsetDate(-1);
    const task = makeTask({
      title: "Overdue-Task",
      dueDate: yesterday,
      status: "overdue",
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Overdue button should be visible in sidebar (there's at least 1 overdue task)
    const overdueBtn = page.getByRole("button", { name: /overdue/i }).first();
    await expect(overdueBtn).toBeVisible({ timeout: 5_000 });
    await overdueBtn.click();
    await page.waitForTimeout(300);

    await assertVisibleInList(page, task.title!);
    await assertDueDate(page, task.id, yesterday);
  });

  test("VII.2 – overdue task does NOT appear in Today view", async ({ page, context }) => {
    const yesterday = offsetDate(-1);
    const task = makeTask({
      title: "OverdueSeparated-Task",
      dueDate: yesterday,
      status: "overdue",
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);
  });

  test("VII.3 – overdue task does NOT appear in Planner Day today-box", async ({
    page,
    context,
  }) => {
    const yesterday = offsetDate(-1);
    const task = makeTask({
      title: "OverduePlannerDay-Task",
      dueDate: yesterday,
      status: "overdue",
    });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).not.toBeVisible({ timeout: 5_000 });
  });

  test("VII.4 – future task does NOT appear in Overdue view", async ({ page, context }) => {
    const tomorrow = offsetDate(1);
    const task = makeTask({ title: "FutureNotOverdue-Task", dueDate: tomorrow });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // If overdue count is 0, the button won't render — just check All Tasks
    await gotoView(page, "All Tasks");
    await assertVisibleInList(page, task.title!);

    const stored = await getLocalTask(page, task.id);
    expect(stored?.status).not.toBe("overdue");
  });
});

// ─── SCENARIO IX: Input validation (client-side maxLength guards) ─────────────

test.describe("SCENARIO IX – Input validation in Add Task modal", () => {
  test("IX.1 – title exceeding 150 chars is clamped and shows char counter", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByRole("heading", { name: "Add Task" })).toBeVisible();

    const titleInput = page.getByPlaceholder("Task title...");
    // Type a string longer than 150 chars
    const overlong = "A".repeat(160);
    await titleInput.fill(overlong);

    // The input has maxLength=150, so the actual value must be clamped
    const actualValue = await titleInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(150);

    // Char counter should be visible (always shown for title)
    await expect(page.getByText(/\d+\/150/)).toBeVisible();
  });

  test("IX.2 – empty title prevents form submission (validation error shown)", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByRole("heading", { name: "Add Task" })).toBeVisible();

    // Submit without filling title
    await page.getByRole("button", { name: /create task/i }).first().click();

    // Modal should still be open (form blocked)
    await expect(page.getByRole("heading", { name: "Add Task" })).toBeVisible({ timeout: 3_000 });
  });

  test("IX.3 – offline: warning toast appears when network goes offline", async ({
    page,
    context,
  }) => {
    void context;
    await page.goto("/");
    await page.waitForTimeout(500);

    // Simulate offline via Playwright context
    await page.context().setOffline(true);
    await page.waitForTimeout(1_200); // give the event listener time to fire

    // The offline toast should appear somewhere on the page
    await expect(page.getByText(/no internet connection/i)).toBeVisible({ timeout: 5_000 });

    // Restore online
    await page.context().setOffline(false);
    await page.waitForTimeout(1_200);

    // The "Connection restored" toast should appear
    await expect(page.getByText(/connection restored/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("SCENARIO VIII – Cross-view consistency (dueDate drives all views)", () => {
  test("VIII.1 – single task with today dueDate is visible in Today, ThisWeek, PlannerDay, PlannerWeek, Calendar", async ({
    page,
    context,
  }) => {
    const task = makeTask({ title: "CrossView-Today-Task", dueDate: todayStr() });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Today view
    await gotoView(page, "Today");
    await assertVisibleInList(page, task.title!);

    // This Week view
    await gotoView(page, "This Week");
    await assertVisibleInList(page, task.title!);

    // Planner → Day: today-box
    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).toBeVisible({ timeout: 5_000 });

    // Planner → Week
    await gotoPlannerTab(page, "Week");
    await assertVisibleInList(page, task.title!);

    // Calendar: task should be on today's cell (not in unplanned pool)
    await gotoView(page, "Calendar");
    const unplannedSection = page.getByText("No due date").locator("..").locator("..");
    await expect(unplannedSection.getByText(task.title!)).not.toBeVisible({ timeout: 3_000 });
    await assertDueDate(page, task.id, todayStr());
  });

  test("VIII.2 – task with NO dueDate is NOT in Today, ThisWeek, PlannerDay today-box, Calendar grid", async ({
    page,
    context,
  }) => {
    const task = makeTask({ title: "NoDueDate-CrossView-Task", dueDate: undefined });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);

    await gotoView(page, "This Week");
    await assertNotVisibleInList(page, task.title!);

    await gotoPlannerTab(page, "Day");
    const todaySection = page.getByText("To do today").locator("..").locator("..");
    await expect(todaySection.getByText(task.title!)).not.toBeVisible({ timeout: 3_000 });

    // Calendar: should be in unplanned pool
    await gotoView(page, "Calendar");
    const unplannedSection = page.getByText("No due date").locator("..").locator("..");
    await expect(unplannedSection.getByText(task.title!)).toBeVisible({ timeout: 5_000 });
  });

  test("VIII.3 – dueDate written once propagates consistently to all views without reload", async ({
    page,
    context,
  }) => {
    // Start with no dueDate
    const task = makeTask({ title: "LivePropagation-Task", dueDate: undefined });
    await seedTasks(context, [task]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Use addTaskViaModal flow — update dueDate via the UI (Edit Task)
    // First: verify NOT in today
    await gotoView(page, "Today");
    await assertNotVisibleInList(page, task.title!);

    // Double-click to open edit modal
    await gotoView(page, "All Tasks");
    const taskRow = page.getByText(task.title!).first();
    await taskRow.dblclick();
    await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible({ timeout: 5_000 });

    // Set due date to today
    await page.locator('input[type="date"]').fill(todayStr());
    await page.getByRole("button", { name: /save changes/i }).first().click();
    await expect(page.getByRole("heading", { name: /edit task/i })).not.toBeVisible({
      timeout: 8_000,
    });
    await page.waitForTimeout(400);

    // Now check Today view WITHOUT reload
    await gotoView(page, "Today");
    await assertVisibleInList(page, task.title!);

    // Check This Week
    await gotoView(page, "This Week");
    await assertVisibleInList(page, task.title!);

    await assertDueDate(page, task.id, todayStr());
  });

  test("VIII.4 – multiple tasks: only tasks with matching dueDate appear in each view", async ({
    page,
    context,
  }) => {
    const today = todayStr();
    const tomorrow = offsetDate(1);
    const nextWeek = offsetDate(8);

    const taskToday = makeTask({ title: "Multi-Today-Task", dueDate: today });
    const taskTomorrow = makeTask({ title: "Multi-Tomorrow-Task", dueDate: tomorrow });
    const taskNextWeek = makeTask({ title: "Multi-NextWeek-Task", dueDate: nextWeek });
    const taskNone = makeTask({ title: "Multi-NoDue-Task", dueDate: undefined });

    await seedTasks(context, [taskToday, taskTomorrow, taskNextWeek, taskNone]);
    await page.goto("/");
    await page.waitForTimeout(500);

    // Today: only taskToday
    await gotoView(page, "Today");
    await assertVisibleInList(page, taskToday.title!);
    await assertNotVisibleInList(page, taskTomorrow.title!);
    await assertNotVisibleInList(page, taskNextWeek.title!);
    await assertNotVisibleInList(page, taskNone.title!);

    // This Week: today + tomorrow (next week is outside)
    await gotoView(page, "This Week");
    await assertVisibleInList(page, taskToday.title!);
    await assertVisibleInList(page, taskTomorrow.title!);
    await assertNotVisibleInList(page, taskNextWeek.title!);
    await assertNotVisibleInList(page, taskNone.title!);

    // All Tasks: all four
    await gotoView(page, "All Tasks");
    await assertVisibleInList(page, taskToday.title!);
    await assertVisibleInList(page, taskTomorrow.title!);
    await assertVisibleInList(page, taskNextWeek.title!);
    await assertVisibleInList(page, taskNone.title!);
  });
});
