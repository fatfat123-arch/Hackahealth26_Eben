import { useId, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";

const UP = "ABCDEFGHJKLMNPQRSTUVWXYZ", LOW = "abcdefghijkmnopqrstuvwxyz", DIG = "23456789", SYM = "!@#$%&*?-_+=";

function randInt(n: number) {
  const a = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(a); while (a[0]! >= limit);
  return a[0]! % n;
}
const pick = (set: string) => set[randInt(set.length)]!;

/** Strong random password (crypto.getRandomValues), always containing each character class. */
export function generatePassword(length = 16): string {
  const all = UP + LOW + DIG + SYM;
  const chars = [pick(UP), pick(LOW), pick(DIG), pick(SYM)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

export function PasswordField({ value, onChange, label = "Mot de passe" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }
  return <div className="bo-field">
    <label htmlFor={id}>{label}</label>
    <div className="bo-password">
      <input id={id} className="bo-input" type={shown ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} />
      <button type="button" className="bo-pencil bo-password-eye" onClick={() => setShown(!shown)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={shown}>
        {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
    <div className="bo-actions">
      <button type="button" className="bo-btn bo-btn-outline bo-btn-sm" onClick={() => { onChange(generatePassword()); setCopied(false); }}><KeyRound aria-hidden="true" /> Générer un mot de passe</button>
      <button type="button" className="bo-btn bo-btn-outline bo-btn-sm" onClick={copy} disabled={!value}><Copy aria-hidden="true" /> Copier</button>
    </div>
    {copied && <p className="bo-hint" role="status">Mot de passe copié.</p>}
    <small className="bo-hint">Au moins 8 caractères. Ce mot de passe ne sera plus visible après l’enregistrement. Copiez-le maintenant.</small>
  </div>;
}
