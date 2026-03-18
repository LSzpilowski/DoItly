import { useState } from "react";
import { CATEGORY_COLORS } from "@/store/types";

interface RenameModalProps {
  open: boolean;
  title: string;           // e.g. "Rename Workspace" or "Rename Category"
  initialName: string;
  initialColor: string;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}

// Inner component — rendered only when open=true, so state always matches initial props
const RenameModalInner = ({
  title,
  initialName,
  initialColor,
  onSave,
  onClose,
}: Omit<RenameModalProps, "open">) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-[340px] rounded-2xl border border-border bg-background shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>

        {/* Name input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onClose();
            }}
            maxLength={30}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            placeholder="Enter name…"
          />
        </div>

        {/* Color picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full flex-shrink-0 transition-all cursor-pointer ${c} ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                    : "hover:scale-105 opacity-80 hover:opacity-100"
                }`}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-accent/40">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
          <span className="text-sm font-medium text-foreground truncate">
            {name || <span className="text-muted-foreground/60 italic">Preview</span>}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium rounded-xl border border-border hover:bg-accent transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export const RenameModal = ({ open, ...rest }: RenameModalProps) => {
  if (!open) return null;
  // Keyed by initialName+initialColor so state resets whenever target changes
  return <RenameModalInner key={`${rest.initialName}__${rest.initialColor}`} {...rest} />;
};
