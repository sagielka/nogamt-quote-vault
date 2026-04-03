import { useState, useEffect, useCallback } from 'react';
import { QuotationVersion, useQuotationVersions } from '@/hooks/useQuotationVersions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Eye, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, calculateTotal, calculateSubtotal } from '@/lib/quotation-utils';

interface VersionHistoryProps {
  quotationId: string;
  userNameMap?: Record<string, string>;
  onRestore?: (version: QuotationVersion) => void;
}

export const VersionHistory = ({ quotationId, userNameMap = {}, onRestore }: VersionHistoryProps) => {
  const { versions, loading, fetchVersions } = useQuotationVersions();
  const [expanded, setExpanded] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<QuotationVersion | null>(null);

  useEffect(() => {
    fetchVersions(quotationId);
  }, [quotationId, fetchVersions]);

  const getUserName = (userId: string) => userNameMap[userId] || userId.slice(0, 6);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        Loading versions...
      </div>
    );
  }

  if (versions.length === 0) return null;

  return (
    <div className="pt-6 border-t no-print">
      <button
        className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          VERSION HISTORY ({versions.length})
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {versions.map((version) => {
              const items = Array.isArray(version.items) ? version.items : [];
              const total = calculateTotal(
                items,
                Number(version.tax_rate) || 0,
                (version.discount_type as any) || 'percentage',
                Number(version.discount_value) || 0
              );

              return (
                <div
                  key={version.id}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs font-mono">
                      v{version.version_number}
                    </Badge>
                    <div>
                      <span className="text-foreground font-medium">
                        {getUserName(version.changed_by)}
                      </span>
                      {version.change_summary && (
                        <span className="text-muted-foreground ml-2">
                          — {version.change_summary}
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {items.length} items · {formatCurrency(total, version.currency as any)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(version.created_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setViewingVersion(version)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    {onRestore && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-primary hover:text-primary"
                        onClick={() => onRestore(version)}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Version Detail Dialog */}
      <Dialog open={!!viewingVersion} onOpenChange={(open) => !open && setViewingVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Version {viewingVersion?.version_number} Details
            </DialogTitle>
          </DialogHeader>
          {viewingVersion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Client:</span>{' '}
                  <span className="font-medium">{viewingVersion.client_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">{viewingVersion.client_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency:</span>{' '}
                  <span className="font-medium">{viewingVersion.currency}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Changed by:</span>{' '}
                  <span className="font-medium">{getUserName(viewingVersion.changed_by)}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Line Items</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-1">SKU</th>
                      <th className="text-left py-1">Description</th>
                      <th className="text-right py-1">MOQ</th>
                      <th className="text-right py-1">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(viewingVersion.items) ? viewingVersion.items : []).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-1 font-mono">{item.sku || '—'}</td>
                        <td className="py-1">{item.description || '—'}</td>
                        <td className="py-1 text-right">{item.moq || 1}</td>
                        <td className="py-1 text-right">
                          {formatCurrency(item.unitPrice || 0, viewingVersion.currency as any)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewingVersion.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                  <p className="text-sm whitespace-pre-line">{viewingVersion.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
