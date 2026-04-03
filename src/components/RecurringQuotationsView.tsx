import { useState, useEffect } from 'react';
import { useRecurringQuotations, RecurringQuotation } from '@/hooks/useRecurringQuotations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RepeatIcon, Trash2, Calendar, User, Clock } from 'lucide-react';
import { formatCurrency, calculateTotal } from '@/lib/quotation-utils';
import { useToast } from '@/hooks/use-toast';

interface RecurringQuotationsViewProps {
  onBack: () => void;
}

export const RecurringQuotationsView = ({ onBack }: RecurringQuotationsViewProps) => {
  const { recurring, loading, toggleActive, deleteRecurring } = useRecurringQuotations();
  const { toast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleActive(id, isActive);
    toast({
      title: isActive ? 'Schedule Activated' : 'Schedule Paused',
      description: isActive ? 'Recurring quotes will be generated on schedule.' : 'Quote generation paused.',
    });
  };

  const handleDelete = async (id: string) => {
    await deleteRecurring(id);
    toast({ title: 'Deleted', description: 'Recurring schedule removed.' });
    setDeleteConfirmId(null);
  };

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      default: return freq;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RepeatIcon className="w-6 h-6 text-primary" />
          <h2 className="heading-display text-2xl text-foreground">Recurring Quotations</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {recurring.length} schedule{recurring.length !== 1 ? 's' : ''}
        </p>
      </div>

      {recurring.length === 0 ? (
        <div className="text-center py-12">
          <RepeatIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No recurring schedules</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create a recurring schedule from any quotation to auto-generate quotes on a regular basis.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {recurring.map((item) => {
            const total = calculateTotal(
              item.template_items || [],
              item.tax_rate,
              (item.discount_type as any) || 'percentage',
              item.discount_value || 0
            );

            return (
              <Card key={item.id} className="card-elevated">
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm truncate">
                            {item.client_name}
                          </h3>
                          <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                            {item.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatFrequency(item.frequency)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.client_email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Next: {formatDate(item.next_run_at)}
                          </span>
                          {item.last_run_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last: {formatDate(item.last_run_at)}
                            </span>
                          )}
                          <span>{(item.template_items || []).length} items</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-semibold text-primary whitespace-nowrap">
                        {formatCurrency(total, item.currency as any)}
                      </span>
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => handleToggle(item.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this recurring quotation schedule. Generated quotes will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
