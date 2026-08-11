// Market pulse: FX rates, metal-cutting industry stocks and news
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOCKS: { symbol: string; name: string }[] = [
  { symbol: "kmt.us", name: "Kennametal" },
  { symbol: "hurc.us", name: "Hurco" },
  { symbol: "leco.us", name: "Lincoln Electric" },
  { symbol: "tkr.us", name: "Timken" },
  { symbol: "sand.st", name: "Sandvik" },
  { symbol: "mkta.us", name: "Makita" },
];

async function getRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const json = await res.json();
    return { rates: json.rates ?? {}, updated: json.time_last_update_utc ?? null, source: "open.er-api.com" };
  } catch (e) {
    console.error("FX error:", e);
    return { rates: null, updated: null, source: "unavailable" };
  }
}

async function getStocks() {
  try {
    const symbols = STOCKS.map((s) => s.symbol).join(",");
    const res = await fetch(`https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=csv`);
    if (!res.ok) throw new Error(`stooq ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split("\n").slice(1);
    return lines.map((line) => {
      const [symbol, date, _time, open, _high, _low, close] = line.split(",");
      const o = parseFloat(open);
      const c = parseFloat(close);
      const meta = STOCKS.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase());
      const changePct = isFinite(o) && o > 0 && isFinite(c) ? ((c - o) / o) * 100 : null;
      return {
        symbol: symbol.toUpperCase(),
        name: meta?.name ?? symbol.toUpperCase(),
        price: isFinite(c) ? c : null,
        changePct,
        date,
      };
    }).filter((s) => s.price !== null);
  } catch (e) {
    console.error("Stocks error:", e);
    return [];
  }
}

async function getNews() {
  try {
    const q = encodeURIComponent(
      '("metal cutting" OR "machine tools" OR CNC OR machining OR "cutting tools") industry'
    );
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
    if (!res.ok) throw new Error(`news ${res.status}`);
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map((m) => {
      const block = m[1];
      const pick = (tag: string) => {
        const r = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      };
      const title = pick("title").replace(/<[^>]+>/g, "");
      return {
        title,
        link: pick("link"),
        pubDate: pick("pubDate"),
        source: pick("source").replace(/<[^>]+>/g, ""),
      };
    });
    return items.filter((i) => i.title);
  } catch (e) {
    console.error("News error:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const [fx, stocks, news] = await Promise.all([getRates(), getStocks(), getNews()]);

  return new Response(
    JSON.stringify({ fx, stocks, news, fetchedAt: new Date().toISOString() }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
        ...corsHeaders,
      },
    }
  );
});
