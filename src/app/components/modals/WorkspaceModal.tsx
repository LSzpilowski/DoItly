import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { CATEGORY_COLORS } from "@/store/types";
import type { Workspace } from "@/store/types";

const MAX_WORKSPACES = 3;

interface EditRowProps {
  ws: Workspace;
  isActive: boolean;
  onRename: (name: string, color: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const WorkspaceRow = ({ ws, isActive, onRename, onRemove, canRemove }: EditRowProps) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(ws.name);
  const [editColor, setEditColor] = useState(ws.color);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ws.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(ws.name);
    setEditColor(ws.color);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitEdit = () => {
    const trimmed = editName.trim();
    if (trimmed) onRename(trimmed, editColor);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditName(ws.name);
    setEditColor(ws.color);
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") cancelEdit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
        isActive ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="p-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing transition-opacity flex-shrink-0"
        tabIndex={-1}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      {editing ? (
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={30}
            className="w-full px-2 py-1 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_COLORS.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className={`w-5 h-5 rounded-full ${c} transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105"}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={commitEdit} disabled={!editName.trim()}
              className="flex-1 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
              Save
            </button>
            <button type="button" onClick={cancelEdit}
              className="flex-1 py-1 text-xs font-medium rounded-lg border border-border hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="flex-1 flex items-center gap-2.5 text-left min-w-0"
            onDoubleClick={startEdit} title="Double-click to rename">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${ws.color}`} />
            <span className="text-sm font-medium truncate">{ws.name}</span>
            {isActive && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                Active
              </span>
            )}
          </button>
          <button type="button" onClick={startEdit}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded hover:bg-accent text-muted-foreground transition-all"
            aria-label="Rename workspace">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {canRemove && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              aria-label="Remove workspace">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
};

export const WorkspaceModal = () => {
  const { modals, closeAllModals } = useUIStore();
  const { workspaces, activeWorkspaceId, addWorkspace, removeWorkspace, renameWorkspace, setActiveWorkspace, reorderWorkspaces } = useWorkspaceStore();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(CATEGORY_COLORS[0]);
  const [showForm, setShowForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useBodyScrollLock(modals.workspace);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = workspaces.findIndex((w) => w.id === active.id);
    const newIdx = workspaces.findIndex((w) => w.id === over.id);
    reorderWorkspaces(arrayMove(workspaces, oldIdx, newIdx));
  };

  if (!modals.workspace) return null;

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed || workspaces.length >= MAX_WORKSPACES) return;
    addWorkspace(trimmed, newColor);
    setNewName("");
    setNewColor(CATEGORY_COLORS[0]);
    setShowForm(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={closeAllModals} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Workspaces and Teams"
        >

          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2.5 text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-lg font-bold">Workspaces & Teams</h3>
            </div>
            <button onClick={closeAllModals}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground hover:cursor-pointer"
              aria-label="Close workspaces and teams">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Workspaces</h4>
              <p className="text-xs text-muted-foreground -mt-1">Double-click a workspace to rename or change its color. Drag to reorder. Switch the active workspace from the header.</p>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={workspaces.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {workspaces.map((ws) => (
                      <WorkspaceRow key={ws.id} ws={ws}
                        isActive={activeWorkspaceId === ws.id}
                        onRename={(name, color) => renameWorkspace(ws.id, name, color)}
                        onRemove={() => removeWorkspace(ws.id)}
                        canRemove={workspaces.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {showForm ? (
                <div className="space-y-3 pt-1">
                  <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
                    placeholder="Workspace name…" maxLength={30}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {CATEGORY_COLORS.slice(0, 8).map((c) => (
                      <button key={c} type="button" onClick={() => setNewColor(c)}
                        className={`w-6 h-6 rounded-full ${c} transition-transform ${newColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCreate} disabled={!newName.trim()}
                      className="flex-1 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity">
                      Create
                    </button>
                    <button onClick={() => { setShowForm(false); setNewName(""); }}
                      className="flex-1 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowForm(true)} disabled={workspaces.length >= MAX_WORKSPACES}
                  className="w-full py-2.5 text-sm font-medium rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  + New Workspace
                  {workspaces.length >= MAX_WORKSPACES && <span className="ml-2 text-xs">(limit {MAX_WORKSPACES}/{MAX_WORKSPACES})</span>}
                </button>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Team Members</h4>
              <p className="text-xs text-muted-foreground">Team collaboration coming soon.</p>
              <div className="flex gap-2">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@email.com"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button disabled className="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 opacity-50 cursor-not-allowed">
                  Invite
                </button>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Shared Lists</h4>
              <p className="text-xs text-muted-foreground">Share a public read-only link to your task list — coming soon.</p>
              <button disabled className="w-full py-2.5 text-sm font-medium rounded-xl border border-dashed border-border text-muted-foreground opacity-50 cursor-not-allowed">
                + Share List
              </button>
            </section>

          </div>
        </div>
      </div>
    </>
  );
};
