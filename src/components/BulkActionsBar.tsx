import { useState } from 'react';
import { Quotation } from '@/types/quotation';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Archive, Send, CheckCircle, Ban, Download, ChevronDown, X, Loader2 } from 'lucide-react';
import { downloadQuotationPdf } from '@/lib/pdf-generator';
import { useToast } from '@/hooks/use-toast';

interface BulkActionsBarProps {
  selectedIds: string[];
  quotations: Quotation[];
  onClearSelection: () => void;
  onStatusChange: (ids: string[], status: string) => Promise<void>;
  onArchive: (ids: string[]) => Promise<void>;
}

export const BulkActionsBar = ({
  selectedIds,
  quotations,
  onClearSelection,
  onStatusChange,
  onArchive,
}: BulkActionsBarProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const handleExportPdfs = async () => {
    setExporting(true);
    let successCount = 0;
    const selected = quotations.filter(q => selectedIds.includes(q.id));

    for (const quotation of selected) {
      const result = await downloadQuotationPdf(quotation);
      if (result.success) successCount++;
    }

    toast({
      title: 'Export Complete',
      description: `Downloaded ${successCount} of ${selected.length} PDFs.`,
    });
    setExporting(false);
  };

  const handleBulkStatusChange = async (status: string) => {
    await onStatusChange(selectedIds, status);
    setStatusConfirm(null);
    onClearSelection();
  };

  const handleBulkArchive = async () => {
    await onArchive(selectedIds);
    setArchiveConfirm(false);
    onClearSelection();
  };

  return (
    <>
      <div className="sticky top-16 z-10 flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur animate-fade-in">
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedIds.length} selected
        </Badge>

        <div className="flex-1 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Change Status
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusConfirm('sent')}>
                <Send className="w-3.5 h-3.5 mr-2" /> Mark as Sent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusConfirm('accepted')}>
                <CheckCircle className="w-3.5 h-3.5 mr-2" /> Mark as Accepted
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusConfirm('finished')}>
                <Ban className="w-3.5 h-3.5 mr-2" /> Mark as Finished
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveConfirm(true)}
          >
            <Archive className="w-3.5 h-3.5 mr-2" /> Archive
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdfs}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-2" />
            )}
            Export PDFs
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Change Confirmation */}
      <AlertDialog open={!!statusConfirm} onOpenChange={(open) => !open && setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status of {selectedIds.length} quotation{selectedIds.length > 1 ? 's' : ''} to "{statusConfirm}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => statusConfirm && handleBulkStatusChange(statusConfirm)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.length} Quotations?</AlertDialogTitle>
            <AlertDialogDescription>
              These quotations will be moved to the archive. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkArchive} className="bg-destructive hover:bg-destructive/90">
              Archive All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
