import { useState, useRef, useEffect, useCallback } from 'react';
import { LineItem } from '@/types/quotation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, StickyNote, ChevronDown, ChevronUp, Copy, ImagePlus, Pencil, X, Loader2 } from 'lucide-react';
import { formatCurrency, calculateLineTotal } from '@/lib/quotation-utils';
import { searchProducts, ProductItem, PriceList, getProductPrice, getUSSkuPrice } from '@/data/product-catalog';
import { getProductCost, getAutoCost } from '@/data/product-costs';
import { Currency } from '@/types/quotation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineItemImageEditor } from './LineItemImageEditor';

interface LineItemWithSkuProps {
  item: LineItem;
  index: number;
  currency: Currency;
  priceList: PriceList;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  canRemove: boolean;
}

export const LineItemWithSku = ({
  item,
  index,
  currency,
  priceList,
  onUpdate,
  onRemove,
  onDuplicate,
  canRemove,
}: LineItemWithSkuProps) => {
  const [suggestions, setSuggestions] = useState<ProductItem[]>([]);
  const [activeField, setActiveField] = useState<'sku' | 'description' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showNotes, setShowNotes] = useState(!!item.notes || !!(item.images && item.images.length));
  const [priceExpr, setPriceExpr] = useState(String(item.unitPrice || ''));
  const skuInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Sync priceExpr when unitPrice changes externally (e.g. from catalog selection)
  const lastExternalPrice = useRef(item.unitPrice);
  useEffect(() => {
    if (item.unitPrice !== lastExternalPrice.current) {
      setPriceExpr(String(item.unitPrice || ''));
      lastExternalPrice.current = item.unitPrice;
    }
  }, [item.unitPrice]);

  const evaluateExpression = useCallback((expr: string): number | null => {
    try {
      const sanitized = expr.replace(/[^0-9+\-*/.() ]/g, '');
      if (!sanitized.trim()) return null;
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === 'number' && isFinite(result) && result >= 0) {
        return Math.round(result * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const handlePriceBlur = useCallback(() => {
    const result = evaluateExpression(priceExpr);
    if (result !== null) {
      onUpdate(item.id, { unitPrice: result });
      setPriceExpr(String(result));
      lastExternalPrice.current = result;
    } else if (priceExpr.trim() === '') {
      onUpdate(item.id, { unitPrice: 0 });
      lastExternalPrice.current = 0;
    }
  }, [priceExpr, evaluateExpression, item.id, onUpdate]);

  const handlePriceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePriceBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const handleSkuChange = (value: string) => {
    const cost = getAutoCost(value, item.description || '', currency);
    const updates: Partial<LineItem> = { sku: value };
    if (cost != null) updates.costPrice = cost;
    onUpdate(item.id, updates);
    const results = searchProducts(value);
    setSuggestions(results);
    setActiveField(results.length > 0 ? 'sku' : null);
    setHighlightedIndex(results.length > 0 ? 0 : -1);
    
    // Check for US SKU pricing when typing
    if (value.toUpperCase().startsWith('US')) {
      const usPrice = getUSSkuPrice(value, item.description, priceList);
      if (usPrice !== null) {
        const u: Partial<LineItem> = { sku: value, unitPrice: usPrice };
        if (cost != null) u.costPrice = cost;
        onUpdate(item.id, u);
      }
    }
  };

  const handleDescriptionChange = (value: string) => {
    const updates: Partial<LineItem> = { description: value };
    const cost = getAutoCost(item.sku || '', value, currency);
    if (cost != null) updates.costPrice = cost;
    onUpdate(item.id, updates);
    const results = searchProducts(value);
    setSuggestions(results);
    setActiveField(results.length > 0 ? 'description' : null);
    setHighlightedIndex(results.length > 0 ? 0 : -1);
    
    // Check for US SKU pricing when description changes
    if (item.sku?.toUpperCase().startsWith('US')) {
      const usPrice = getUSSkuPrice(item.sku, value, priceList);
      if (usPrice !== null) {
        const u: Partial<LineItem> = { description: value, unitPrice: usPrice };
        if (cost != null) u.costPrice = cost;
        onUpdate(item.id, u);
      }
    }
  };

  const handleSelectSuggestion = (product: ProductItem) => {
    const price = getProductPrice(product.sku, priceList, product.description);
    const cost = getProductCost(product.sku, currency);
    const updates: Partial<LineItem> = {
      sku: product.sku,
      description: product.description,
      unitPrice: price ?? 0,
    };
    if (cost != null) updates.costPrice = cost;
    onUpdate(item.id, updates);
    setActiveField(null);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Always prevent form submission on Enter in this input
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Select first suggestion if available, or the highlighted one
      if (activeField && suggestions.length > 0) {
        const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
        handleSelectSuggestion(suggestions[indexToSelect]);
      }
      return;
    }

    if (!activeField || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        skuInputRef.current &&
        !skuInputRef.current.contains(e.target as Node) &&
        descInputRef.current &&
        !descInputRef.current.contains(e.target as Node)
      ) {
        setActiveField(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // ---------- Image handling ----------
  const getSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage
      .from('line-item-images')
      .createSignedUrl(path, 60 * 60);
    if (error || !data) return null;
    return data.signedUrl;
  }, []);

  // Fetch signed URLs for all images on mount / when list changes
  useEffect(() => {
    const paths = item.images || [];
    const missing = paths.filter((p) => !signedUrls[p]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const p of missing) {
        const url = await getSignedUrl(p);
        if (url) entries.push([p, url]);
      }
      if (!cancelled && entries.length) {
        setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.images, getSignedUrl, signedUrls]);

  const uploadBlob = useCallback(
    async (blob: Blob, replacePath?: string): Promise<string | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Not signed in', variant: 'destructive' });
        return null;
      }
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/${item.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('line-item-images')
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) {
        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        return null;
      }
      if (replacePath) {
        await supabase.storage.from('line-item-images').remove([replacePath]);
        setSignedUrls((prev) => {
          const { [replacePath]: _, ...rest } = prev;
          return rest;
        });
      }
      return path;
    },
    [item.id, toast],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const file of imageFiles) {
          const path = await uploadBlob(file);
          if (path) uploaded.push(path);
        }
        if (uploaded.length) {
          onUpdate(item.id, { images: [...(item.images || []), ...uploaded] });
          setShowNotes(true);
          toast({ title: `Added ${uploaded.length} image${uploaded.length > 1 ? 's' : ''}` });
        }
      } finally {
        setUploading(false);
      }
    },
    [uploadBlob, item.id, item.images, onUpdate, toast],
  );

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await uploadFiles(files);
  };

  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    await uploadFiles(files);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f && f.type.startsWith('image/')) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      await uploadFiles(files);
    }
  };


  const removeImage = async (path: string) => {
    onUpdate(item.id, { images: (item.images || []).filter((p) => p !== path) });
    await supabase.storage.from('line-item-images').remove([path]);
    setSignedUrls((prev) => {
      const { [path]: _, ...rest } = prev;
      return rest;
    });
  };

  const openEditExisting = async (path: string) => {
    const url = signedUrls[path] || (await getSignedUrl(path));
    if (!url) return;
    // Fetch as blob then objectURL so cropper can read pixels (cross-origin safe)
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      setEditorSrc(URL.createObjectURL(blob));
      setEditingPath(path);
      setEditorOpen(true);
    } catch {
      toast({ title: 'Could not load image', variant: 'destructive' });
    }
  };

  const handleEditorSave = async (blob: Blob) => {
    const newPath = await uploadBlob(blob, editingPath || undefined);
    if (!newPath) return;
    if (editingPath) {
      onUpdate(item.id, {
        images: (item.images || []).map((p) => (p === editingPath ? newPath : p)),
      });
    } else {
      onUpdate(item.id, { images: [...(item.images || []), newPath] });
    }
    setEditorOpen(false);
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
    setEditingPath(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`animate-fade-in rounded-lg bg-secondary/30 border transition-colors min-w-[1050px] ${
        dragOver ? 'border-primary border-dashed bg-primary/5' : 'border-primary/10 hover:border-primary/30'
      }`}
    >
      <div className="grid grid-cols-[28px_130px_1fr_45px_45px_65px_85px_45px_75px_55px_85px_88px] gap-1.5 items-center p-3">
        <div className="flex justify-center">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        
        {/* SKU with autocomplete */}
        <div className="relative">
          <Input
            ref={skuInputRef}
            placeholder="Type SKU..."
            value={item.sku || ''}
            onChange={(e) => handleSkuChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setActiveField('sku');
            }}
            className="input-focus bg-background/50 border-primary/20 font-mono text-sm"
          />
          {activeField === 'sku' && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-80 mt-1 bg-card border border-border rounded-md shadow-lg max-h-96 overflow-y-auto"
            >
              {suggestions.map((product, idx) => {
                const price = product.prices[priceList];
                return (
                  <div
                    key={product.sku}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      idx === highlightedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleSelectSuggestion(product)}
                  >
                    <span className="font-mono font-medium">{product.sku}</span>
                    <span className="text-muted-foreground"> - {product.description}</span>
                    {price !== null && (
                      <span className="text-primary ml-2 font-medium">({price.toFixed(2)})</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Description with autocomplete */}
        <div className="relative">
          <Input
            ref={descInputRef}
            placeholder="Description"
            value={item.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setActiveField('description');
            }}
            className="input-focus bg-background/50 border-primary/20"
          />
          {activeField === 'description' && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-80 mt-1 bg-card border border-border rounded-md shadow-lg max-h-96 overflow-y-auto"
            >
              {suggestions.map((product, idx) => {
                const price = product.prices[priceList];
                return (
                  <div
                    key={product.sku}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      idx === highlightedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => handleSelectSuggestion(product)}
                  >
                    <span className="font-mono font-medium">{product.sku}</span>
                    <span className="text-muted-foreground"> - {product.description}</span>
                    {price !== null && (
                      <span className="text-primary ml-2 font-medium">({price.toFixed(2)})</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* LT (weeks) */}
        <div>
          <Input
            type="number"
            min="0"
            placeholder="Weeks"
            value={item.leadTime || ''}
            onChange={(e) => onUpdate(item.id, { leadTime: e.target.value })}
            className="input-focus text-center bg-background/50 border-primary/20"
          />
        </div>
        
        {/* MOQ */}
        <div>
          <Input
            type="number"
            min="1"
            placeholder="MOQ"
            value={item.moq || ''}
            onChange={(e) => onUpdate(item.id, { moq: parseInt(e.target.value) || 1 })}
            className="input-focus text-center bg-background/50 border-primary/20"
          />
        </div>
        
        {/* Cost Price */}
        <div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Cost"
            value={item.costPrice || ''}
            onChange={(e) => onUpdate(item.id, { costPrice: parseFloat(e.target.value) || 0 })}
            className="input-focus text-right bg-background/50 border-primary/20 font-mono text-sm"
          />
        </div>

        {/* Unit Price - supports expressions like 56.75*2 */}
        <div>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 56.75*2"
            value={priceExpr}
            onChange={(e) => setPriceExpr(e.target.value)}
            onBlur={handlePriceBlur}
            onKeyDown={handlePriceKeyDown}
            className="input-focus text-right bg-background/50 border-primary/20 font-mono"
          />
        </div>
        
        {/* Discount */}
        <div>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="0"
            value={item.discountPercent || ''}
            onChange={(e) => onUpdate(item.id, { discountPercent: parseFloat(e.target.value) || 0 })}
            className="input-focus text-center bg-background/50 border-primary/20"
          />
        </div>

        {/* Net unit price (after discount) */}
        <div className="text-center font-mono text-sm whitespace-nowrap text-muted-foreground">
          {item.discountPercent && item.unitPrice > 0
            ? formatCurrency(item.unitPrice * (1 - item.discountPercent / 100), currency)
            : <span>—</span>}
        </div>

        {/* Margin % */}
        <div className="text-center font-mono text-sm whitespace-nowrap">
          {item.costPrice && item.unitPrice > 0 ? (() => {
            const netUnit = item.unitPrice * (1 - (item.discountPercent || 0) / 100);
            const margin = netUnit > 0 ? ((netUnit - item.costPrice) / netUnit) * 100 : 0;
            return (
              <span className={margin >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                {margin.toFixed(1)}%
              </span>
            );
          })() : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Total */}
        <div className="text-right font-mono font-medium text-primary glow-text whitespace-nowrap text-sm">
          {formatCurrency(calculateLineTotal(item), currency)}
        </div>
        
        {/* Actions - moved to separate column with no overlap */}
        <div className="flex justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowNotes(!showNotes)}
            className={`h-7 w-7 transition-colors ${
              showNotes || item.notes 
                ? 'text-primary hover:text-primary/80 hover:bg-primary/10' 
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
            title={showNotes ? 'Hide notes' : 'Add notes'}
          >
            {showNotes ? <ChevronUp className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(item.id)}
            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="Duplicate item"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.id)}
            disabled={!canRemove}
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Notes & Images Section */}
      {showNotes && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          <div className="flex items-start gap-2 pl-0 md:pl-12">
            <StickyNote className="h-4 w-4 text-muted-foreground mt-2 flex-shrink-0" />
            <Textarea
              placeholder="Add notes for this item..."
              value={item.notes || ''}
              onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
              rows={2}
              className="input-focus resize-none bg-background/50 border-primary/20 text-sm flex-1"
            />
          </div>

          {/* Images */}
          <div className="pl-0 md:pl-12">
            <div className="flex flex-wrap gap-2 items-start">
              {(item.images || []).map((path) => (
                <div key={path} className="relative group w-24 h-24 rounded-md overflow-hidden border border-primary/20 bg-background/50">
                  {signedUrls[path] ? (
                    <img src={signedUrls[path]} alt="line item" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-white/20"
                      onClick={() => openEditExisting(path)}
                      title="Edit image"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-destructive/40"
                      onClick={() => removeImage(path)}
                      title="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-24 w-24 flex-col gap-1 border-dashed border-primary/30 text-muted-foreground hover:text-primary hover:border-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs">Add / drop / paste</span>
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
          </div>
        </div>
      )}

      <LineItemImageEditor
        open={editorOpen}
        imageSrc={editorSrc}
        onClose={() => {
          setEditorOpen(false);
          setEditorSrc(null);
          setEditingPath(null);
        }}
        onSave={handleEditorSave}
      />
    </div>
  );
};
