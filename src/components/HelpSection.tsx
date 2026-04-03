import { useState } from 'react';
import { HelpCircle, X, Plus, FileText, Send, Archive, Users, BookUser, Activity, RepeatIcon, Search, Copy, Edit, Eye, Trash2, CheckCircle, Ban, RotateCcw, Mail, Link, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const helpSections = [
  {
    id: 'quotations',
    icon: FileText,
    title: 'Creating & Managing Quotations',
    content: [
      { label: 'Create New Quote', desc: 'Click "New Quote" to open the quotation form. Fill in client details, add line items with SKU, description, quantity, and pricing. The quote is automatically saved with "sent" status.' },
      { label: 'Duplicate Detection', desc: 'When creating a new quote, the system checks for similar or identical quotations by matching client name and email. A warning dialog appears if duplicates are found.' },
      { label: 'Edit a Quote', desc: 'Click the edit icon on any quotation card to modify its details. Changes are saved when you submit the form.' },
      { label: 'Preview & Print', desc: 'Click the eye icon to preview a quotation in a formatted layout. You can print or export to PDF from the preview.' },
      { label: 'Duplicate a Quote', desc: 'Use the copy icon to create an identical copy of an existing quotation with a new quote number.' },
    ],
  },
  {
    id: 'status',
    icon: CheckCircle,
    title: 'Quotation Status Workflow',
    content: [
      { label: 'Sent (default)', desc: 'New quotations are automatically set to "sent" status when created.' },
      { label: 'Accepted (Order Received)', desc: 'Mark a quote as accepted when the client confirms the order. You can select which specific line items were ordered.' },
      { label: 'Finished (No Order)', desc: 'Mark as finished when the quote is closed without receiving an order.' },
      { label: 'Reopen to Sent', desc: 'Accepted or finished quotes can be moved back to "sent" status if needed.' },
      { label: 'Status Filters', desc: 'Use the status filter buttons (Active / Finished / All) at the top of the list to quickly filter quotations.' },
    ],
  },
  {
    id: 'search',
    icon: Search,
    title: 'Search & Filters',
    content: [
      { label: 'Search Bar', desc: 'Search quotations by quote number, client name, email, SKU, or item description. Results update in real-time.' },
      { label: 'Status Filter', desc: 'Filter by Active (hides finished), Finished only, or All quotations.' },
      { label: 'Handler Filter', desc: 'Filter quotations by the team member who created them.' },
      { label: 'Expiring Soon', desc: 'Toggle to show only quotations expiring within the next 7 days.' },
    ],
  },
  {
    id: 'archive',
    icon: Archive,
    title: 'Archive & Restore',
    content: [
      { label: 'Archive a Quote', desc: 'Delete/archive a quotation to move it to the archive. It is not permanently deleted.' },
      { label: 'View Archive', desc: 'Click the "Archive" button in the header to view all archived quotations.' },
      { label: 'Restore', desc: 'Archived quotations can be restored back to the active list.' },
      { label: 'Permanent Delete', desc: 'Admin users can permanently delete archived quotations. This action cannot be undone.' },
    ],
  },
  {
    id: 'customers',
    icon: BookUser,
    title: 'Customer Management',
    content: [
      { label: 'Customer List', desc: 'Click "Customers" to view all your clients with their contact details and quotation history.' },
      { label: 'Customer Report', desc: 'Click on a customer to see a detailed report of all their quotations, statuses, and totals.' },
      { label: 'Edit Customer', desc: 'Update customer details (name, email, address) directly from the quotation preview.' },
    ],
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Email & Communication',
    content: [
      { label: 'Send Quotation Email', desc: 'From the quotation preview, send the quote directly to the client via email with optional CC/BCC recipients.' },
      { label: 'Email Tracking', desc: 'Track when clients open your quotation emails. The read status and count are shown on the quotation card.' },
      { label: 'Email Templates', desc: 'Save and reuse email templates for consistent communication with clients.' },
      { label: 'Attachments', desc: 'Attach files to quotation emails. Uploaded files are stored securely.' },
    ],
  },
  {
    id: 'portal',
    icon: Link,
    title: 'Customer Portal',
    content: [
      { label: 'Generate Portal Link', desc: 'Create a secure, time-limited link that allows clients to view their quotation online.' },
      { label: 'Client Response', desc: 'Clients can approve or reject quotations and leave comments through the portal.' },
      { label: 'Token Expiry', desc: 'Portal links expire after a set period for security. You can generate new links as needed.' },
    ],
  },
  {
    id: 'activity',
    icon: Activity,
    title: 'Activity Log',
    content: [
      { label: 'Audit Trail', desc: 'Click "Activity" to view a chronological log of all actions: created, edited, deleted, status changes, and more.' },
      { label: 'User Tracking', desc: 'Each activity entry shows which user performed the action and when.' },
      { label: 'Entity Links', desc: 'Activity entries link to the related quotation for quick navigation.' },
    ],
  },
  {
    id: 'recurring',
    icon: RepeatIcon,
    title: 'Recurring Quotations',
    content: [
      { label: 'Create Template', desc: 'Set up recurring quotation templates with predefined items, frequency (weekly/monthly/quarterly), and client details.' },
      { label: 'Auto-Generation', desc: 'Recurring templates automatically generate new quotations on the scheduled dates.' },
      { label: 'Manage Templates', desc: 'Activate, deactivate, or edit recurring templates from the "Recurring" section.' },
    ],
  },
  {
    id: 'bulk',
    icon: Copy,
    title: 'Bulk Actions',
    content: [
      { label: 'Select Multiple', desc: 'Use the checkboxes on quotation cards to select multiple quotes at once.' },
      { label: 'Batch Status Change', desc: 'Change the status of multiple quotations simultaneously.' },
      { label: 'Batch Archive', desc: 'Archive multiple quotations in one action.' },
      { label: 'Batch Export', desc: 'Export selected quotations to PDF in bulk.' },
    ],
  },
  {
    id: 'users',
    icon: Shield,
    title: 'User Management (Admin)',
    content: [
      { label: 'View Users', desc: 'Admin users can access the "Users" section to see all team members and their roles.' },
      { label: 'Roles', desc: 'Three roles are available: Admin (full access), User (standard access), and Viewer (read-only).' },
      { label: 'Reassign Quotes', desc: 'Admin users can reassign quotations to different team members from the quotation preview.' },
    ],
  },
  {
    id: 'team',
    icon: Users,
    title: 'Team Collaboration',
    content: [
      { label: 'Online Status', desc: 'See which team members are currently online via the green indicators in the header.' },
      { label: 'Team Chat', desc: 'Use the built-in chat to communicate with team members in real-time.' },
      { label: 'Version History', desc: 'Track changes to quotations with version snapshots. Compare and restore previous versions.' },
    ],
  },
];

export function HelpSection() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="w-4 h-4 mr-2" />
          Help
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Help & Features Guide
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Learn about all features and how to use them effectively.
          </p>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] px-6 pb-6">
          <Accordion type="multiple" className="w-full">
            {helpSections.map((section) => (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      <section.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pl-11">
                    {section.content.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Keyboard tip:</strong> Use your browser's back button to navigate between quotation views with scroll position restored.
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
