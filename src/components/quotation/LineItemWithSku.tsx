import { useState, useRef, useEffect } from 'react';
import { LineItem } from '@/types/quotation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatCurrency, calculateLineTotal } from '@/lib/quotation-utils';
import { searchProducts, ProductItem, PriceList, getProductPrice } from '@/data/product-catalog';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const handleSkuChange = (value: string) => {
    onUpdate(item.id, { sku: value });
    const results = searchProducts(value);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setHighlightedIndex(-1);
  };

  const handleSelectSuggestion = (product: ProductItem) => {
    const price = getProductPrice(product.sku, priceList);
    onUpdate(item.id, { 
      sku: product.sku, 
      description: product.description,
      unitPrice: price ?? 0
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center animate-fade-in p-3 rounded-lg bg-secondary/30 border border-primary/10 hover:border-primary/30 transition-colors">
      {/* SKU with autocomplete */}
      <div className="md:col-span-2 relative">
        <Input
          ref={inputRef}
          placeholder="Type SKU..."
          value={item.sku || ''}
          onChange={(e) => handleSkuChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          className="input-focus bg-background/50 border-primary/20 font-mono text-sm"
        />
        {showSuggestions && suggestions.length > 0 && (
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
      
      {/* Description */}
      <div className="md:col-span-3">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })}
          className="input-focus bg-background/50 border-primary/20"
        />
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
    </div>
  );
};
