import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Newspaper, CalendarDays } from 'lucide-react';
import { INDUSTRY_EVENTS } from '@/data/industry-events';
import type { Currency } from '@/types/quotation';

interface StockRow { symbol: string; name: string; price: number | null; changePct: number | null }
interface NewsRow { title: string; link: string; source: string }
interface PulseData {
  fx: { rates: Record<string, number> | null };
  stocks: StockRow[];
  news: NewsRow[];
  fetchedAt: string;
}

const TRACKED: Currency[] = ['ILS', 'EUR', 'GBP', 'CNY', 'JPY'];


/** Compact market status strip for the landing page. */
export const MarketTicker = () => {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res, error } = await supabase.functions.invoke('market-pulse');
        if (error) throw error;
        if (!cancelled) setData(res as PulseData);
      } catch (e) {
        console.error('market-pulse failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upcoming = INDUSTRY_EVENTS
    .filter(e => new Date(e.end) >= new Date())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);

  if (loading && !data) return <Skeleton className="h-20 w-full" />;
  if (!data) return null;


  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Market status</span>
          {TRACKED.map(cur => {
            const rate = data.fx?.rates?.[cur];
            return (
              <span key={cur} className="text-xs text-muted-foreground">
                USD/{cur} <span className="font-semibold text-foreground">{rate ? rate.toFixed(cur === 'JPY' ? 2 : 3) : '—'}</span>
              </span>
            );
          })}
          {data.stocks?.slice(0, 6).map(s => {
            const up = (s.changePct ?? 0) >= 0;
            return (
              <span key={s.symbol} className="text-xs text-muted-foreground flex items-center gap-1">
                {s.name} <span className="font-semibold text-foreground">{s.price?.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 ${up ? 'text-success' : 'text-destructive'}`}>
                  {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {s.changePct !== null ? `${up ? '+' : ''}${s.changePct.toFixed(2)}%` : '—'}
                </span>
              </span>
            );
          })}
        </div>
        {data.news?.length ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <Newspaper className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <a
              href={data.news[0].link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground hover:text-primary transition-colors truncate"
            >
              {data.news[0].title}
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
