// Market pulse: FX rates, metal-cutting industry stocks and news
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOCKS: { symbol: string; name: string }[] = [
  { symbol: "KMT", name: "Kennametal" },
  { symbol: "HURC", name: "Hurco" },
  { symbol: "LECO", name: "Lincoln Electric" },
  { symbol: "TKR", name: "Timken" },
  { symbol: "SAND.ST", name: "Sandvik" },
  { symbol: "MKTAY", name: "Makita" },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

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

async function getStock(meta: { symbol: string; name: string }) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.symbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`yahoo ${res.status}`);
    const json = await res.json();
    const m = json?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice ?? null;
    const prev = m?.chartPreviousClose ?? m?.previousClose ?? null;
    const changePct = price && prev ? ((price - prev) / prev) * 100 : null;
    if (price == null) return null;
    return {
      symbol: meta.symbol,
      name: meta.name,
      price,
      changePct,
      date: m?.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : undefined,
    };
  } catch (e) {
    console.error("Stock error", meta.symbol, e);
    return null;
  }
}

async function getStocks() {
  const rows = await Promise.all(STOCKS.map(getStock));
  return rows.filter((r) => r !== null);
}

async function getNews() {
  try {
    const q = encodeURIComponent(
      '("metal cutting" OR "machine tools" OR CNC OR machining OR "cutting tools") industry'
    );
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { headers: { "User-Agent": UA } });
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
