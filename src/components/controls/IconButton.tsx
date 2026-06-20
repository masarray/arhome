import type { LucideIcon } from "lucide-react";

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

export function IconButton({ icon: Icon, label, active = false, compact = false, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${active ? "is-active" : ""} ${compact ? "is-compact" : ""}`}
      type="button"
      onClick={onClick}
    >
      <Icon size={compact ? 16 : 18} strokeWidth={2.2} />
    </button>
  );
}
