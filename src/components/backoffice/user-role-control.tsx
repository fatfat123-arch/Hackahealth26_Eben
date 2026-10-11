import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useId, useRef, useState, type FormEvent } from "react";
import { changeCaregiverRole } from "@/lib/caregivers.functions";
import type { UserRole } from "@/lib/user-role-input";

type RoleUser = { id: string; full_name: string; role: UserRole; archived_at: string | null };
const mutationKey = ["user-role-change"];

export function UserRoleControl({
  user,
  actorId,
  isAdmin,
}: {
  user: RoleUser;
  actorId: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const change = useServerFn(changeCaregiverRole);
  const mutation = useMutation({
    mutationKey,
    mutationFn: (input: Parameters<typeof change>[0]) => change(input),
  });
  const activeChanges = useIsMutating({ mutationKey });
  const submitting = useRef(false);
  const switchRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const [requestedRole, setRequestedRole] = useState<UserRole | null>(null);
  const [expectedRole, setExpectedRole] = useState<UserRole>(user.role);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const promoting = requestedRole === "admin";
  const firstName = user.full_name.trim().split(/\s+/)[0];
  const busy = mutation.isPending;
  function close() {
    if (submitting.current) return;
    setRequestedRole(null);
  }
  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!requestedRole || submitting.current || activeChanges) return;
    submitting.current = true;
    setError("");
    setMessage("");
    try {
      const result = await mutation.mutateAsync({
        data: { id: user.id, role: requestedRole, expectedRole },
      });
      // Cache updates are applied only after the server has committed its transaction.
      qc.setQueryData<RoleUser[]>(["caregivers"], (users) =>
        users?.map((item) =>
          item.id === user.id
            ? { ...item, role: result.role, isAdmin: result.role === "admin" }
            : item,
        ),
      );
      qc.setQueryData<{ profile: RoleUser | null }>(["caregiver", user.id], (data) =>
        data?.profile ? { ...data, profile: { ...data.profile, role: result.role } } : data,
      );
      setMessage(
        `${user.full_name} est maintenant ${result.role === "admin" ? "administrateur" : "accompagnant"}.`,
      );
      setRequestedRole(null);
    } catch (e) {
      setError(
        e instanceof Error && /^(Accès|Votre|Trop|Le |Vous |Ce |Il |La |Les )/.test(e.message)
          ? e.message
          : "Le changement de rôle n’a pas pu être confirmé. Actualisez la page avant de réessayer.",
      );
    } finally {
      submitting.current = false;
      // Restore the actual saved state, including when another administrator changed it.
      void qc.invalidateQueries({ queryKey: ["caregivers"] });
      void qc.invalidateQueries({ queryKey: ["caregiver", user.id] });
    }
  }
  if (!isAdmin || user.archived_at || actorId === user.id) return null;
  return (
    <div className="bo-role-control">
      <div className="bo-role-toggle-row">
        <div>
          <span id={labelId} className="bo-role-label">
            Droits administrateur
          </span>
          <span className="bo-hint bo-role-current">
            {user.role === "admin" ? "Administrateur" : "Accompagnant"}
          </span>
        </div>
        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={user.role === "admin"}
          aria-labelledby={labelId}
          className="bo-role-switch"
          disabled={activeChanges > 0}
          onClick={() => {
            setExpectedRole(user.role);
            setRequestedRole(user.role === "admin" ? "caregiver" : "admin");
            setError("");
            setMessage("");
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {message && (
        <p className="bo-success" role="status">
          {message}
        </p>
      )}
      {error && !requestedRole && (
        <p className="bo-error" role="alert">
          {error}
        </p>
      )}
      <AlertDialog.Root
        open={requestedRole !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="bo-overlay" />
          <AlertDialog.Content
            className="bo-dialog bo-role-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              switchRef.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <AlertDialog.Title className="bo-dialog-title">
              {promoting ? "Confirmer la promotion" : "Confirmer la rétrogradation"}
            </AlertDialog.Title>
            <AlertDialog.Description className="bo-dialog-text">
              <span>
                Voulez-vous{" "}
                {promoting
                  ? "attribuer les droits administrateur à"
                  : "retirer les droits administrateur de"}{" "}
                {firstName} ?
              </span>
            </AlertDialog.Description>
            <form onSubmit={confirm} className="bo-role-confirm-form">
              {error && (
                <p className="bo-error" role="alert">
                  {error}
                </p>
              )}
              <div className="bo-dialog-actions">
                <AlertDialog.Cancel type="button" className="bo-btn bo-btn-outline" disabled={busy}>
                  Annuler
                </AlertDialog.Cancel>
                <button
                  type="submit"
                  className="bo-btn bo-btn-primary"
                  disabled={busy || activeChanges > 0}
                >
                  {busy ? "Modification…" : "Confirmer"}
                </button>
              </div>
            </form>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
