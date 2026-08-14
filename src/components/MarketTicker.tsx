import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Newspaper, CalendarDays, RefreshCw } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('market-pulse');
      if (error) throw error;
      setData(res as PulseData);
    } catch (e) {
      console.error('market-pulse failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadingFallback = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);
    const autoLoad = () => {
      load();
    };
    autoLoad();
    // Auto-refresh every 5 minutes and whenever the tab regains focus
    const id = setInterval(autoLoad, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') autoLoad(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', autoLoad);
    return () => {
      cancelled = true;
      window.clearTimeout(loadingFallback);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', autoLoad);
    };
  }, [load]);

  const handleRefresh = () => {
    if (refreshing) return;
    load();
  };

  const upcoming = INDUSTRY_EVENTS
    .filter(e => new Date(e.end) >= new Date())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);

  if (loading && !data) return <Skeleton className="h-20 w-full" />;
  if (!data && upcoming.length === 0) return null;


  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        {data && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Market status</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh market data"
              title="Refresh market data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
        )}
        {data?.news?.length ? (
          <div className="space-y-1 border-t border-border pt-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Newspaper className="w-3.5 h-3.5" /> Industry news
            </div>
            {data.news.slice(0, 3).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-foreground hover:text-primary transition-colors truncate"
              >
                {n.title}
                {n.source ? <span className="text-muted-foreground"> · {n.source}</span> : null}
              </a>
            ))}
          </div>
        ) : null}

        {upcoming.length ? (
          <div className="space-y-1 border-t border-border pt-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" /> Upcoming events
            </div>
            <div className="flex flex-wrap gap-2">
              {upcoming.map(ev => (
                <a
                  key={ev.name}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1 hover:border-primary transition-colors"
                >
                  <span className="text-xs text-foreground truncate max-w-[220px]">{ev.name}</span>
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    {new Date(ev.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {ev.location}
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

};
