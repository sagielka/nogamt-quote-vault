import { useState } from 'react';
import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatCurrency, formatDate, calculateTotal, getStatusColor } from '@/lib/quotation-utils';
import { downloadQuotationPdf, getQuotationPdfBase64 } from '@/lib/pdf-generator';
import { formatDate as formatDateUtil } from '@/lib/quotation-utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Trash2, Calendar, User, Pencil, Copy, Download, Loader2, Mail, CheckCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuotationCardProps {
  quotation: Quotation;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

const canSendReminder = (reminderSentAt?: string | Date): boolean => {
  if (!reminderSentAt) return true;
  return Date.now() - new Date(reminderSentAt).getTime() >= REMINDER_COOLDOWN_MS;
};

const getDaysUntilReminder = (reminderSentAt?: string | Date): number => {
  if (!reminderSentAt) return 0;
  const elapsed = Date.now() - new Date(reminderSentAt).getTime();
  return Math.ceil((REMINDER_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
};

export const QuotationCard = ({ quotation, onView, onEdit, onDelete, onDuplicate }: QuotationCardProps) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    
    toast({
      title: 'Generating PDF...',
      description: 'Please wait while the PDF is being created.',
    });

    const result = await downloadQuotationPdf(quotation);
    
    setIsDownloading(false);
    
    if (result.success) {
      toast({
        title: 'PDF Downloaded',
        description: `${result.fileName} has been saved.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSendReminder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSendingReminder(true);

    toast({
      title: 'Sending reminder...',
      description: `Generating PDF and emailing ${quotation.clientEmail}`,
    });

    try {
      const { base64 } = await getQuotationPdfBase64(quotation);
      const totalFormatted = formatCurrency(total, quotation.currency);
      const validUntil = formatDateUtil(quotation.validUntil);

      const { data, error } = await supabase.functions.invoke('send-quotation-email', {
        body: {
          to: quotation.clientEmail,
          clientName: quotation.clientName,
          quoteNumber: quotation.quoteNumber,
          total: totalFormatted,
          validUntil,
          pdfBase64: base64,
          isReminder: true,
        },
      });

      if (error) throw error;

      // Check if the response indicates unsubscribed
      if (data?.unsubscribed) {
        toast({
          title: 'Email Unsubscribed',
          description: `${quotation.clientEmail} has unsubscribed from emails.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Reminder Sent',
        description: `Follow-up email sent to ${quotation.clientEmail}.`,
      });
    } catch (err) {
      console.error('Failed to send reminder:', err);
      toast({
        title: 'Error',
        description: 'Failed to send reminder email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  return (
    <Card className="card-elevated hover:shadow-prominent transition-shadow duration-200 animate-fade-in">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: quote info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-foreground text-sm truncate">
                  {quotation.quoteNumber}
                </h3>
                {quotation.status !== 'draft' && (
                  <Badge className={`${getStatusColor(quotation.status)} text-xs`} variant="secondary">
                    {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1 truncate">
                  <User className="w-3 h-3 shrink-0" />
                  {quotation.clientName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0" />
                  {formatDate(quotation.createdAt)}
                </span>
                <span>{quotation.items.length} item{quotation.items.length !== 1 ? 's' : ''}</span>
                {quotation.reminderSentAt && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Mail className="w-3 h-3 shrink-0" />
                    Reminded {formatDate(quotation.reminderSentAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: total + actions */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-base font-semibold text-primary whitespace-nowrap">
              {formatCurrency(total, quotation.currency)}
            </span>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(quotation.id)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(quotation.id)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(quotation.id)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </Button>
              {quotation.status === 'accepted' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-green-600 cursor-default pointer-events-none"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-50">Order already accepted — no reminder needed</TooltipContent>
                </Tooltip>
              ) : !canSendReminder(quotation.reminderSentAt) ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-50">Reminder cooldown: {getDaysUntilReminder(quotation.reminderSentAt)} day(s) remaining</TooltipContent>
                </Tooltip>
              ) : (
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          disabled={isSendingReminder}
                        >
                          {isSendingReminder ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Send reminder email</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send Reminder Email?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will send a follow-up email with the quotation PDF to <strong>{quotation.clientEmail}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSendReminder}>
                        Send Reminder
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{quotation.quoteNumber}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(quotation.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
