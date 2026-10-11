import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserRoleControl } from "@/components/backoffice/user-role-control";
import { changeCaregiverRole } from "@/lib/caregivers.functions";

vi.mock("@/lib/caregivers.functions", () => ({ changeCaregiverRole: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
const user = {
  id: "target",
  full_name: "Marie Exemple",
  role: "caregiver" as const,
  archived_at: null,
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
function setup(
  role: "admin" | "caregiver" = "caregiver",
  isAdmin = true,
  actorId = "actor",
  archived_at: string | null = null,
) {
  const saved = { ...user, role, archived_at };
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["caregiver", user.id], { profile: saved });
  function Profile() {
    const { data } = useQuery({
      queryKey: ["caregiver", user.id],
      queryFn: () => qc.getQueryData<{ profile: typeof saved }>(["caregiver", user.id])!,
      staleTime: Infinity,
    });
    return <UserRoleControl user={data!.profile} actorId={actorId} isAdmin={isAdmin} />;
  }
  render(
    <QueryClientProvider client={qc}>
      <Profile />
    </QueryClientProvider>,
  );
  return qc;
}
describe("Role toggle confirmation", () => {
  it("hides the toggle for caregivers, self and archived accounts", () => {
    for (const args of [
      ["caregiver", false, "actor", null],
      ["admin", true, user.id, null],
      ["admin", true, "actor", "2026-01-01"],
    ] as const) {
      setup(
        args[0] as "admin" | "caregiver",
        args[1] as boolean,
        args[2] as string,
        args[3] as string | null,
      );
      expect(screen.queryByRole("switch")).toBeNull();
      cleanup();
    }
  });
  it("canceling a promotion sends no mutation and keeps the saved toggle off", async () => {
    setup();
    fireEvent.click(screen.getByRole("switch", { hidden: true }));
    expect(
      await screen.findByRole("alertdialog", { name: "Confirmer la promotion" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { hidden: true })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(changeCaregiverRole).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { hidden: true })).toHaveAttribute("aria-checked", "false");
  });
  it.each(["admin", "caregiver"] as const)(
    "confirms the change to %s with a password and displays the server's saved role",
    async (newRole) => {
      const qc = setup(newRole === "admin" ? "caregiver" : "admin");
      vi.mocked(changeCaregiverRole).mockResolvedValue({ ok: true, role: newRole });
      fireEvent.click(screen.getByRole("switch", { hidden: true }));
      const label = newRole === "admin" ? "Confirmer la promotion" : "Confirmer la rétrogradation";
      expect(await screen.findByRole("alertdialog", { name: label })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Votre mot de passe actuel"), {
        target: { value: "test-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: label }));
      await screen.findByRole("status");
      expect(changeCaregiverRole).toHaveBeenCalledExactlyOnceWith({
        data: {
          id: user.id,
          role: newRole,
          expectedRole: newRole === "admin" ? "caregiver" : "admin",
          password: "test-password",
        },
      });
      expect(screen.getByRole("switch", { hidden: true })).toHaveAttribute(
        "aria-checked",
        String(newRole === "admin"),
      );
      expect(
        qc.getQueryData<{ profile: { role: string } }>(["caregiver", user.id])!.profile.role,
      ).toBe(newRole);
    },
  );
  it("keeps the original state and clears the password after a server rejection", async () => {
    setup("admin");
    vi.mocked(changeCaregiverRole).mockRejectedValue(
      new Error("Il doit toujours rester au moins un administrateur actif."),
    );
    fireEvent.click(screen.getByRole("switch", { hidden: true }));
    fireEvent.change(screen.getByLabelText("Votre mot de passe actuel"), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la rétrogradation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("au moins un administrateur");
    expect(screen.getByRole("switch", { hidden: true })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Votre mot de passe actuel")).toHaveValue("");
  });
  it("blocks duplicate confirmation and cancellation during the request", async () => {
    setup();
    let resolve!: (value: { ok: true; role: "admin" }) => void;
    vi.mocked(changeCaregiverRole).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(screen.getByRole("switch", { hidden: true }));
    fireEvent.change(screen.getByLabelText("Votre mot de passe actuel"), {
      target: { value: "test-password" },
    });
    const confirm = screen.getByRole("button", { name: "Confirmer la promotion" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled());
    expect(changeCaregiverRole).toHaveBeenCalledTimes(1);
    resolve({ ok: true, role: "admin" });
    await screen.findByRole("status");
  });
});
