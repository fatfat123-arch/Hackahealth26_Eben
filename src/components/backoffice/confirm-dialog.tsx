import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";

type Req = { message: string; resolve: (ok: boolean) => void };
let push: ((r: Req) => void) | null = null;

/** Opens the shared delete confirmation and resolves with the user's choice. */
export function askConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => { if (push) push({ message, resolve }); else resolve(window.confirm(message)); });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { push = setReq; return () => { push = null; }; }, []);
  const close = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  return <AlertDialog.Root open={!!req} onOpenChange={o => { if (!o) close(false); }}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="bo-overlay" />
      <AlertDialog.Content className="bo-dialog">
        <Mascot pose="inquiete" size={104} />
        <AlertDialog.Title className="bo-dialog-title">Voulez-vous vraiment supprimer ?</AlertDialog.Title>
        <AlertDialog.Description className="bo-dialog-text">{req?.message}</AlertDialog.Description>
        <div className="bo-dialog-actions">
          <AlertDialog.Cancel className="bo-btn bo-btn-outline">Non, garder</AlertDialog.Cancel>
          <AlertDialog.Action className="bo-btn bo-btn-danger" onClick={() => close(true)}>Oui, supprimer</AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
