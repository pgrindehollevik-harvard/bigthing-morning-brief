// Norwegian political party colors
export const PARTY_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  // Arbeiderpartiet (Ap/A) - Red
  Ap: {
    bg: "bg-red-600",
    text: "text-white",
    border: "border-red-700",
  },
  A: {
    bg: "bg-red-600",
    text: "text-white",
    border: "border-red-700",
  },
  // Høyre (H) - Blue
  H: {
    bg: "bg-blue-600",
    text: "text-white",
    border: "border-blue-700",
  },
  // Fremskrittspartiet (FrP) - Light Blue/Turquoise
  FrP: {
    bg: "bg-cyan-500",
    text: "text-white",
    border: "border-cyan-600",
  },
  // Senterpartiet (Sp) - Green
  Sp: {
    bg: "bg-green-600",
    text: "text-white",
    border: "border-green-700",
  },
  // Kristelig Folkeparti (KrF) - Yellow
  KrF: {
    bg: "bg-yellow-400",
    text: "text-gray-900",
    border: "border-yellow-500",
  },
  // Venstre (V) - Light Green/Mint
  V: {
    bg: "bg-emerald-400",
    text: "text-gray-900",
    border: "border-emerald-500",
  },
  // Sosialistisk Venstreparti (SV) - Dark Red
  SV: {
    bg: "bg-rose-700",
    text: "text-white",
    border: "border-rose-800",
  },
  // Miljøpartiet De Grønne (MDG) - Bright Green
  MDG: {
    bg: "bg-lime-500",
    text: "text-gray-900",
    border: "border-lime-600",
  },
  // Rødt (R) - Dark Red
  R: {
    bg: "bg-red-800",
    text: "text-white",
    border: "border-red-900",
  },
};

export function getPartyColors(partyId: string) {
  return PARTY_COLORS[partyId] || {
    bg: "bg-gray-500",
    text: "text-white",
    border: "border-gray-600",
  };
}

