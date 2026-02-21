import { useState, useRef, useEffect, useCallback } from 'react';
import { LineItem } from '@/types/quotation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, StickyNote, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { formatCurrency, calculateLineTotal } from '@/lib/quotation-utils';
import { searchProducts, ProductItem, PriceList, getProductPrice, getUSSkuPrice } from '@/data/product-catalog';
import { Currency } from '@/types/quotation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [priceExpr, setPriceExpr] = useState(String(item.unitPrice || ''));
  const skuInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
    onUpdate(item.id, { sku: value });
    const results = searchProducts(value);
    setSuggestions(results);
    setActiveField(results.length > 0 ? 'sku' : null);
    setHighlightedIndex(results.length > 0 ? 0 : -1);
    
    // Check for US SKU pricing when typing
    if (value.toUpperCase().startsWith('US')) {
      const usPrice = getUSSkuPrice(value, item.description, priceList);
      if (usPrice !== null) {
        onUpdate(item.id, { sku: value, unitPrice: usPrice });
      }
    }
  };

  const handleDescriptionChange = (value: string) => {
    onUpdate(item.id, { description: value });
    const results = searchProducts(value);
    setSuggestions(results);
    setActiveField(results.length > 0 ? 'description' : null);
    setHighlightedIndex(results.length > 0 ? 0 : -1);
    
    // Check for US SKU pricing when description changes
    if (item.sku?.toUpperCase().startsWith('US')) {
      const usPrice = getUSSkuPrice(item.sku, value, priceList);
      if (usPrice !== null) {
        onUpdate(item.id, { description: value, unitPrice: usPrice });
      }
    }
  };

  const handleSelectSuggestion = (product: ProductItem) => {
    const price = getProductPrice(product.sku, priceList, product.description);
    onUpdate(item.id, { 
      sku: product.sku, 
      description: product.description,
      unitPrice: price ?? 0
    });
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="animate-fade-in rounded-lg bg-secondary/30 border border-primary/10 hover:border-primary/30 transition-colors"
    >
      <div className="grid grid-cols-14 gap-2 items-center p-3">
        {/* Drag Handle */}
        <div className="col-span-1 flex justify-center">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        </div>
        
        {/* SKU with autocomplete */}
        <div className="col-span-2 relative">
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
              className="absolute z-50 w-80 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
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
        <div className="col-span-3 relative">
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
              className="absolute z-50 w-80 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
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
        <div className="col-span-1">
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
        <div className="col-span-1">
          <Input
            type="number"
            min="1"
            placeholder="MOQ"
            value={item.moq || ''}
            onChange={(e) => onUpdate(item.id, { moq: parseInt(e.target.value) || 1 })}
            className="input-focus text-center bg-background/50 border-primary/20"
          />
        </div>
        
        {/* Unit Price - supports expressions like 56.75*2 */}
        <div className="col-span-2">
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
        <div className="col-span-1">
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
        
        {/* Total */}
        <div className="col-span-1 text-right font-mono font-medium text-primary glow-text whitespace-nowrap">
          {formatCurrency(calculateLineTotal(item), currency)}
        </div>
        
        {/* Actions - moved to separate column with no overlap */}
        <div className="col-span-2 flex justify-end gap-0.5 pl-4">
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

      {/* Notes Section */}
      {showNotes && (
        <div className="px-3 pb-3 pt-0">
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
        </div>
      )}
    </div>
  );
};
