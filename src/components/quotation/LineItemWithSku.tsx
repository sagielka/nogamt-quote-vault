import { useState, useRef, useEffect } from 'react';
import { LineItem } from '@/types/quotation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatCurrency, calculateLineTotal } from '@/lib/quotation-utils';
import { searchProducts, ProductItem, PriceList, getProductPrice, getUSSkuPrice } from '@/data/product-catalog';
import { Currency } from '@/types/quotation';

interface LineItemWithSkuProps {
  item: LineItem;
  index: number;
  currency: Currency;
  priceList: PriceList;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export const LineItemWithSku = ({
  item,
  index,
  currency,
  priceList,
  onUpdate,
  onRemove,
  canRemove,
}: LineItemWithSkuProps) => {
  const [suggestions, setSuggestions] = useState<ProductItem[]>([]);
  const [activeField, setActiveField] = useState<'sku' | 'description' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center animate-fade-in p-3 rounded-lg bg-secondary/30 border border-primary/10 hover:border-primary/30 transition-colors">
      {/* SKU with autocomplete */}
      <div className="md:col-span-2 relative">
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
      <div className="md:col-span-3 relative">
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
      <div className="md:col-span-1">
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
      <div className="md:col-span-1">
        <Input
          type="number"
          min="1"
          placeholder="MOQ"
          value={item.moq || ''}
          onChange={(e) => onUpdate(item.id, { moq: parseInt(e.target.value) || 1 })}
          className="input-focus text-center bg-background/50 border-primary/20"
        />
      </div>
      
      {/* Unit Price */}
      <div className="md:col-span-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={item.unitPrice || ''}
          onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
          className="input-focus text-right bg-background/50 border-primary/20"
        />
      </div>
      
      {/* Discount */}
      <div className="md:col-span-1">
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
      <div className="md:col-span-1 text-right font-mono font-medium text-primary glow-text">
        {formatCurrency(calculateLineTotal(item), currency)}
      </div>
      
      {/* Delete */}
      <div className="md:col-span-1 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          disabled={!canRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
