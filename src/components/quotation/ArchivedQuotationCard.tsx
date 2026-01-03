import { ArchivedQuotation } from '@/hooks/useArchivedQuotations';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Archive, RotateCcw, Trash2, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

interface ArchivedQuotationCardProps {
  quotation: ArchivedQuotation;
  isAdmin: boolean;
  onRestore: (quotation: ArchivedQuotation) => void;
  onPermanentDelete: (id: string) => void;
}

export const ArchivedQuotationCard = ({
  quotation,
  isAdmin,
  onRestore,
  onPermanentDelete,
}: ArchivedQuotationCardProps) => {
  // Calculate subtotal using moq as quantity
  const subtotal = quotation.items.reduce(
    (sum, item) => sum + item.unitPrice * item.moq,
    0
  );
  return (
    <Card className="group hover:shadow-md transition-shadow border-dashed border-muted-foreground/30 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm text-muted-foreground">
                {quotation.quoteNumber}
              </span>
            </div>
            <h3 className="font-semibold text-foreground">{quotation.clientName}</h3>
          </div>
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            Archived
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="truncate">{quotation.clientEmail}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Archived {format(quotation.archivedAt, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-xs">{quotation.items.length} item(s)</span>
            <span className="font-medium text-foreground">
              {quotation.currency} {subtotal.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onRestore(quotation)}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restore
        </Button>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete quotation <strong>{quotation.quoteNumber}</strong>.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onPermanentDelete(quotation.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
};
