/** Currencies offered for the salary-negotiation round. */
export const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "INR", label: "INR — Indian Rupee", symbol: "₹" },
  { code: "CAD", label: "CAD — Canadian Dollar", symbol: "C$" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "A$" },
  { code: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { code: "SGD", label: "SGD — Singapore Dollar", symbol: "S$" },
  { code: "AED", label: "AED — UAE Dirham", symbol: "د.إ" },
  { code: "CHF", label: "CHF — Swiss Franc", symbol: "Fr" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === "string" && CURRENCY_CODES.includes(v);
}
