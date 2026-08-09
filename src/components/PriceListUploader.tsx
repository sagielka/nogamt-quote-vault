import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, FileSpreadsheet, Loader2, Trash2, X } from 'lucide-react';
import { useCustomPriceLists, type CustomPriceRow } from '@/hooks/useCustomPriceLists';

const CURRENCIES = ['USD', 'EUR', 'ILS'];

const pick = (row: Record<string, any>, keys: string[]) => {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z]/g, '');
    if (keys.includes(norm)) return row[k];
  }
  return undefined;
};

const parseFile = async (file: File): Promise<CustomPriceRow[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  const rows: CustomPriceRow[] = [];
  for (const r of json) {
    const sku = String(pick(r, ['sku', 'itemno', 'item', 'pn', 'partnumber', 'catalog', 'code']) ?? '').trim();
    const rawPrice = pick(r, ['price', 'unitprice', 'listprice', 'netprice', 'amount', 'cost']);
    const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice ?? '').replace(/[^0-9.\-]/g, ''));
    if (!sku || !isFinite(price)) continue;
    rows.push({
      sku,
      description: String(pick(r, ['description', 'desc', 'name', 'product']) ?? '').trim() || null,
      price,
    });
  }
  return rows;
};

export const PriceListUploader = () => {
  const { toast } = useToast();
  const { lists, loading, createList, deleteList } = useCustomPriceLists();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CustomPriceRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) {
        toast({
          title: 'No prices found',
          description: 'Make sure the file has SKU and Price columns.',
          variant: 'destructive',
        });
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setName((n) => n || file.name.replace(/\.[^.]+$/, ''));
    } catch (e: any) {
      toast({ title: 'Could not read file', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const save = async () => {
    if (!name.trim() || !rows.length) return;
    setBusy(true);
    try {
      await createList(name.trim(), currency, fileName || null, rows);
      toast({ title: 'Price list added', description: `${rows.length} prices imported.` });
      setRows([]);
      setFileName('');
      setName('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteList(id);
      toast({ title: 'Price list deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h3 className="heading-display text-lg">Custom price lists</h3>
          <span className="text-xs text-muted-foreground ml-auto">{lists.length} lists</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          {busy ? (
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
          ) : (
            <UploadCloud className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
          )}
          <p className="text-sm font-medium">Drag &amp; drop a price list here</p>
          <p className="text-xs text-muted-foreground mt-1">
            Excel or CSV with columns: SKU, Description (optional), Price
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{fileName}</Badge>
              <span className="text-xs text-muted-foreground">{rows.length} prices ready</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  setRows([]);
                  setFileName('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Price list name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Distributor 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-48 overflow-auto rounded border border-border text-sm">
              {rows.slice(0, 30).map((r, i) => (
                <div key={i} className="flex gap-3 px-3 py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-mono w-32 shrink-0 truncate">{r.sku}</span>
                  <span className="flex-1 truncate text-muted-foreground">{r.description}</span>
                  <span className="tabular-nums">{r.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Button onClick={save} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save price list
            </Button>
          </div>
        )}

        {!loading && lists.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {lists.map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{l.name}</span>
                <Badge variant="outline">{l.currency}</Badge>
                <span className="text-xs text-muted-foreground">{l.item_count} items</span>
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => remove(l.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PriceListUploader;
