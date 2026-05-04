import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, formatDate, calculateSubtotal, calculateTax, calculateTotal, calculateDiscount, calculateLineTotal } from '@/lib/quotation-utils';
import { generateQuotationPdf, downloadQuotationPdf, getQuotationPdfBase64 } from '@/lib/pdf-generator';
import { formatDate as formatDateUtil } from '@/lib/quotation-utils';
import { ArrowLeft, Printer, Download, Pencil, Mail, MailOpen, Send, Eye, UserPen, ChevronDown, ChevronUp, FileText, Paperclip, Forward, Loader2, Upload, Trash2, ExternalLink, CheckCircle, Circle, Ban, Link, Copy, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { EmailTrackingRecord } from '@/hooks/useEmailTracking';
import logo from '@/assets/logo.png';
import thinkingInside from '@/assets/thinking-inside-new.png';
import OrderLinePickerDialog from '@/components/quotation/OrderLinePickerDialog';
import { CustomerEmailPicker } from '@/components/CustomerEmailPicker';
import { useCustomerPortal, PortalToken } from '@/hooks/useCustomerPortal';

// Declare electron API types
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      getAppVersion?: () => Promise<string>;
      emailWithAttachment: (
        pdfData: string,
        fileName: string,
        recipientEmail: string,
        subject: string,
        body: string
      ) => Promise<{ success: boolean; fallback?: boolean; pdfPath?: string; error?: string }>;
    };
  }
}

interface QuotationPreviewProps {
  quotation: Quotation;
  emailTracking?: EmailTrackingRecord[];
  onBack: () => void;
  onEdit?: () => void;
  onEditCustomer?: (id: string, data: { clientName: string; clientEmail: string; clientAddress: string }) => void;
  onStatusChange?: (id: string, status: string, orderedItems?: string[]) => void;
}

export const QuotationPreview = ({ quotation, emailTracking = [], onBack, onEdit, onEditCustomer, onStatusChange }: QuotationPreviewProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editClientName, setEditClientName] = useState(quotation.clientName);
  const [editClientEmail, setEditClientEmail] = useState(quotation.clientEmail);
  const [editClientAddress, setEditClientAddress] = useState(quotation.clientAddress);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const [recallConfirmId, setRecallConfirmId] = useState<string | null>(null);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [additionalEmail, setAdditionalEmail] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<any[]>([]);
  const [uploadingEmail, setUploadingEmail] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalTokens, setPortalTokens] = useState<PortalToken[]>([]);
  const [showPortalSection, setShowPortalSection] = useState(false);
  const { loading: portalLoading, generatePortalLink, getPortalTokens, deactivateToken } = useCustomerPortal();
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedReminderRecipients, setSelectedReminderRecipients] = useState<string[]>([]);
  const [additionalReminderEmail, setAdditionalReminderEmail] = useState('');

  const refreshSentEmails = useCallback(async () => {
    // Get emails for this quotation AND emails sent to this customer's email addresses
    const clientEmails = quotation.clientEmail.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    
    const { data: byQuotation } = await supabase
      .from('sent_emails')
      .select('*')
      .eq('quotation_id', quotation.id)
      .order('sent_at', { ascending: false });

    const { data: byRecipient } = await supabase
      .from('sent_emails')
      .select('*')
      .order('sent_at', { ascending: false });

    // Merge: emails linked to this quotation + emails sent to same client addresses
    const quotationEmails = byQuotation || [];
    const quotationIds = new Set(quotationEmails.map(e => e.id));
    
    const recipientEmails = (byRecipient || []).filter(e => {
      if (quotationIds.has(e.id)) return false;
      const recipients = (e.recipient_emails || []).map((r: string) => r.toLowerCase());
      return clientEmails.some(ce => recipients.includes(ce));
    });

    setSentEmails([...quotationEmails, ...recipientEmails].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    ));
  }, [quotation.id, quotation.clientEmail]);

  const refreshEmailAttachments = useCallback(async () => {
    const { data } = await supabase
      .from('quotation_email_attachments')
      .select('*')
      .eq('quotation_id', quotation.id)
      .order('uploaded_at', { ascending: false });
    if (data) setEmailAttachments(data);
  }, [quotation.id]);

  useEffect(() => {
    refreshSentEmails();
    refreshEmailAttachments();
  }, [refreshSentEmails, refreshEmailAttachments]);

  const handleUploadEmailFile = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploadingEmail(true);
    
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['eml', 'msg'].includes(ext || '')) {
          toast({ title: 'Invalid file', description: 'Only .eml and .msg files are supported.', variant: 'destructive' });
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast({ title: 'File too large', description: `${file.name} exceeds 20MB limit.`, variant: 'destructive' });
          continue;
        }

        const filePath = `${user.id}/${quotation.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('email-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('quotation_email_attachments')
          .insert({
            quotation_id: quotation.id,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
          });

        if (dbError) throw dbError;
      }

      toast({ title: 'Email(s) Attached', description: `Successfully attached ${files.length} file(s).` });
      await refreshEmailAttachments();
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload email file.', variant: 'destructive' });
    } finally {
      setUploadingEmail(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      await supabase.storage.from('email-attachments').remove([attachment.file_path]);
      await supabase.from('quotation_email_attachments').delete().eq('id', attachment.id);
      toast({ title: 'Deleted', description: 'Email attachment removed.' });
      await refreshEmailAttachments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    const { data } = await supabase.storage
      .from('email-attachments')
      .createSignedUrl(attachment.file_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const handleResendEmail = useCallback(async (email: any) => {
    setResendingId(email.id);
    try {
      const recipients = (email.recipient_emails || []).map((e: string) => ({
        email: e,
        name: quotation.clientName,
      }));

      const { data, error } = await supabase.functions.invoke('send-customer-email', {
        body: {
          recipients,
          subject: email.subject,
          message: email.body_html,
          messageHtml: email.body_html,
          cc: email.cc_emails || [],
          bcc: email.bcc_emails || [],
          quotationId: quotation.id,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email Resent',
        description: `Successfully resent to ${data?.sent || recipients.length} recipient(s).`,
      });

      await refreshSentEmails();
    } catch (err: any) {
      console.error('Resend failed:', err);
      toast({
        title: 'Resend Failed',
        description: err.message || 'Failed to resend email.',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  }, [quotation.id, quotation.clientName, toast, refreshSentEmails]);

  const handleRecallEmail = useCallback(async (email: any) => {
    setRecallingId(email.id);
    try {
      const recipients = (email.recipient_emails || []).map((e: string) => ({
        email: e,
        name: quotation.clientName,
      }));

      // Send retraction notice
      const retractionHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">⚠️ Email Recall Notice</h2>
          <p>The following email has been recalled by the sender. Please disregard it:</p>
          <div style="background: #f3f4f6; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold;">Subject: ${email.subject}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Sent: ${new Date(email.sent_at).toLocaleString()}</p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This is an automated notification from Noga M.T.</p>
        </div>
      `;

      const { error: sendError } = await supabase.functions.invoke('send-customer-email', {
        body: {
          recipients,
          subject: `⚠️ Recall: ${email.subject}`,
          message: retractionHtml,
          messageHtml: retractionHtml,
          cc: email.cc_emails || [],
          bcc: email.bcc_emails || [],
          quotationId: quotation.id,
        },
      });

      if (sendError) throw sendError;

      // Mark as recalled in database
      await (supabase.from('sent_emails' as any).update({ recalled_at: new Date().toISOString() } as any).eq('id', email.id) as any);

      toast({
        title: 'Email Recalled',
        description: `Retraction notice sent to ${recipients.length} recipient(s).`,
      });

      await refreshSentEmails();
    } catch (err: any) {
      console.error('Recall failed:', err);
      toast({
        title: 'Recall Failed',
        description: err.message || 'Failed to recall email.',
        variant: 'destructive',
      });
    } finally {
      setRecallingId(null);
      setRecallConfirmId(null);
    }
  }, [quotation.id, quotation.clientName, toast, refreshSentEmails]);

  const subtotal = calculateSubtotal(quotation.items);
  const discount = calculateDiscount(subtotal, quotation.discountType || 'percentage', quotation.discountValue || 0);
  const afterDiscount = subtotal - discount;
  const tax = calculateTax(afterDiscount, quotation.taxRate);
  const total = calculateTotal(quotation.items, quotation.taxRate, quotation.discountType, quotation.discountValue);

  const handleGeneratePortalLink = async () => {
    const token = await generatePortalLink(quotation.id);
    if (token) {
      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}#/portal?token=${token.token}`;
      setPortalLink(link);
      setShowPortalSection(true);
      await navigator.clipboard.writeText(link);
      toast({ title: 'Portal link generated & copied!', description: 'Share this link with your client.' });
      // Refresh tokens list
      const tokens = await getPortalTokens(quotation.id);
      setPortalTokens(tokens);
    } else {
      toast({ title: 'Error', description: 'Failed to generate portal link.', variant: 'destructive' });
    }
  };

  const handleLoadPortalTokens = async () => {
    const tokens = await getPortalTokens(quotation.id);
    setPortalTokens(tokens);
    setShowPortalSection(true);
  };

  const handleDeactivateToken = async (tokenId: string) => {
    await deactivateToken(tokenId);
    const tokens = await getPortalTokens(quotation.id);
    setPortalTokens(tokens);
    toast({ title: 'Token deactivated' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    toast({
      title: 'Generating PDF...',
      description: 'Please wait while the PDF is being created.',
    });

    const result = await downloadQuotationPdf(quotation);

    if (result.success) {
      toast({
        title: 'PDF Downloaded',
        description: `${result.fileName} has been saved.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again or use print.',
        variant: 'destructive',
      });
    }
  };

  const handleEmailQuote = async () => {
    // Electron path: open Outlook with attachment
    if (window.electronAPI?.isElectron) {
      toast({
        title: 'Preparing Email...',
        description: 'Generating PDF and opening Outlook.',
      });

      try {
        const { blob, fileName } = await generateQuotationPdf(quotation);
        
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        const subject = `NOGA MT - Quotation ${quotation.quoteNumber}`;
        const body = `Dear ${quotation.clientName},\n\nPlease find attached our quotation ${quotation.quoteNumber} for your review.\n\nTotal: ${formatCurrency(total, quotation.currency)}\nValid Until: ${formatDate(quotation.validUntil)}\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nNoga Engineering & Technology Ltd.`;

        const result = await window.electronAPI.emailWithAttachment(
          base64Data,
          fileName,
          selectedRecipients.join(', '),
          subject,
          body
        );

        if (result.success) {
          toast({
            title: result.fallback ? 'PDF Saved' : 'Email Ready',
            description: result.fallback ? 'Outlook not available. PDF saved and folder opened.' : 'Outlook opened with the PDF attached.',
          });
        } else {
          throw new Error(result.error || 'Failed to prepare email');
        }
      } catch (error) {
        console.error('Error preparing email:', error);
        toast({
          title: 'Error',
          description: 'Failed to prepare email. Please try downloading the PDF instead.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Web path: send via Brevo with PDF attachment
    setSendingQuote(true);
    toast({
      title: 'Sending Email...',
      description: 'Generating PDF and sending quotation email.',
    });

    try {
      const { blob, fileName } = await generateQuotationPdf(quotation);
      
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const subject = `NOGA MT - Quotation ${quotation.quoteNumber}`;
      const messageHtml = `<p>Dear ${quotation.clientName},</p>
<p>Please find attached our quotation <strong>${quotation.quoteNumber}</strong> for your review.</p>
<p>Total: <strong>${formatCurrency(total, quotation.currency)}</strong><br/>Valid Until: ${formatDate(quotation.validUntil)}</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Best regards,<br/><strong>Noga MT Team</strong></p>`;

      const recipients = selectedRecipients
        .map(email => ({ email, name: quotation.clientName }));

      const { data, error } = await supabase.functions.invoke('send-customer-email', {
        body: {
          recipients,
          subject,
          message: messageHtml,
          messageHtml,
          attachments: [{ name: fileName, content: base64Data }],
          quotationId: quotation.id,
        },
      });

      if (error) throw error;

      const resultsArr: { email: string; success: boolean }[] = data?.results || [];
      const successEmails = resultsArr.filter(r => r.success).map(r => r.email);
      const failedEmails = resultsArr.filter(r => !r.success).map(r => r.email);
      const skippedCount = data?.skipped || 0;
      const unsubscribedEmails = selectedRecipients.filter(e => 
        !resultsArr.some(r => r.email.toLowerCase() === e.toLowerCase())
      );

      if (unsubscribedEmails.length > 0) {
        toast({
          title: 'Unsubscribed',
          description: `${unsubscribedEmails.join(', ')} has unsubscribed from emails.`,
          variant: 'destructive',
        });
      }

      if (failedEmails.length > 0) {
        toast({
          title: 'Partial Failure',
          description: `Failed to send to: ${failedEmails.join(', ')}`,
          variant: 'destructive',
        });
      }

      if (successEmails.length > 0) {
        toast({
          title: 'Quotation Sent!',
          description: `Successfully sent to ${successEmails.join(', ')}.`,
        });
      } else if (failedEmails.length === selectedRecipients.length) {
        throw new Error('All emails failed to send');
      }

      // Auto-update status to 'sent' if currently 'draft'
      if (quotation.status === 'draft' && onStatusChange) {
        onStatusChange(quotation.id, 'sent');
      }

      await refreshSentEmails();

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
          const newEmails = selectedRecipients.filter(e => !existingEmails.includes(e.toLowerCase()));
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
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingQuote(false);
    }
  };

  // Reminder logic
  const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_AGE_MS = 6 * 7 * 24 * 60 * 60 * 1000;

  const reminderAllowed = (() => {
    const age = Date.now() - new Date(quotation.createdAt).getTime();
    if (age < MIN_AGE_MS || age > MAX_AGE_MS) return false;
    if (!quotation.reminderSentAt) return true;
    return Date.now() - new Date(quotation.reminderSentAt).getTime() >= REMINDER_COOLDOWN_MS;
  })();

  const showReminderButton = quotation.status !== 'accepted' && quotation.status !== 'finished';


  const handleSendReminder = async () => {
    setIsSendingReminder(true);
    const emailsToSend = selectedReminderRecipients;
    toast({ title: 'Sending reminder...', description: `Generating PDF and emailing ${emailsToSend.join(', ')}` });

    try {
      const { base64 } = await getQuotationPdfBase64(quotation);
      const totalFormatted = formatCurrency(total, quotation.currency);
      const validUntil = formatDateUtil(quotation.validUntil);

      const results = await Promise.allSettled(
        emailsToSend.map(email =>
          supabase.functions.invoke('send-quotation-email', {
            body: { to: email.trim(), clientName: quotation.clientName, quoteNumber: quotation.quoteNumber, total: totalFormatted, validUntil, pdfBase64: base64, isReminder: true },
          })
        )
      );

      const successEmails: string[] = [];
      const failedEmails: string[] = [];
      const unsubscribedEmails: string[] = [];

      results.forEach((r, i) => {
        const email = emailsToSend[i];
        if (r.status === 'rejected') failedEmails.push(email);
        else if (r.value.error) failedEmails.push(email);
        else if (r.value.data?.unsubscribed) unsubscribedEmails.push(email);
        else successEmails.push(email);
      });

      if (unsubscribedEmails.length > 0) toast({ title: 'Unsubscribed', description: `${unsubscribedEmails.join(', ')} has unsubscribed.`, variant: 'destructive' });
      if (failedEmails.length > 0 && failedEmails.length < emailsToSend.length) toast({ title: 'Partial Failure', description: `Failed to send to: ${failedEmails.join(', ')}`, variant: 'destructive' });
      if (failedEmails.length === emailsToSend.length) throw new Error('All emails failed to send');
      if (successEmails.length > 0) toast({ title: 'Reminder Sent', description: `Follow-up email sent to ${successEmails.join(', ')}.` });

      if (quotation.status === 'draft' && onStatusChange) onStatusChange(quotation.id, 'sent');
      await refreshSentEmails();
    } catch (err) {
      console.error('Failed to send reminder:', err);
      toast({ title: 'Error', description: 'Failed to send reminder email. Please try again.', variant: 'destructive' });
    } finally {
      setIsSendingReminder(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Quotations
        </Button>
        <div className="flex gap-2 flex-wrap">
          {onStatusChange && (
            <>
              {/* Mark as Accepted */}
              {quotation.status === 'accepted' ? (
                <Button
                  variant="outline"
                  className="border-green-500 bg-green-500 text-white hover:bg-green-600"
                  onClick={() => setOrderPickerOpen(true)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Order Received — Edit Order
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="hover:border-green-500 hover:text-green-600"
                  onClick={() => setOrderPickerOpen(true)}
                >
                  <Circle className="w-4 h-4 mr-2" />
                  Mark as Accepted
                </Button>
              )}
              <OrderLinePickerDialog
                open={orderPickerOpen}
                onOpenChange={setOrderPickerOpen}
                items={quotation.items}
                quoteNumber={quotation.quoteNumber}
                currency={quotation.currency}
                initialSelectedIds={quotation.orderedItems}
                onConfirm={(selectedIds) => onStatusChange(quotation.id, 'accepted', selectedIds)}
              />

              {/* Mark as Finished */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={quotation.status === 'finished' ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600' : 'hover:border-orange-500 hover:text-orange-500'}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    {quotation.status === 'finished' ? 'Closed (No Order)' : 'Mark as Finished'}
                  </Button>
                </AlertDialogTrigger>
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
                      onClick={() => onStatusChange(quotation.id, quotation.status === 'finished' ? 'sent' : 'finished')}
                      className={quotation.status === 'finished' ? '' : 'bg-orange-500 hover:bg-orange-600'}
                    >
                      {quotation.status === 'finished' ? 'Reopen' : 'Mark as Finished'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="accent" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleGeneratePortalLink} disabled={portalLoading}>
            {portalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link className="w-4 h-4 mr-2" />}
            Portal Link
          </Button>
          {portalTokens.length === 0 && !showPortalSection && (
            <Button variant="ghost" size="sm" onClick={handleLoadPortalTokens}>
              <Eye className="w-4 h-4 mr-2" />
              View Links
            </Button>
          )}
          {showReminderButton && (
            <Button
              variant="outline"
              disabled={!reminderAllowed || isSendingReminder}
              onClick={() => {
                const allEmails = quotation.clientEmail.split(',').map(em => em.trim()).filter(Boolean);
                setSelectedReminderRecipients(allEmails);
                setReminderDialogOpen(true);
              }}
            >
              {isSendingReminder ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Reminder
            </Button>
          )}
        </div>
      </div>

      {/* Portal Links Section */}
      {showPortalSection && (
        <Card className="mb-6 no-print card-elevated max-w-4xl mx-auto">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary uppercase tracking-wider flex items-center gap-2">
                <Link className="w-4 h-4" /> Customer Portal Links
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPortalSection(false)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            {portalLink && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-primary/10">
                <Input value={portalLink} readOnly className="font-mono text-xs flex-1" />
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(portalLink); toast({ title: 'Copied!' }); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            {portalTokens.length > 0 && (
              <div className="space-y-2">
                {portalTokens.map((t) => {
                  const link = `${window.location.origin}${window.location.pathname}#/portal?token=${t.token}`;
                  const isExpired = new Date(t.expires_at) < new Date();
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-primary/5 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate">{link}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Expires: {new Date(t.expires_at).toLocaleDateString()}</span>
                          {t.client_response && <Badge variant="outline">{t.client_response}</Badge>}
                          {!t.is_active && <Badge variant="destructive">Inactive</Badge>}
                          {isExpired && t.is_active && <Badge variant="secondary">Expired</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast({ title: 'Copied!' }); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      {t.is_active && !isExpired && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivateToken(t.id)} className="text-destructive hover:text-destructive">
                          <Ban className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {portalTokens.length === 0 && !portalLink && (
              <p className="text-sm text-muted-foreground">No portal links generated yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quotation Document */}
      <Card className="card-elevated max-w-4xl mx-auto print:shadow-none print:border-none">
        <CardContent className="p-8 md:p-12">
          {/* Print Header with Logos */}
          <div className="hidden print:flex justify-between items-start mb-6">
            <img src={logo} alt="NogaMT Logo" className="h-12 w-auto" />
            <img src={thinkingInside} alt="Thinking Inside" className="h-12 w-auto" />
          </div>

          {/* Header */}
          <div className="mb-8 pb-8 border-b print:pt-0">
            <h1 className="heading-display text-3xl text-primary mb-4 print:text-cyan-600 text-center">
              QUOTATION <span className="text-foreground print:text-gray-900">{quotation.quoteNumber.replace(/^QT/i, '')}</span>
            </h1>
            <div className="flex flex-col md:flex-row justify-between items-start">
              <div></div>
              <div className="mt-4 md:mt-0 text-right print:text-left">
                <p className="text-sm text-muted-foreground mt-2 print:text-gray-600 print:mt-0">
                  Created: {formatDate(quotation.createdAt)}
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-600">
                  Valid Until: {formatDate(quotation.validUntil)}
                </p>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-8 group/client">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-medium text-muted-foreground print:text-gray-500">BILL TO</h2>
              {onEditCustomer && (
                <button
                  className="no-print opacity-0 group-hover/client:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEditClientName(quotation.clientName);
                    setEditClientEmail(quotation.clientEmail);
                    setEditClientAddress(quotation.clientAddress);
                    setEditCustomerOpen(true);
                  }}
                >
                  <UserPen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="font-semibold text-foreground print:text-gray-900">{quotation.clientName}</p>
            <p className="text-muted-foreground print:text-gray-600">{quotation.clientEmail}</p>
            {quotation.clientAddress && (
              <p className="text-muted-foreground whitespace-pre-line print:text-gray-600">{quotation.clientAddress}</p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border print:border-gray-300">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground w-8 print:text-gray-500">#</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground w-24 print:text-gray-500">SKU</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground print:text-gray-500">Description</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">LT (wks)</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">MOQ</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-28 print:text-gray-500">Unit Price ({quotation.currency})</th>
                  <th className="text-center py-3 text-sm font-medium text-muted-foreground w-16 print:text-gray-500">Disc %</th>
                  <th className="text-right py-3 text-sm font-medium text-muted-foreground w-24 print:text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, index) => {
                  const isOrdered = quotation.status === 'accepted' && quotation.orderedItems?.includes(item.id);
                  return (
                  <tr key={item.id} className="border-b border-border print:border-gray-200">
                    <td className="py-4 text-muted-foreground print:text-gray-600 align-top">
                      <div className="flex items-center gap-1.5">
                        {index + 1}
                        {isOrdered && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="py-4 text-foreground font-mono text-sm print:text-gray-900 align-top">{item.sku || '—'}</td>
                    <td className="py-4 text-foreground font-normal print:text-gray-900 align-top">
                      <div>{item.description || '—'}</div>
                      {item.notes && (
                        <div className="text-xs text-muted-foreground mt-1 italic print:text-gray-500">
                          Note: {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">{item.leadTime || '—'}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">{item.moq || 1}</td>
                    <td className="py-4 text-right text-muted-foreground print:text-gray-600 align-top">{formatCurrency(item.unitPrice, quotation.currency)}</td>
                    <td className="py-4 text-center text-muted-foreground print:text-gray-600 align-top">
                      {item.discountPercent ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="py-4 text-right font-medium text-foreground print:text-gray-900 align-top">
                      {formatCurrency(calculateLineTotal(item), quotation.currency)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground print:text-gray-500">Subtotal</span>
                <span className="text-foreground print:text-gray-900">{formatCurrency(subtotal, quotation.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">
                    Discount {quotation.discountType === 'percentage' ? `(${quotation.discountValue}%)` : ''}
                  </span>
                  <span className="text-destructive print:text-red-600">-{formatCurrency(discount, quotation.currency)}</span>
                </div>
              )}
              {quotation.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">Tax ({quotation.taxRate}%)</span>
                  <span className="text-foreground print:text-gray-900">{formatCurrency(tax, quotation.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t-2 border-border print:border-gray-300">
                <span className="text-foreground print:text-gray-900">Total</span>
                <span className="text-primary print:text-cyan-600">{formatCurrency(total, quotation.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="pt-6 border-t print:border-gray-200">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 print:text-gray-500">NOTES</h2>
              <p className="text-muted-foreground whitespace-pre-line print:text-gray-600">{quotation.notes}</p>
            </div>
          )}

          {/* Email Tracking History - not printed */}
          {emailTracking.length > 0 && (
            <div className="pt-6 border-t no-print">
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" />
                EMAIL HISTORY ({emailTracking.length})
              </h2>
              <div className="space-y-2">
                {emailTracking
                  .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
                  .map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {record.read_at ? (
                          <MailOpen className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <span className="text-foreground">{record.recipient_email}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {record.email_type === 'reminder' ? 'Reminder' : record.email_type === 'quotation' ? 'Quotation' : 'Custom'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Sent {formatDate(new Date(record.sent_at))}</span>
                        {record.read_at ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Eye className="w-3 h-3" />
                            Read {formatDate(new Date(record.read_at))}
                            {record.read_count > 1 && (
                              <span className="text-muted-foreground ml-1">({record.read_count}×)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Not read yet</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Email Correspondence - not printed */}
          {sentEmails.length > 0 && (
            <div className="pt-6 border-t no-print">
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                EMAIL CORRESPONDENCE ({sentEmails.length})
              </h2>
              <div className="space-y-2">
                {sentEmails.map((email) => (
                  <div key={email.id} className="rounded-md bg-muted/50 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between text-sm py-2 px-3 hover:bg-muted/80 transition-colors"
                      onClick={() => setExpandedEmailId(expandedEmailId === email.id ? null : email.id)}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Mail className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <span className="text-foreground font-medium">{email.subject}</span>
                          <div className="text-xs text-muted-foreground">
                            To: {(email.recipient_emails || []).join(', ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {email.recalled_at && (
                          <Badge variant="destructive" className="text-xs">Recalled</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {email.email_type === 'reminder' ? 'Reminder' : email.email_type === 'quotation' ? 'Quotation' : 'Custom'}
                        </Badge>
                        {(email.attachment_names || []).length > 0 && (
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground">{formatDate(new Date(email.sent_at))}</span>
                        {expandedEmailId === email.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedEmailId === email.id && (
                      <div className="px-3 pb-3 border-t border-border">
                        {(email.cc_emails || []).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">CC: {email.cc_emails.join(', ')}</p>
                        )}
                        {(email.attachment_names || []).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {email.attachment_names.join(', ')}
                          </p>
                        )}
                        <div
                          className="mt-2 text-sm text-foreground bg-background rounded p-3 max-h-60 overflow-y-auto border"
                          dangerouslySetInnerHTML={{ __html: email.body_html }}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          {!email.recalled_at && (
                            <AlertDialog open={recallConfirmId === email.id} onOpenChange={(o) => !o && setRecallConfirmId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                  disabled={recallingId === email.id}
                                  onClick={() => setRecallConfirmId(email.id)}
                                >
                                  {recallingId === email.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Ban className="w-3 h-3 mr-1" />
                                  )}
                                  Recall
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Recall this email?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A retraction notice will be sent to all recipients asking them to disregard the original email. The email will be marked as recalled.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRecallEmail(email)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Recall Email
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resendingId === email.id}
                            onClick={() => handleResendEmail(email)}
                          >
                            {resendingId === email.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Forward className="w-3 h-3 mr-1" />
                            )}
                            Resend
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attached Outlook Emails - not printed */}
          <div
            className={`pt-6 border-t no-print relative transition-colors ${isDragging ? 'bg-primary/5 border-primary/30 rounded-lg' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragCounterRef.current++;
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragCounterRef.current--;
              if (dragCounterRef.current === 0) setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragCounterRef.current = 0;
              setIsDragging(false);
              handleUploadEmailFile(e.dataTransfer.files);
            }}
          >
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10 pointer-events-none">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-primary">Drop .eml or .msg files here</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                ATTACHED EMAILS ({emailAttachments.length})
              </h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".eml,.msg"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadEmailFile(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadingEmail}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingEmail ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1" />
                  )}
                  {uploadingEmail ? 'Uploading...' : 'Attach Email'}
                </Button>
              </div>
            </div>
            {emailAttachments.length > 0 ? (
              <div className="space-y-2">
                {emailAttachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <span className="text-foreground font-medium">{att.file_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({(att.file_size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(new Date(att.uploaded_at))}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownloadAttachment(att)} title="Download">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteAttachment(att)} title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop .eml or .msg files here</p>
                <p className="text-xs text-muted-foreground/60 mt-1">or click to browse</p>
              </div>
            )}
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-center">
            <p className="font-semibold text-gray-900 text-xs">Noga Engineering & Technology Ltd.</p>
            <p className="text-[10px] text-gray-600">Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
            <p className="text-[10px] text-cyan-600">www.nogamt.com</p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      {onEditCustomer && (
        <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Customer Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="preview-edit-name">Name</Label>
                <Input id="preview-edit-name" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-edit-email">Email(s)</Label>
                <Input
                  id="preview-edit-email"
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
                <Label htmlFor="preview-edit-address">Address</Label>
                <Input id="preview-edit-address" value={editClientAddress} onChange={(e) => setEditClientAddress(e.target.value)} />
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
                  onEditCustomer(quotation.id, {
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
      )}

      {/* Confirm Send Email Dialog */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Quotation Email?</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>This will send quotation <span className="font-medium text-foreground">{quotation.quoteNumber}</span> with PDF attachment to:</p>
            <div className="bg-muted rounded-md p-3 space-y-2">
              {quotation.clientEmail.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(email)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRecipients(prev => [...prev, email]);
                      } else {
                        setSelectedRecipients(prev => prev.filter(r => r !== email));
                      }
                    }}
                    className="rounded border-input"
                  />
                  <Mail className="w-3 h-3 text-primary" />
                  <span className="text-foreground font-medium">{email}</span>
                </label>
              ))}
              {/* Show manually-added emails */}
              {selectedRecipients
                .filter(r => !quotation.clientEmail.split(',').map(e => e.trim()).filter(Boolean).includes(r))
                .map((email, i) => (
                  <label key={`added-${i}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => setSelectedRecipients(prev => prev.filter(r => r !== email))}
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
                value={additionalEmail}
                onChange={(e) => setAdditionalEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const email = additionalEmail.trim();
                    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !selectedRecipients.includes(email)) {
                      setSelectedRecipients(prev => [...prev, email]);
                      setAdditionalEmail('');
                    }
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!additionalEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(additionalEmail.trim()) || selectedRecipients.includes(additionalEmail.trim())}
                onClick={() => {
                  const email = additionalEmail.trim();
                  if (email && !selectedRecipients.includes(email)) {
                    setSelectedRecipients(prev => [...prev, email]);
                    setAdditionalEmail('');
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedRecipients.length === 0}
              onClick={() => {
                setConfirmSendOpen(false);
                handleEmailQuote();
              }}
            >
              <Send className="w-4 h-4 mr-2" />
              Send ({selectedRecipients.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Recipient Selection Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
                      if (ev.target.checked) setSelectedReminderRecipients(prev => [...prev, email]);
                      else setSelectedReminderRecipients(prev => prev.filter(r => r !== email));
                    }}
                    className="rounded border-input"
                  />
                  <Mail className="w-3 h-3 text-primary" />
                  <span className="text-foreground font-medium">{email}</span>
                </label>
              ))}
              {selectedReminderRecipients
                .filter(r => !quotation.clientEmail.split(',').map(e => e.trim()).filter(Boolean).includes(r))
                .map((email, i) => (
                  <label key={`added-${i}`} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked onChange={() => setSelectedReminderRecipients(prev => prev.filter(r => r !== email))} className="rounded border-input" />
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
              onClick={() => {
                setReminderDialogOpen(false);
                handleSendReminder();
              }}
            >
              Send Reminder ({selectedReminderRecipients.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
