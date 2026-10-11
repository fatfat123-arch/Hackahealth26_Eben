const SWISS_PREFIXES = new Set([
  "21",
  "22",
  "24",
  "26",
  "27",
  "31",
  "32",
  "33",
  "34",
  "41",
  "43",
  "44",
  "51",
  "52",
  "55",
  "56",
  "58",
  "61",
  "62",
  "71",
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
  "81",
  "91",
]);

function nationalDigits(value: string) {
  const compact = value.trim().replace(/[ ()'./-]/g, "");
  if (!compact) return "";
  if (!/^\+?\d+$/.test(compact)) return null;

  let digits: string;
  if (compact.startsWith("+41")) digits = compact.slice(3);
  else if (compact.startsWith("0041")) digits = compact.slice(4);
  else if (compact.startsWith("0")) digits = compact.slice(1);
  else return null;

  // Also accept the commonly written international form +41 (0)xx xxx xx xx.
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function swissPhoneError(value: string): string | null {
  if (!value.trim()) return null;
  if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value))
    return "Le numéro de téléphone ne peut pas contenir de lettres.";
  const digits = nationalDigits(value);
  if (!digits || digits.length !== 9 || !SWISS_PREFIXES.has(digits.slice(0, 2))) {
    return "Saisissez un numéro suisse mobile ou fixe valide, par exemple +41 79 123 45 67 ou 021 123 45 67.";
  }
  return null;
}

export function formatSwissPhone(value: string) {
  const digits = nationalDigits(value);
  if (!digits || digits.length !== 9 || !SWISS_PREFIXES.has(digits.slice(0, 2)))
    return value.trim();
  return `+41 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}
