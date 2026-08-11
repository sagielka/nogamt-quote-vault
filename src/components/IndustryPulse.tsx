import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Newspaper, CalendarDays, RefreshCw, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INDUSTRY_EVENTS } from '@/data/industry-events';
import type { Currency } from '@/types/quotation';

interface StockRow { symbol: string; name: string; price: number | null; changePct: number | null; date?: string }
interface NewsRow { title: string; link: string; pubDate: string; source: string }
interface PulseData {
  fx: { rates: Record<string, number> | null; updated: string | null; source: string };
  stocks: StockRow[];
  news: NewsRow[];
  fetchedAt: string;
}

const TRACKED: Currency[] = ['ILS', 'EUR', 'GBP', 'CNY', 'JPY'];

export const IndustryPulse = () => {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('market-pulse');
      if (error) throw error;
      setData(res as PulseData);
    } catch (e) {
      console.error('market-pulse failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const upcoming = INDUSTRY_EVENTS
    .filter(e => new Date(e.end) >= new Date())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {data?.fetchedAt ? `Updated ${new Date(data.fetchedAt).toLocaleString()}` : 'Loading market data…'}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Refresh market data">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Exchange rates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Coins className="w-4 h-4" /> Exchange Rates (1 USD =)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {TRACKED.map(cur => {
                const rate = data?.fx?.rates?.[cur];
                return (
                  <div key={cur} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">{cur}</p>
                    <p className="text-lg font-bold text-foreground">{rate ? rate.toFixed(cur === 'JPY' ? 2 : 4) : '—'}</p>
                    <p className="text-[10px] text-muted-foreground">1 {cur} = ${rate ? (1 / rate).toFixed(4) : '—'}</p>
                  </div>
                );
              })}
            </div>
          )}
          {data?.fx?.updated && <p className="text-[10px] text-muted-foreground mt-2">Rates: {data.fx.updated}</p>}
        </CardContent>
      </Card>

      {/* Stocks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Metal Cutting Industry Stocks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <Skeleton className="h-20 w-full" />
          ) : data?.stocks?.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.stocks.map(s => {
                const up = (s.changePct ?? 0) >= 0;
                return (
                  <div key={s.symbol} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground truncate" title={s.name}>{s.name}</p>
                    <p className="text-base font-bold text-foreground">{s.price?.toFixed(2)}</p>
                    <p className={`text-xs flex items-center gap-1 ${up ? 'text-success' : 'text-destructive'}`}>
                      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {s.changePct !== null ? `${up ? '+' : ''}${s.changePct.toFixed(2)}%` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Stock data unavailable right now.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* News */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Newspaper className="w-4 h-4" /> Industry News</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[420px] overflow-y-auto">
            {loading && !data ? (
              <Skeleton className="h-40 w-full" />
            ) : data?.news?.length ? (
              data.news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block group">
                  <p className="text-sm text-foreground group-hover:text-primary transition-colors leading-snug">{n.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {n.source}{n.pubDate ? ` · ${new Date(n.pubDate).toLocaleDateString()}` : ''}
                  </p>
                </a>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No news available right now.</p>
            )}
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Upcoming Industry Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[420px] overflow-y-auto">
            {upcoming.map(ev => (
              <a key={ev.name} href={ev.url} target="_blank" rel="noopener noreferrer" className="block rounded-md border border-border p-3 hover:border-primary transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground leading-snug">{ev.name}</p>
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    {new Date(ev.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{ev.location} · {ev.focus}</p>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
