import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

interface CustomerEmailPickerProps {
  selectedEmails: string[];
  onEmailsChange: (emails: string[]) => void;
  /** Emails that should appear as checkboxes above the picker (e.g. quotation client emails) */
  excludeFromSuggestions?: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CustomerEmailPicker = ({ selectedEmails, onEmailsChange, excludeFromSuggestions = [] }: CustomerEmailPickerProps) => {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch customers matching search
  const searchCustomers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      let qb = supabase.from('customers').select('id, name, email, address');
      if (q.trim()) {
        const pattern = `%${q.trim()}%`;
        qb = qb.or(`name.ilike.${pattern},email.ilike.${pattern},address.ilike.${pattern}`);
      }
      const { data } = await qb.order('name').limit(50);
      setCustomers((data || []).filter(c => c.email && c.email.trim()));
    } catch {
      setCustomers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showDropdown) searchCustomers(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, showDropdown, searchCustomers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !selectedEmails.includes(trimmed)) {
      onEmailsChange([...selectedEmails, trimmed]);
    }
  };

  const removeEmail = (email: string) => {
    onEmailsChange(selectedEmails.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = query.trim();
      if (val && EMAIL_REGEX.test(val) && !selectedEmails.includes(val.toLowerCase())) {
        addEmail(val);
        setQuery('');
      }
    }
  };

  // Extract country from address (last part after comma)
  const getCountry = (address: string | null) => {
    if (!address) return null;
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : null;
  };

  // Manually added emails (selected but not from quotation's client emails)
  const manuallyAdded = selectedEmails.filter(
    e => !excludeFromSuggestions.map(x => x.toLowerCase()).includes(e.toLowerCase())
  );

  // Expand all emails from a customer (may have comma-separated)
  const getCustomerEmails = (customer: Customer): string[] => {
    return customer.email.split(',').map(e => e.trim().toLowerCase()).filter(e => e && EMAIL_REGEX.test(e));
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Users className="w-3 h-3" />
        <span>Choose from Customers</span>
      </div>

      {/* Selected chips */}
      {manuallyAdded.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {manuallyAdded.map(email => (
            <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs">
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search customers or enter email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="text-sm pl-8"
        />

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground text-center">Loading…</div>
            ) : customers.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">
                {query.trim()
                  ? 'No matching customer found. You can still enter the email manually.'
                  : 'Type to search customers…'}
              </div>
            ) : (
              customers.map(customer => {
                const emails = getCustomerEmails(customer);
                const country = getCountry(customer.address);
                const allSelected = emails.every(e => selectedEmails.includes(e));

                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0",
                      allSelected && "opacity-50"
                    )}
                    onClick={() => {
                      emails.forEach(e => addEmail(e));
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    disabled={allSelected}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground truncate">{customer.name}</span>
                      {country && (
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{country}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{customer.email}</div>
                    {allSelected && <span className="text-xs text-primary">Already added</span>}
                  </button>
                );
              })
            )}

            {/* Manual email hint */}
            {query.trim() && EMAIL_REGEX.test(query.trim()) && !selectedEmails.includes(query.trim().toLowerCase()) && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-t border-border/30"
                onClick={() => {
                  addEmail(query.trim());
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <div className="text-sm text-foreground">
                  Add <span className="font-medium">{query.trim()}</span>
                </div>
                <div className="text-xs text-muted-foreground">Manual email address</div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
