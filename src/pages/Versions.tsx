import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Monitor, Package, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CHANGELOG } from "@/data/changelog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVersionReporter } from "@/hooks/useVersionReporter";

interface VersionEvent {
  id: string;
  user_id: string;
  version: string;
  previous_version: string | null;
  user_agent: string | null;
  created_at: string;
}

const displayName = (raw: string | null | undefined, fallback: string) => {
  if (!raw) return fallback;
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  return local.charAt(0).toUpperCase() + local.slice(1);
};

const browserOf = (ua: string | null) => {
  if (!ua) return "Unknown";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/") && !ua.includes("Chromium")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Other";
};

export default function Versions() {
  useVersionReporter();
  const navigate = useNavigate();
  const [events, setEvents] = useState<VersionEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_version_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = (data ?? []) as VersionEvent[];
    setEvents(rows);

    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      setNames(
        Object.fromEntries(
          (profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]),
        ),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const currentVersion = String(import.meta.env.PACKAGE_VERSION ?? "—");

  const latestPerUser = useMemo(() => {
    const seen = new Map<string, VersionEvent>();
    for (const e of events) if (!seen.has(e.user_id)) seen.set(e.user_id, e);
    return [...seen.values()];
  }, [events]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <History className="h-5 w-5 text-primary" />
              Version History
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Current: v{currentVersion}</Badge>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-4 w-4 text-primary" />
              What changed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="border-l-2 border-primary/40 pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">v{entry.version}</span>
                  {entry.version === currentVersion && <Badge>Running now</Badge>}
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-4 w-4 text-primary" />
              Who is on which version
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestPerUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading..." : "No update events recorded yet."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>Updated at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestPerUser.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {displayName(names[e.user_id], e.user_id.slice(0, 8))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.version === currentVersion ? "default" : "outline"}>
                          v{e.version}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {browserOf(e.user_agent)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Full update log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {displayName(names[e.user_id], e.user_id.slice(0, 8))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.previous_version ? `v${e.previous_version}` : "—"}
                    </TableCell>
                    <TableCell>v{e.version}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {browserOf(e.user_agent)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
