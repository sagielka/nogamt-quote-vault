import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateTotal, calculateSubtotal, calculateDiscount, calculateTax, calculateLineTotal, formatDate } from '@/lib/quotation-utils';
import { CheckCircle, XCircle, FileText, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.jpg';

const CustomerPortal = () => {
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loadPortal = async () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const tokenValue = params.get('token');

      if (!tokenValue) {
        setError('Invalid or missing portal link.');
        setLoading(false);
        return;
      }

      try {
        // Fetch token info (anon access)
        const { data: tokenData, error: tokenError } = await supabase
          .from('customer_portal_tokens' as any)
          .select('*')
          .eq('token', tokenValue)
          .eq('is_active', true)
          .single() as any;

        if (tokenError || !tokenData) {
          setError('This portal link is invalid, expired, or has been deactivated.');
          setLoading(false);
          return;
        }

        if (new Date(tokenData.expires_at) < new Date()) {
          setError('This portal link has expired.');
          setLoading(false);
          return;
        }

        setToken(tokenData);

        if (tokenData.client_response) {
          setSubmitted(true);
        }

        // Fetch quotation (anon access via RLS that checks active token)
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotations')
          .select('*')
          .eq('id', tokenData.quotation_id)
          .single();

        if (quoteError || !quoteData) {
          setError('Unable to load quotation details.');
          setLoading(false);
          return;
        }

        setQuotation(quoteData);
      } catch {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    loadPortal();
  }, []);

  const handleRespond = async (response: 'accepted' | 'declined') => {
    if (!token) return;
    setResponding(true);
    try {
      await (supabase.from('customer_portal_tokens' as any).update({
        client_response: response,
        client_response_at: new Date().toISOString(),
        client_comment: comment || null,
      } as any).eq('id', token.id) as any);

      setSubmitted(true);
      setToken({ ...token, client_response: response });
    } catch {
      // ignore
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Portal Not Available</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quotation) return null;

  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, quotation.discount_type || 'percentage', quotation.discount_value || 0);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, quotation.tax_rate || 0);
  const total = calculateTotal(items, quotation.tax_rate || 0, quotation.discount_type || 'percentage', quotation.discount_value || 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container py-4 flex items-center justify-between">
          <img src={logo} alt="Logo" className="h-10 w-auto" />
          <Badge variant="outline">Customer Portal</Badge>
        </div>
      </header>

      <main className="container py-8 max-w-3xl mx-auto">
        {submitted && (
          <div className={`mb-6 p-4 rounded-lg border ${
            token?.client_response === 'accepted'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              {token?.client_response === 'accepted' ? (
                <><CheckCircle className="w-5 h-5" /> You have accepted this quotation.</>
              ) : (
                <><XCircle className="w-5 h-5" /> You have declined this quotation.</>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-primary mb-2 text-center">
              QUOTATION {quotation.quote_number}
            </h1>
            <div className="flex justify-between text-sm text-muted-foreground mb-6">
              <span>Created: {formatDate(new Date(quotation.created_at))}</span>
              <span>Valid Until: {formatDate(new Date(quotation.valid_until))}</span>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-medium text-muted-foreground mb-1">PREPARED FOR</h2>
              <p className="font-semibold">{quotation.client_name}</p>
              <p className="text-muted-foreground">{quotation.client_email}</p>
              {quotation.client_address && (
                <p className="text-muted-foreground whitespace-pre-line">{quotation.client_address}</p>
              )}
            </div>

            <table className="w-full mb-6">
              <thead>
                <tr className="border-b-2">
                  <th className="text-left py-2 text-sm text-muted-foreground">#</th>
                  <th className="text-left py-2 text-sm text-muted-foreground">SKU</th>
                  <th className="text-left py-2 text-sm text-muted-foreground">Description</th>
                  <th className="text-center py-2 text-sm text-muted-foreground">MOQ</th>
                  <th className="text-right py-2 text-sm text-muted-foreground">Unit Price</th>
                  <th className="text-right py-2 text-sm text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 font-mono text-sm">{item.sku || '—'}</td>
                    <td className="py-2">{item.description || '—'}</td>
                    <td className="py-2 text-center">{item.moq || 1}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice || 0, quotation.currency)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(calculateLineTotal(item), quotation.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal, quotation.currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">-{formatCurrency(discount, quotation.currency)}</span>
                  </div>
                )}
                {quotation.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({quotation.tax_rate}%)</span>
                    <span>{formatCurrency(tax, quotation.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-2 border-t-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total, quotation.currency)}</span>
                </div>
              </div>
            </div>

            {quotation.notes && (
              <div className="mb-6 pt-4 border-t">
                <h2 className="text-sm font-medium text-muted-foreground mb-1">NOTES</h2>
                <p className="text-muted-foreground whitespace-pre-line">{quotation.notes}</p>
              </div>
            )}

            {/* Response Section */}
            {!submitted && (
              <div className="pt-6 border-t space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground">YOUR RESPONSE</h2>
                <Textarea
                  placeholder="Add a comment (optional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleRespond('declined')}
                    disabled={responding}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleRespond('accepted')}
                    disabled={responding}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {responding ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Accept Quotation
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <footer className="text-center mt-8 text-xs text-muted-foreground">
          <p className="font-semibold">Noga Engineering & Technology Ltd.</p>
          <p>Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
        </footer>
      </main>
    </div>
  );
};

export default CustomerPortal;
