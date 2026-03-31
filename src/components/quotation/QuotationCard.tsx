import { useState } from 'react';
import { Quotation } from '@/types/quotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Eye, Trash2, Calendar, User, Pencil, Copy, Download, Loader2, Mail, CheckCircle, Circle, BellRing, MailOpen, UserPen, Ban, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuotationCardProps {
  quotation: Quotation;
  index?: number;
  creatorName?: string;
  userList?: { id: string; name: string }[];
  emailReadAt?: string | null;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onStatusChange?: (id: string, status: Quotation['status']) => void;
  onCreatorChange?: (id: string, newUserId: string) => void;
  onEditCustomer?: (id: string, data: { clientName: string; clientEmail: string; clientAddress: string }) => void;
}

const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week after creation
const MAX_AGE_MS = 6 * 7 * 24 * 60 * 60 * 1000; // 6 weeks after creation

const canSendReminder = (createdAt: Date | string, reminderSentAt?: string | Date | null): boolean => {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age < MIN_AGE_MS || age > MAX_AGE_MS) return false;
  if (!reminderSentAt) return true;
  return Date.now() - new Date(reminderSentAt).getTime() >= REMINDER_COOLDOWN_MS;
};

const getReminderBlockReason = (createdAt: Date | string, reminderSentAt?: string | Date | null): string | null => {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age < MIN_AGE_MS) {
    const daysLeft = Math.ceil((MIN_AGE_MS - age) / (24 * 60 * 60 * 1000));
    return `Too early — wait ${daysLeft} day(s) before sending a reminder`;
  }
  if (age > MAX_AGE_MS) return 'Quote is older than 6 weeks — reminders disabled';
  if (reminderSentAt) {
    const elapsed = Date.now() - new Date(reminderSentAt).getTime();
    if (elapsed < REMINDER_COOLDOWN_MS) {
      const daysLeft = Math.ceil((REMINDER_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
      return `Reminder cooldown: ${daysLeft} day(s) remaining`;
    }
  }
  return null;
};

export const QuotationCard = ({ quotation, index, creatorName, userList, emailReadAt, onView, onEdit, onDelete, onDuplicate, onStatusChange, onCreatorChange, onEditCustomer }: QuotationCardProps) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedReminderRecipients, setSelectedReminderRecipients] = useState<string[]>([]);
  const [additionalReminderEmail, setAdditionalReminderEmail] = useState('');
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editClientName, setEditClientName] = useState(quotation.clientName);
  const [editClientEmail, setEditClientEmail] = useState(quotation.clientEmail);
  const [editClientAddress, setEditClientAddress] = useState(quotation.clientAddress);
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

    const emailsToSend = selectedReminderRecipients;
    toast({
      title: 'Sending reminder...',
      description: `Generating PDF and emailing ${emailsToSend.join(', ')}`,
    });

    try {
      const { base64 } = await getQuotationPdfBase64(quotation);
      const totalFormatted = formatCurrency(total, quotation.currency);
      const validUntil = formatDateUtil(quotation.validUntil);

      // Send individual emails per recipient for privacy and validation
      const results = await Promise.allSettled(
        emailsToSend.map(email =>
          supabase.functions.invoke('send-quotation-email', {
            body: {
              to: email.trim(),
              clientName: quotation.clientName,
              quoteNumber: quotation.quoteNumber,
              total: totalFormatted,
              validUntil,
              pdfBase64: base64,
              isReminder: true,
            },
          })
        )
      );

      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
      const unsubscribed = results.filter(r => r.status === 'fulfilled' && r.value.data?.unsubscribed);

      if (unsubscribed.length > 0) {
        toast({
          title: 'Email Unsubscribed',
          description: `Some recipients have unsubscribed from emails.`,
          variant: 'destructive',
        });
      }

      if (failed.length === emailsToSend.length) {
        throw new Error('All emails failed to send');
      }

      const successCount = emailsToSend.length - failed.length - unsubscribed.length;
      if (successCount > 0) {
        toast({
          title: 'Reminder Sent',
          description: `Follow-up email sent to ${successCount} recipient(s).`,
        });
      }

      // Auto-update status to 'sent' if currently 'draft'
      if (quotation.status === 'draft' && onStatusChange) {
        onStatusChange(quotation.id, 'sent');
      }

      // Persist any manually-added emails back to the customer record
      try {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, email')
          .ilike('name', quotation.clientName)
          .limit(1);
        if (customers && customers.length > 0) {
          const customer = customers[0];
          const existingEmails = customer.email.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
          const newEmails = selectedReminderRecipients.filter(e => !existingEmails.includes(e.toLowerCase()));
          if (newEmails.length > 0) {
            const updatedEmail = [...existingEmails, ...newEmails.map(e => e.toLowerCase())].join(', ');
            await supabase.from('customers').update({ email: updatedEmail }).eq('id', customer.id);
            toast({
              title: 'Customer Updated',
              description: `Added ${newEmails.join(', ')} to ${quotation.clientName}'s record.`,
            });
          }
        }
      } catch (persistErr) {
        console.error('Failed to persist new emails to customer:', persistErr);
      }
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
    <Card className="card-elevated hover:shadow-prominent transition-shadow duration-200 animate-fade-in cursor-pointer" onClick={() => onView(quotation.id)}>
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: quote info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {index !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground min-w-[2ch] text-right">{index}</span>
                )}
                <h3 className="font-display font-semibold text-foreground text-sm truncate">
                  {quotation.quoteNumber}
                </h3>
                <Badge className={`${getStatusColor(quotation.status)} text-xs`} variant="secondary">
                  {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span 
                  className="flex items-center gap-1 truncate cursor-pointer hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditClientName(quotation.clientName);
                    setEditClientEmail(quotation.clientEmail);
                    setEditClientAddress(quotation.clientAddress);
                    setEditCustomerOpen(true);
                  }}
                >
                  <User className="w-3 h-3 shrink-0" />
                  {quotation.clientName}
                  <UserPen className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0" />
                  {formatDate(quotation.createdAt)}
                </span>
                <span>{quotation.items.length} item{quotation.items.length !== 1 ? 's' : ''}</span>
                {creatorName && (
                  onCreatorChange && userList && userList.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-0.5 text-muted-foreground/70 hover:text-foreground hover:underline cursor-pointer bg-transparent border-none p-0 text-xs">
                          by {creatorName}
                          <Pencil className="w-2.5 h-2.5 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {userList.map((u) => (
                          <DropdownMenuItem
                            key={u.id}
                            onClick={() => onCreatorChange(quotation.id, u.id)}
                            className={u.id === quotation.userId ? 'font-semibold' : ''}
                          >
                            {u.name} {u.id === quotation.userId && '✓'}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-muted-foreground/70">by {creatorName}</span>
                  )
                )}
                {quotation.status !== 'accepted' && quotation.status !== 'finished' && canSendReminder(quotation.createdAt, quotation.reminderSentAt) && (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    <Mail className="w-3 h-3 shrink-0 animate-pulse" />
                    Needs Reminder
                  </span>
                )}
                {quotation.status !== 'accepted' && quotation.status !== 'finished' && !quotation.reminderSentAt && (() => {
                  const age = Date.now() - new Date(quotation.createdAt).getTime();
                  if (age < MIN_AGE_MS) {
                    const daysLeft = Math.ceil((MIN_AGE_MS - age) / (24 * 60 * 60 * 1000));
                    return (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        Reminder in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                      </span>
                    );
                  }
                  return null;
                })()}
                {quotation.reminderSentAt && (() => {
                  const nextReminderDate = new Date(new Date(quotation.reminderSentAt).getTime() + REMINDER_COOLDOWN_MS);
                  const maxDate = new Date(new Date(quotation.createdAt).getTime() + MAX_AGE_MS);
                  const isExpired = nextReminderDate > maxDate;
                  return (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Mail className="w-3 h-3 shrink-0" />
                      Reminded {formatDate(quotation.reminderSentAt)}
                      {quotation.status !== 'accepted' && (
                        isExpired
                          ? <span className="text-muted-foreground ml-1">· No more reminders</span>
                          : <span className="text-muted-foreground ml-1">· Next: {formatDate(nextReminderDate)}</span>
                      )}
                    </span>
                  );
                })()}
                {quotation.followUpNotifiedAt && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <BellRing className="w-3 h-3 shrink-0" />
                    Notified {formatDate(quotation.followUpNotifiedAt)}
                  </span>
                )}
                {emailReadAt && (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <MailOpen className="w-3 h-3 shrink-0" />
                    📧 Read {formatDate(new Date(emailReadAt))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: total + actions */}
          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
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
              {/* Mark as Sent for drafts */}
              {quotation.status === 'draft' && (
                <AlertDialog>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Mark as sent</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mark as Sent?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will update "{quotation.quoteNumber}" status from Draft to Sent.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onStatusChange?.(quotation.id, 'sent')}>
                        Mark as Sent
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {/* Order received toggle */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-7 w-7 ${quotation.status === 'accepted' ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-green-600'}`}
                      onClick={() => onStatusChange?.(quotation.id, quotation.status === 'accepted' ? 'sent' : 'accepted')}
                    >
                      {quotation.status === 'accepted' ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {quotation.status === 'accepted' ? 'Order received — click to unmark' : 'Mark as order received'}
                </TooltipContent>
              </Tooltip>
               {/* Mark as finished (no order) */}
               <AlertDialog>
                 <Tooltip delayDuration={0}>
                   <TooltipTrigger asChild>
                     <AlertDialogTrigger asChild>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className={`h-7 w-7 ${quotation.status === 'finished' ? 'bg-orange-500 text-white hover:bg-orange-600 rounded-md' : 'text-muted-foreground hover:text-orange-500'}`}
                       >
                         <Ban className="w-3.5 h-3.5" />
                       </Button>
                     </AlertDialogTrigger>
                   </TooltipTrigger>
                   <TooltipContent side="top">
                     {quotation.status === 'finished' ? 'Closed (no order) — click to reopen' : 'Mark as finished (no order)'}
                   </TooltipContent>
                 </Tooltip>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>
                       {quotation.status === 'finished' ? 'Reopen Quotation?' : 'Mark as Finished?'}
                     </AlertDialogTitle>
                     <AlertDialogDescription>
                       {quotation.status === 'finished' 
                         ? `This will reopen "${quotation.quoteNumber}" and set its status back to sent.`
                         : `This will mark "${quotation.quoteNumber}" as finished (no order received). Automated reminders will be disabled.`
                       }
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction
                       onClick={() => onStatusChange?.(quotation.id, quotation.status === 'finished' ? 'sent' : 'finished')}
                       className={quotation.status === 'finished' ? '' : 'bg-orange-500 hover:bg-orange-600'}
                     >
                       {quotation.status === 'finished' ? 'Reopen' : 'Mark as Finished'}
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
              {/* Reminder email */}
              {(quotation.status === 'accepted' || quotation.status === 'finished') ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground opacity-50 pointer-events-none"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {quotation.status === 'accepted' ? 'Order already received — no reminder needed' : 'Quote finished — no reminder needed'}
                  </TooltipContent>
                </Tooltip>
              ) : !canSendReminder(quotation.createdAt, quotation.reminderSentAt) ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground opacity-50 pointer-events-none"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{getReminderBlockReason(quotation.createdAt, quotation.reminderSentAt)}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        disabled={isSendingReminder}
                        onClick={(e) => {
                          e.stopPropagation();
                          const allEmails = quotation.clientEmail.split(',').map(em => em.trim()).filter(Boolean);
                          setSelectedReminderRecipients(allEmails);
                          setReminderDialogOpen(true);
                        }}
                      >
                        {isSendingReminder ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Send reminder email</TooltipContent>
                  </Tooltip>
                </>
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

      {/* Edit Customer Dialog */}
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-client-name">Name</Label>
              <Input id="edit-client-name" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-email">Email(s)</Label>
              <Input
                id="edit-client-email"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
                placeholder="email@example.com, another@example.com"
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
              {editClientEmail && (() => {
                const invalid = editClientEmail.split(',').map(e => e.trim()).filter(e => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                return invalid.length > 0 ? (
                  <p className="text-xs text-destructive">Invalid: {invalid.join(', ')}</p>
                ) : null;
              })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-address">Address</Label>
              <Input id="edit-client-address" value={editClientAddress} onChange={(e) => setEditClientAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomerOpen(false)}>Cancel</Button>
            <Button
              disabled={(() => {
                const emails = editClientEmail.split(',').map(e => e.trim()).filter(Boolean);
                return emails.length === 0 || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
              })()}
              onClick={() => {
                onEditCustomer?.(quotation.id, {
                  clientName: editClientName,
                  clientEmail: editClientEmail.split(',').map(e => e.trim()).filter(Boolean).join(', '),
                  clientAddress: editClientAddress,
                });
                setEditCustomerOpen(false);
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Recipient Selection Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Send Reminder Email?</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>This will send a follow-up email with the quotation PDF to:</p>
            <div className="bg-muted rounded-md p-3 space-y-2">
              {quotation.clientEmail.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedReminderRecipients.includes(email)}
                    onChange={(ev) => {
                      if (ev.target.checked) {
                        setSelectedReminderRecipients(prev => [...prev, email]);
                      } else {
                        setSelectedReminderRecipients(prev => prev.filter(r => r !== email));
                      }
                    }}
                    className="rounded border-input"
                  />
                  <Mail className="w-3 h-3 text-primary" />
                  <span className="text-foreground font-medium">{email}</span>
                </label>
              ))}
              {/* Show manually-added emails */}
              {selectedReminderRecipients
                .filter(r => !quotation.clientEmail.split(',').map(e => e.trim()).filter(Boolean).includes(r))
                .map((email, i) => (
                  <label key={`added-${i}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => setSelectedReminderRecipients(prev => prev.filter(r => r !== email))}
                      className="rounded border-input"
                    />
                    <Mail className="w-3 h-3 text-primary" />
                    <span className="text-foreground font-medium">{email}</span>
                    <Badge variant="outline" className="text-xs ml-1">added</Badge>
                  </label>
                ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                type="email"
                placeholder="Add email address..."
                value={additionalReminderEmail}
                onChange={(e) => setAdditionalReminderEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const email = additionalReminderEmail.trim();
                    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !selectedReminderRecipients.includes(email)) {
                      setSelectedReminderRecipients(prev => [...prev, email]);
                      setAdditionalReminderEmail('');
                    }
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!additionalReminderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(additionalReminderEmail.trim()) || selectedReminderRecipients.includes(additionalReminderEmail.trim())}
                onClick={() => {
                  const email = additionalReminderEmail.trim();
                  if (email && !selectedReminderRecipients.includes(email)) {
                    setSelectedReminderRecipients(prev => [...prev, email]);
                    setAdditionalReminderEmail('');
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedReminderRecipients.length === 0}
              onClick={(e) => {
                setReminderDialogOpen(false);
                handleSendReminder(e);
              }}
            >
              Send Reminder ({selectedReminderRecipients.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
