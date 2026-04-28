import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Upload, Loader2, FileText, X, ArrowRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { productCatalog, ProductItem } from '@/data/product-catalog';
import { QuotationFormData, Currency } from '@/types/quotation';
import { createEmptyLineItem } from '@/lib/quotation-utils';

interface ExtractedItem {
  sku?: string;
  suggestedSku?: string;
  description: string;
  rawText?: string;
  quantity: number;
  notes?: string;
}

interface ExtractedData {
  customer: { name: string; email: string; company?: string; address?: string };
  currency: Currency;
  leadTime?: string;
  notes?: string;
  items: ExtractedItem[];
}

interface AIQuoteAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrefill: (data: Partial<QuotationFormData>) => void;
}

export const AIQuoteAssistant = ({ open, onOpenChange, onPrefill }: AIQuoteAssistantProps) => {
  const { toast } = useToast();
  const [emailText, setEmailText] = useState('');
  const [attachmentText, setAttachmentText] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState('');
  const [attachmentMime, setAttachmentMime] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [chosenSkus, setChosenSkus] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEmailText('');
    setAttachmentText('');
    setAttachmentBase64('');
    setAttachmentMime('');
    setAttachmentName('');
    setExtracted(null);
    setChosenSkus({});
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip "data:...;base64," prefix
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const readFile = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB.', variant: 'destructive' });
      return;
    }
    setAttachmentName(file.name);
    setAttachmentText('');
    setAttachmentBase64('');
    setAttachmentMime('');

    if (['txt', 'eml', 'msg', 'html', 'htm', 'csv'].includes(ext)) {
      const text = await file.text();
      setAttachmentText(text.slice(0, 50000));
    } else if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      // Send PDFs and images directly to the AI as base64 (Gemini reads them natively)
      const base64 = await fileToBase64(file);
      const mime =
        ext === 'pdf'
          ? 'application/pdf'
          : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : `image/${ext}`;
      setAttachmentBase64(base64);
      setAttachmentMime(mime);
      toast({
        title: 'File attached',
        description: `${file.name} will be read directly by the AI.`,
      });
    } else {
      setAttachmentText(`[Attached file: ${file.name} — unsupported format, paste contents into the email box]`);
      toast({
        title: 'Unsupported file',
        description: 'Paste any text into the email box for best results.',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await readFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await readFile(file);
  };

  const handleExtract = async () => {
    if (!emailText.trim() && !attachmentText.trim()) {
      toast({ title: 'Nothing to extract', description: 'Paste an email or drop a file.', variant: 'destructive' });
      return;
    }
    setIsExtracting(true);
    try {
      // Send a compact catalog reference (sku + description only)
      const catalog = productCatalog.map((p) => ({ sku: p.sku, description: p.description }));
      const { data, error } = await supabase.functions.invoke('ai-extract-quote', {
        body: { emailText, attachmentText, catalog },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result: ExtractedData = data.data;
      setExtracted(result);
      // Pre-select confidently matched SKUs
      const initial: Record<number, string> = {};
      result.items.forEach((it, i) => {
        if (it.sku) initial[i] = it.sku;
      });
      setChosenSkus(initial);
      toast({ title: 'Extracted', description: `Found ${result.items.length} item(s).` });
    } catch (err: any) {
      console.error('Extraction error:', err);
      toast({
        title: 'Extraction failed',
        description: err?.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const findProduct = (sku: string): ProductItem | undefined =>
    productCatalog.find((p) => p.sku.toLowerCase() === sku.toLowerCase());

  const handleUseExtraction = () => {
    if (!extracted) return;
    const items = extracted.items.map((it, i) => {
      const empty = createEmptyLineItem();
      const finalSku = chosenSkus[i] || it.sku || it.suggestedSku || '';
      const product = finalSku ? findProduct(finalSku) : undefined;
      return {
        ...empty,
        sku: product?.sku || finalSku || '',
        description: product?.description || it.description || it.rawText || '',
        moq: it.quantity || 1,
        unitPrice: 0, // user fills pricing
        notes: it.notes || '',
      };
    });

    const initial: Partial<QuotationFormData> = {
      clientName: extracted.customer.company || extracted.customer.name,
      clientEmail: extracted.customer.email,
      clientAddress: extracted.customer.address || '',
      currency: extracted.currency,
      items,
      taxRate: 0,
      discountType: 'percentage',
      discountValue: 0,
      notes: extracted.notes || '',
      status: 'draft',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      attachments: [],
      orderedItems: null,
    };
    onPrefill(initial);
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Quote Assistant
          </SheetTitle>
          <SheetDescription>
            Paste a customer email (or drop a file) — AI extracts the request and pre-fills a draft quote for you to review.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {!extracted && (
            <>
              <div>
                <Label htmlFor="email-text" className="text-xs uppercase tracking-wider text-primary/80">
                  Email body
                </Label>
                <Textarea
                  id="email-text"
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste the customer's RFQ email here..."
                  className="min-h-[220px] mt-2 font-mono text-sm"
                />
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-primary/30 rounded-md p-4 text-center"
              >
                {attachmentName ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4" />
                      <span className="truncate">{attachmentName}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentText('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drop a .eml / .msg / .txt / .csv file here, or
                    </p>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Choose file
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".eml,.msg,.txt,.html,.htm,.csv,.pdf,.docx"
                      onChange={handleFileChange}
                    />
                  </>
                )}
              </div>

              <Button
                onClick={handleExtract}
                disabled={isExtracting || (!emailText.trim() && !attachmentText.trim())}
                className="w-full"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing email...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract quote with AI
                  </>
                )}
              </Button>
            </>
          )}

          {extracted && (
            <div className="space-y-4">
              <Card className="p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-primary/80">Customer</div>
                <div className="text-sm">
                  <div className="font-semibold">{extracted.customer.company || extracted.customer.name}</div>
                  <div className="text-muted-foreground">{extracted.customer.email}</div>
                  {extracted.customer.address && (
                    <div className="text-muted-foreground">{extracted.customer.address}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground italic">
                  You'll pick / confirm the customer in the next step.
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider text-primary/80">
                    Items ({extracted.items.length}) — {extracted.currency}
                  </div>
                </div>
                <div className="space-y-3">
                  {extracted.items.map((it, i) => {
                    const matched = it.sku && findProduct(it.sku);
                    const suggested = !matched && it.suggestedSku && findProduct(it.suggestedSku);
                    return (
                      <div key={i} className="border border-border rounded-md p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                            <Badge variant="outline">Qty: {it.quantity}</Badge>
                          </div>
                          {matched ? (
                            <Badge className="bg-success/20 text-success border-success/30">Matched</Badge>
                          ) : suggested ? (
                            <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                              Suggestion
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-3 h-3" /> Manual
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs italic mb-2">
                          "{it.rawText || it.description}"
                        </div>
                        <Label className="text-xs">SKU</Label>
                        <Input
                          value={chosenSkus[i] ?? it.sku ?? it.suggestedSku ?? ''}
                          onChange={(e) =>
                            setChosenSkus((prev) => ({ ...prev, [i]: e.target.value.toUpperCase() }))
                          }
                          placeholder="Type or accept SKU"
                          className="h-8 mt-1 font-mono text-sm"
                        />
                        {suggested && !chosenSkus[i] && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Suggested: <span className="font-mono">{it.suggestedSku}</span> — {suggested.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} className="flex-1">
                  Start over
                </Button>
                <Button onClick={handleUseExtraction} className="flex-1">
                  Open in form
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
