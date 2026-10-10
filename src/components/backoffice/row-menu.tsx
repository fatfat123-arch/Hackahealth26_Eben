import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";

export type RowAction = { label: string; onSelect: () => void; danger?: boolean };

export function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  if (!actions.length) return null;
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger className="bo-menu-btn" aria-label={`Actions pour ${label}`}><MoreVertical aria-hidden="true" /></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="bo-menu" align="end" sideOffset={6}>
        {actions.map(a => <DropdownMenu.Item key={a.label} className={`bo-menu-item${a.danger ? " is-danger" : ""}`} onSelect={a.onSelect}>{a.label}</DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

export const CONFIRM_DELETE = "Êtes-vous sûr ? Cette action est définitive.";
