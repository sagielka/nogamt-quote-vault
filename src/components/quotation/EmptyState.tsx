import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreateNew: () => void;
}

export const EmptyState = ({ onCreateNew }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <FileText className="w-10 h-10 text-primary" />
      </div>
      <h2 className="heading-display text-2xl text-foreground mb-2">No Quotations Yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Create your first quotation to get started. You can add line items, set tax rates, and send professional quotes to your clients.
      </p>
      <Button onClick={onCreateNew} size="lg">
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Quotation
      </Button>
    </div>
  );
};
