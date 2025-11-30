// Norwegian political party colors - muted/pastel versions
export const PARTY_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  // Arbeiderpartiet (Ap/A) - Red (muted)
  Ap: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  A: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  // Høyre (H) - Blue (muted)
  H: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  // Fremskrittspartiet (FrP) - Purple (muted)
  FrP: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  // Senterpartiet (Sp) - Green (muted)
  Sp: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
  },
  // Kristelig Folkeparti (KrF) - Yellow (muted)
  KrF: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
  },
  // Venstre (V) - Light Green/Mint (muted)
  V: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  // Sosialistisk Venstreparti (SV) - Dark Red (muted)
  SV: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-200",
  },
  // Miljøpartiet De Grønne (MDG) - Bright Green (muted)
  MDG: {
    bg: "bg-lime-100",
    text: "text-lime-800",
    border: "border-lime-200",
  },
  // Rødt (R) - Dark Red (muted)
  R: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
};

export function getPartyColors(partyId: string) {
  return PARTY_COLORS[partyId] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
  };
}

