import { useEffect, useState } from 'react';
import type { Currency } from '@/types/quotation';

/** Fallback USD-based rates (1 USD = X currency) used when live rates are unavailable. */
export const FALLBACK_USD_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  ILS: 3.65,
  JPY: 155,
  CNY: 7.2,
};

export interface FxState {
  rates: Record<string, number>;
  updated: string | null;
  live: boolean;
}

export const toUSD = (amount: number, currency: Currency, rates: Record<string, number>) => {
  const rate = rates[currency] ?? FALLBACK_USD_RATES[currency] ?? 1;
  if (!rate || !isFinite(rate)) return amount;
  return amount / rate;
};

export const formatUSD = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

/** Fetches live USD-based rates once, falling back to static rates. */
export const useExchangeRates = (): FxState => {
  const [state, setState] = useState<FxState>({ rates: FALLBACK_USD_RATES, updated: null, live: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.rates) return;
        setState({
          rates: { ...FALLBACK_USD_RATES, ...json.rates },
          updated: json.time_last_update_utc ?? null,
          live: true,
        });
      } catch {
        /* keep fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
};
