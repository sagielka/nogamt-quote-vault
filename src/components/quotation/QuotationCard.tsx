import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, calculateTotal, getStatusColor } from '@/lib/quotation-utils';
import { Eye, Trash2, Calendar, User, Pencil } from 'lucide-react';

interface QuotationCardProps {
  quotation: Quotation;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const QuotationCard = ({ quotation, onView, onEdit, onDelete }: QuotationCardProps) => {
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

  return (
    <Card className="card-elevated hover:shadow-prominent transition-shadow duration-200 animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">
              {quotation.quoteNumber}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <User className="w-3.5 h-3.5" />
              {quotation.clientName}
            </div>
          </div>
          <Badge className={getStatusColor(quotation.status)} variant="secondary">
            {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Created {formatDate(quotation.createdAt)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {quotation.items.length} item{quotation.items.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-xl font-semibold text-primary">
            {formatCurrency(total, quotation.currency)}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onView(quotation.id)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(quotation.id)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(quotation.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
