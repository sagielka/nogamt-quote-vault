import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotations } from '@/hooks/useQuotations';
import { useArchivedQuotations, ArchivedQuotation } from '@/hooks/useArchivedQuotations';
import { useAuth } from '@/hooks/useAuth';
import { useEmailTracking } from '@/hooks/useEmailTracking';
import { useActivityLog } from '@/hooks/useActivityLog';
import { QuotationFormData } from '@/types/quotation';
import { QuotationForm } from '@/components/quotation/QuotationForm';
import { QuotationCard } from '@/components/quotation/QuotationCard';
import { QuotationPreview } from '@/components/quotation/QuotationPreview';
import { ArchivedQuotationCard } from '@/components/quotation/ArchivedQuotationCard';
import { EmptyState } from '@/components/quotation/EmptyState';
import { QuotationStats } from '@/components/quotation/QuotationStats';
import { MarketTicker } from '@/components/MarketTicker';

import { CustomerReport } from '@/components/CustomerReport';
import { QuotationReport } from '@/components/QuotationReport';
import { ActivityFeed } from '@/components/ActivityFeed';
import { BulkActionsBar } from '@/components/BulkActionsBar';


import { UserManagement } from '@/components/UserManagement';
import { CustomerAccountsAdmin } from '@/components/CustomerAccountsAdmin';
import { CatalogSyncPanel } from '@/components/CatalogSyncPanel';
import { ProductMediaAdmin } from '@/components/product-media/ProductMediaAdmin';
import { CustomerList } from '@/components/CustomerList';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, LogOut, Archive, FolderOpen, Search, Users, User, BookUser, X, Circle, CheckCircle, Ban, Activity, RepeatIcon, BarChart3, Sparkles, ShieldCheck, Eye, Settings as SettingsIcon, Menu } from 'lucide-react';
import { AIQuoteAssistant } from '@/components/AIQuoteAssistant';
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
import { TeamChat } from '@/components/TeamChat';
import { HelpSection } from '@/components/HelpSection';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import thinkingInside from '@/assets/thinking-inside.png';
import OrderLinePickerDialog from '@/components/quotation/OrderLinePickerDialog';
import { ItemPricesView } from '@/components/ItemPricesView';
import { usePermissions } from '@/hooks/usePermissions';
import { ViewModeToggle, ViewMode, loadViewMode } from '@/components/ViewModeToggle';
import { QuotationViews } from '@/components/quotation/QuotationViews';
import { RecurringQuotationsView } from '@/components/RecurringQuotationsView';
import { History } from 'lucide-react';


type View = 'list' | 'create' | 'edit' | 'preview' | 'archive' | 'users' | 'customers' | 'report' | 'activity' | 'reports' | 'portal-accounts' | 'recurring' | 'settings';

const Index = () => {
  const { quotations, addQuotation, updateQuotation, deleteQuotation, duplicateQuotation, getQuotation, refreshQuotations } = useQuotations();
  const { getLatestRead, getTrackingForQuotation } = useEmailTracking();
  const { 
    archivedQuotations, 
    isAdmin, 
    archiveQuotation, 
    permanentlyDeleteQuotation, 
    restoreQuotation 
  } = useArchivedQuotations();
  const { user, loading, signOut } = useAuth();
  const { can } = usePermissions();
  const canPricePortal = can('price_portal');
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const scrollPositionRef = useRef(0);
  const pendingScrollRestore = useRef(false);
  const isPopState = useRef(false);

  // Handle browser back/forward button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.view) {
        isPopState.current = true;
        if (state.view === 'list') {
          scrollPositionRef.current = state.scrollY ?? 0;
          pendingScrollRestore.current = true;
        }
        setCurrentView(state.view);
        setSelectedQuotationId(state.quotationId ?? null);
        if (state.view !== 'list') {
          window.scrollTo(0, 0);
        }
      } else {
        isPopState.current = true;
        pendingScrollRestore.current = true;
        setCurrentView('list');
        setSelectedQuotationId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    // Replace initial history state
    window.history.replaceState({ view: 'list' }, '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToView = useCallback((view: View, quotationId?: string | null) => {
    if (isPopState.current) {
      isPopState.current = false;
      return;
    }
    if (currentView === 'list') {
      scrollPositionRef.current = window.scrollY;
      // Update current history entry with scroll position
      window.history.replaceState({ view: 'list', scrollY: scrollPositionRef.current }, '');
    }
    setCurrentView(view);
    if (quotationId !== undefined) {
      setSelectedQuotationId(quotationId ?? null);
    }
    if (view === 'list') {
      pendingScrollRestore.current = true;
      window.history.pushState({ view: 'list' }, '');
    } else {
      window.history.pushState({ view, quotationId: quotationId ?? selectedQuotationId }, '');
      window.scrollTo(0, 0);
    }
  }, [currentView, selectedQuotationId]);

  useEffect(() => {
    if (currentView === 'list' && pendingScrollRestore.current && quotations.length > 0) {
      pendingScrollRestore.current = false;
      const savedPos = scrollPositionRef.current;
      // Use setTimeout to allow DOM to fully render after data is available
      setTimeout(() => {
        window.scrollTo(0, savedPos);
      }, 100);
    }
  }, [currentView, quotations]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'finished' | 'all'>('active');
  const [expiringSoonFilter, setExpiringSoonFilter] = useState(false);
  const [handlerFilter, setHandlerFilter] = useState<string>('all');
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [reportCustomer, setReportCustomer] = useState<{ name: string; email: string; address: string | null } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<{ email: string; lastSeen: string }[]>([]);
  const [editOrderPickerOpen, setEditOrderPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quotationsViewMode, setQuotationsViewMode] = useState<ViewMode>(() => loadViewMode('quotations-view-mode', 'grid'));

  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiPrefillData, setAiPrefillData] = useState<Partial<QuotationFormData> | null>(null);
  const { logActivity } = useActivityLog();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle ?highlight= param from email links (HashRouter reads from hash query)
  const highlightHandled = useRef(false);
  useEffect(() => {
    if (highlightHandled.current) return;

    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    const fromUrl = qIdx >= 0 ? new URLSearchParams(hash.slice(qIdx + 1)).get('highlight') : null;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem('pending-highlight'); } catch { /* ignore */ }
    const highlightId = fromUrl || pending;
    console.log('[highlight] id=', highlightId, 'user=', !!user, 'quotes=', quotations.length);
    if (!highlightId) return;

    // Not signed in yet: remember it and open the quote right after login.
    if (!user) {
      try { sessionStorage.setItem('pending-highlight', highlightId); } catch { /* ignore */ }
      return;
    }
    if (quotations.length === 0) return;

    highlightHandled.current = true;
    try { sessionStorage.removeItem('pending-highlight'); } catch { /* ignore */ }
    // Clean the URL through the router so the hash router stays in sync.
    navigate('/', { replace: true });

    const found = quotations.find(q => q.id === highlightId);
    if (found) {
      navigateToView('preview', highlightId);
    } else {
      toast({
        title: 'Quotation not available',
        description: 'It may have been archived or deleted.',
        variant: 'destructive',
      });
    }
  }, [quotations, user, navigate, navigateToView, toast]);


  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Customer accounts (non-staff) belong in the customer portal, not the internal app
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (roles && roles.length > 0) return; // staff member
      const { data: account } = await (supabase
        .from('customer_accounts' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle() as any);
      if (!cancelled && account) navigate('/price-list', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);


  // Track user activity (last_seen)
  useEffect(() => {
    if (!user) return;
    const updateLastSeen = async () => {
      const { data: existing } = await (supabase
        .from('profiles' as any)
        .select('id')
        .eq('user_id', user.id)
        .single() as any);

      if (existing) {
        await (supabase
          .from('profiles' as any)
          .update({ last_seen_at: new Date().toISOString() } as any)
          .eq('user_id', user.id) as any);
      } else {
        await (supabase
          .from('profiles' as any)
          .insert({ user_id: user.id, last_seen_at: new Date().toISOString() } as any) as any);
      }
    };
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user]);

  // Fetch user names for quotation creator display
  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchUserNames = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token || !projectId) return;

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-users?action=list`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.users) {
          const map: Record<string, string> = {};
          data.users.forEach((u: any) => {
            const name = u.email?.split('@')[0] || u.id.slice(0, 6);
            map[u.id] = name.charAt(0).toUpperCase() + name.slice(1);
          });
          setUserNameMap(map);
        }
      } catch {
        // ignore
      }
    };
    fetchUserNames();
  }, [user, isAdmin]);

  // Fetch online users
  useEffect(() => {
    if (!user) return;
    const fetchOnline = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token || !projectId) return;

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-users?action=list`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (!res.ok) {
          // Non-admin: fall back to profiles table
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, last_seen_at')
            .gte('last_seen_at', fiveMinAgo);
          if (profiles) {
            setOnlineUsers(profiles.map((p: any) => ({
              email: p.user_id === user.id ? (user.email || 'You') : p.user_id.slice(0, 6),
              lastSeen: p.last_seen_at,
            })));
          }
          return;
        }
        const data = await res.json();
        if (data?.users) {
          const now = Date.now();
          const online = data.users.filter((u: any) => {
            if (!u.last_seen_at) return false;
            return now - new Date(u.last_seen_at).getTime() < 5 * 60 * 1000;
          });
          setOnlineUsers(online.map((u: any) => ({
            email: u.email,
            lastSeen: u.last_seen_at,
          })));
        }
      } catch {
        // ignore
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } else {
      navigate('/auth');
    }
  };

  const handleCreateQuotation = async (data: QuotationFormData) => {
    const pendingFiles = data.pendingEmailFiles;
    delete data.pendingEmailFiles;
    
    const newQuotation = await addQuotation(data);
    if (newQuotation) {
      await logActivity('created', 'quotation', newQuotation.id, newQuotation.quoteNumber);
      if (pendingFiles && pendingFiles.length > 0 && user) {
        try {
          for (const file of pendingFiles) {
            const filePath = `${user.id}/${newQuotation.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('email-attachments').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { error: dbError } = await supabase.from('quotation_email_attachments').insert({
              quotation_id: newQuotation.id,
              user_id: user.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
            });
            if (dbError) throw dbError;
          }
          toast({
            title: 'Quotation Created',
            description: `Quote ${newQuotation.quoteNumber} created with ${pendingFiles.length} email attachment(s).`,
          });
        } catch (err: any) {
          toast({
            title: 'Quotation Created',
            description: `Quote created but some email attachments failed to upload: ${err.message}`,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Quotation Created',
          description: `Quote ${newQuotation.quoteNumber} has been created successfully.`,
        });
      }
    } else {
      toast({
        title: 'Error',
        description: 'Failed to create quotation. Please try again.',
        variant: 'destructive',
      });
    }
    navigateToView('list');
  };

  const handleUpdateQuotation = (data: QuotationFormData) => {
    if (selectedQuotationId) {
      updateQuotation(selectedQuotationId, data);
      toast({
        title: 'Quotation Updated',
        description: 'The quotation has been updated successfully.',
      });
      navigateToView('list', null);
    }
  };


  const handleViewQuotation = (id: string) => {
    navigateToView('preview', id);
  };

  const handleEditQuotation = (id: string) => {
    navigateToView('edit', id);
  };

  const handleDeleteQuotation = async (id: string) => {
    const quotation = getQuotation(id);
    if (!quotation) return;

    const success = await archiveQuotation(quotation);
    if (success) {
      await refreshQuotations();
      toast({
        title: 'Quotation Archived',
        description: 'The quotation has been moved to the archive.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to archive quotation.',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreQuotation = async (archivedQuotation: ArchivedQuotation) => {
    const success = await restoreQuotation(archivedQuotation);
    if (success) {
      await refreshQuotations();
      toast({
        title: 'Quotation Restored',
        description: `Quote ${archivedQuotation.quoteNumber} has been restored.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to restore quotation.',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentDelete = async (id: string) => {
    const success = await permanentlyDeleteQuotation(id);
    if (success) {
      toast({
        title: 'Permanently Deleted',
        description: 'The quotation has been permanently removed.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to delete quotation. Admin access required.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateQuotation = async (id: string) => {
    const duplicated = await duplicateQuotation(id);
    if (duplicated) {
      toast({
        title: 'Quotation Duplicated',
        description: `Quote ${duplicated.quoteNumber} has been created.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to duplicate quotation.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (id: string, status: string, orderedItems?: string[], orderedQuantities?: Record<string, number>) => {
    const updateData: any = { status: status as any };
    if (status === 'accepted' && orderedItems) {
      updateData.orderedItems = orderedItems;
      if (orderedQuantities) updateData.orderedQuantities = orderedQuantities;
    }
    if (status === 'sent') {
      updateData.orderedItems = null;
      updateData.orderedQuantities = null;
    }
    await updateQuotation(id, updateData);
    toast({
      title: status === 'accepted' ? 'Order Marked as Received' 
           : status === 'finished' ? 'Marked as Finished (No Order)' 
           : status === 'sent' ? 'Moved Back to Sent' 
           : 'Status Updated',
      description: status === 'accepted' 
                   ? `Quotation marked as order received (${orderedItems?.length || 'all'} items).`
                 : status === 'finished' ? 'Quotation closed — no order received.' 
                 : status === 'sent' ? 'Quotation reopened and moved back to Sent status.' 
                 : `Quotation status changed to ${status}.`,
    });
  };

  const handleEditCustomer = async (id: string, data: { clientName: string; clientEmail: string; clientAddress: string }) => {
    await updateQuotation(id, {
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientAddress: data.clientAddress,
    });

    // Also update the customer record if it exists
    if (user) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', data.clientEmail)
        .single();

      if (existingCustomer) {
        await supabase
          .from('customers')
          .update({ name: data.clientName, email: data.clientEmail, address: data.clientAddress || null })
          .eq('id', existingCustomer.id);
      }
    }

    toast({
      title: 'Customer Updated',
      description: 'Customer details have been updated on the quotation.',
    });
  };

  const handleCreatorChange = async (id: string, newUserId: string) => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ user_id: newUserId })
        .eq('id', id);
      if (error) throw error;
      toast({
        title: 'Creator Updated',
        description: `Quotation reassigned to ${userNameMap[newUserId] || 'user'}.`,
      });
      refreshQuotations();
    } catch {
      toast({ title: 'Error', description: 'Failed to change creator.', variant: 'destructive' });
    }
  };

  const userList = useMemo(() => 
    Object.entries(userNameMap).map(([id, name]) => ({ id, name })),
    [userNameMap]
  );

  const filteredQuotations = useMemo(() => {
    let result = quotations;
    
    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(qt => qt.status !== 'finished');
    } else if (statusFilter === 'finished') {
      result = result.filter(qt => qt.status === 'finished');
    }

    // Expiring soon filter
    if (expiringSoonFilter) {
      const now = new Date();
      result = result.filter(qt => {
        if (qt.status === 'accepted' || qt.status === 'declined' || qt.status === 'finished') return false;
        const validUntil = new Date(qt.validUntil);
        const daysLeft = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysLeft >= 0 && daysLeft <= 7;
      });
    }
    
    // Handler filter
    if (handlerFilter !== 'all') {
      result = result.filter(qt => qt.userId === handlerFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (qt) =>
          qt.quoteNumber.toLowerCase().includes(q) ||
          qt.clientName.toLowerCase().includes(q) ||
          qt.clientEmail.toLowerCase().includes(q) ||
          qt.items.some((item) => item.sku.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [quotations, searchQuery, statusFilter, expiringSoonFilter, handlerFilter]);

  const finishedCount = useMemo(() => quotations.filter(q => q.status === 'finished').length, [quotations]);

  const selectedQuotation = selectedQuotationId ? getQuotation(selectedQuotationId) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { id: 'quotations', label: 'Quotations', icon: FolderOpen, active: ['list', 'create', 'edit', 'preview'].includes(currentView), onClick: () => navigateToView('list'), badge: null as number | null, visible: true },
    { id: 'archive', label: 'Archive', icon: Archive, active: currentView === 'archive', onClick: () => navigateToView('archive'), badge: archivedQuotations.length > 0 ? archivedQuotations.length : null, visible: true },
    { id: 'customers', label: 'Customers', icon: BookUser, active: ['customers', 'report'].includes(currentView), onClick: () => { setReportCustomer(null); navigateToView('customers'); }, badge: null, visible: true },
    { id: 'activity', label: 'Activity', icon: Activity, active: currentView === 'activity', onClick: () => navigateToView('activity'), badge: null, visible: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, active: currentView === 'reports', onClick: () => navigateToView('reports'), badge: null, visible: true },
    { id: 'recurring', label: 'Recurring', icon: RepeatIcon, active: currentView === 'recurring', onClick: () => navigateToView('recurring'), badge: null, visible: true },
    { id: 'versions', label: 'Versions', icon: History, active: false, onClick: () => navigate('/versions'), badge: null, visible: true },
    { id: 'users', label: 'Users', icon: Users, active: currentView === 'users', onClick: () => navigateToView('users'), badge: null, visible: isAdmin },
    { id: 'portal-accounts', label: 'Price Portal', icon: ShieldCheck, active: currentView === 'portal-accounts', onClick: () => navigateToView('portal-accounts'), badge: null, visible: canPricePortal },
    
    { id: 'settings', label: 'Settings', icon: SettingsIcon, active: currentView === 'settings', onClick: () => navigateToView('settings'), badge: null, visible: isAdmin },
  ].filter(item => item.visible);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b no-print">
        <div className="container py-2.5">
          <h1 className="sr-only">Quotation Dashboard</h1>
          {/* Brand row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 shrink overflow-hidden">
              <img src={logo} alt="Noga Engineering &amp; Technology" className="h-11 w-auto shrink-0" />

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(user.email?.split('@')[0]?.slice(0, 2) || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
                  {user.email?.split('@')[0]}
                </span>
              </div>

              {/* Online Users */}
              {onlineUsers.length > 0 && (
                <TooltipProvider>
                  <div className="hidden md:flex items-center gap-1 shrink-0">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <div className="flex -space-x-2">
                      {onlineUsers.slice(0, 5).map((ou, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Avatar className="h-6 w-6 border-2 border-background">
                              <AvatarFallback className="text-[9px] bg-green-500/15 text-green-700 dark:text-green-400">
                                {(ou.email?.split('@')[0]?.slice(0, 2) || '??').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {ou.email?.split('@')[0]} — online
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    {onlineUsers.length > 5 && (
                      <span className="text-[10px] text-muted-foreground ml-1">+{onlineUsers.length - 5}</span>
                    )}
                  </div>
                </TooltipProvider>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <HelpSection />
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
              <img src={thinkingInside} alt="Thinking Inside" className="h-11 w-auto shrink-0" />
            </div>
          </div>

          {/* Nav tabs row */}
          <nav aria-label="Main navigation" className="mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
            {currentView === 'list' && quotations.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAiAssistantOpen(true)} className="border-primary/40">
                  <Sparkles className="w-4 h-4 mr-1.5 text-primary" />
                  AI Quote
                </Button>
                <Button size="sm" onClick={() => navigateToView('create')}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Quote
                </Button>
              </>
            )}

            {/* Desktop inline tabs */}
            <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
              {navItems.map(item => (
                <Button
                  key={item.id}
                  aria-current={item.active ? 'page' : undefined}
                  variant={item.active ? 'default' : 'outline'}
                  size="sm"
                  onClick={item.onClick}
                  className={`relative ${item.active ? 'ring-2 ring-primary/50 shadow-sm' : ''}`}
                >
                  <item.icon className="w-4 h-4 mr-1.5" />
                  {item.label}
                  {item.badge != null && (
                    <span
                      className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full"
                      aria-label={`${item.badge} archived quotations`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Mobile drawer trigger */}
            <div className="lg:hidden ml-auto">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Open navigation menu">
                    <Menu className="w-4 h-4 mr-1.5" />
                    Menu
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[300px]">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav aria-label="Mobile navigation" className="flex flex-col gap-1.5 px-3 mt-2">
                    {navItems.map(item => (
                      <Button
                        key={item.id}
                        aria-current={item.active ? 'page' : undefined}
                        variant={item.active ? 'default' : 'outline'}
                        onClick={item.onClick}
                        className="justify-start w-full"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.label}
                        {item.badge != null && (
                          <span
                            className="ml-auto text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full"
                            aria-label={`${item.badge} archived quotations`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {currentView === 'list' && (
          <>
            {quotations.length === 0 ? (
              <EmptyState onCreateNew={() => navigateToView('create')} />
            ) : (
              <div className="space-y-6">
                <QuotationStats
                  quotations={quotations}
                  isAdmin={isAdmin}
                  userNameMap={userNameMap}
                  onFilterExpiring={() => {
                    setExpiringSoonFilter(prev => !prev);
                    setStatusFilter('all');
                  }}
                  expiringSoonActive={expiringSoonFilter}
                />
                <MarketTicker />
                <ItemPricesView compact />

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="heading-display text-2xl text-foreground">
                    Your Quotations
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {filteredQuotations.length} of {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
                    </p>
                    <ViewModeToggle
                      value={quotationsViewMode}
                      onChange={setQuotationsViewMode}
                      storageKey="quotations-view-mode"
                    />
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by quote #, client, SKU, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'active'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Active ({quotations.length - finishedCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('finished')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'finished'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Done — No Order ({finishedCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        statusFilter === 'all'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All ({quotations.length})
                    </button>
                  </div>
                  {Object.keys(userNameMap).length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <select
                        value={handlerFilter}
                        onChange={(e) => setHandlerFilter(e.target.value)}
                        className="text-xs font-medium rounded-md border border-input bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="all">All handlers</option>
                        {Object.entries(userNameMap).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <BulkActionsBar
                  selectedIds={selectedIds}
                  quotations={quotations}
                  onClearSelection={() => setSelectedIds([])}
                  onStatusChange={async (ids, status) => {
                    for (const id of ids) {
                      await updateQuotation(id, { status: status as any });
                    }
                    toast({ title: 'Status Updated', description: `${ids.length} quotation(s) updated to "${status}".` });
                  }}
                  onArchive={async (ids) => {
                    for (const id of ids) {
                      const q = getQuotation(id);
                      if (q) await archiveQuotation(q);
                    }
                    await refreshQuotations();
                    toast({ title: 'Archived', description: `${ids.length} quotation(s) archived.` });
                  }}
                />
                <div className="flex flex-col gap-4">
                  {filteredQuotations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedIds.length === filteredQuotations.length) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds(filteredQuotations.map(q => q.id));
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedIds.length === filteredQuotations.length && selectedIds.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                      {selectedIds.length > 0 && (
                        <span className="text-xs text-muted-foreground">({selectedIds.length} selected)</span>
                      )}
                    </div>
                  )}
                  <QuotationViews
                    mode={quotationsViewMode}
                    quotations={filteredQuotations}
                    selectedIds={selectedIds}
                    userNameMap={userNameMap}
                    userList={userList}
                    getEmailReadAt={(id) => getLatestRead(id)?.read_at ?? null}
                    onToggleSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    onView={handleViewQuotation}
                    onEdit={handleEditQuotation}
                    onDelete={handleDeleteQuotation}
                    onDuplicate={handleDuplicateQuotation}
                    onStatusChange={handleStatusChange}
                    onCreatorChange={handleCreatorChange}
                    onEditCustomer={handleEditCustomer}
                  />

                  {filteredQuotations.length === 0 && searchQuery && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No quotations match "{searchQuery}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {currentView === 'create' && (
           <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => navigateToView('list')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quotations
              </Button>
            </div>
            <h2 className="heading-display text-2xl text-foreground mb-6">
              Create New Quotation
            </h2>
            <QuotationForm
              onSubmit={(data) => { setAiPrefillData(null); handleCreateQuotation(data); }}
              initialData={aiPrefillData ?? undefined}
              existingQuotations={quotations}
            />
          </div>
        )}

         {currentView === 'edit' && selectedQuotation && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => {
                navigateToView('list', null);
              }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quotations
              </Button>
              <div className="flex gap-2">
                {/* Mark as Accepted */}
                {selectedQuotation.status === 'accepted' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500 bg-green-500 text-white hover:bg-green-600"
                      onClick={() => setEditOrderPickerOpen(true)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Accepted — Edit Order
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:border-green-500 hover:text-green-600"
                    onClick={() => setEditOrderPickerOpen(true)}
                  >
                    <Circle className="w-4 h-4 mr-1" />
                    Mark Accepted
                  </Button>
                )}
                <OrderLinePickerDialog
                  open={editOrderPickerOpen}
                  onOpenChange={setEditOrderPickerOpen}
                  items={selectedQuotation.items}
                  quoteNumber={selectedQuotation.quoteNumber}
                  currency={selectedQuotation.currency}
                  initialSelectedIds={selectedQuotation.orderedItems}
                  initialQuantities={selectedQuotation.orderedQuantities}
                  onConfirm={(selectedIds, qty) => handleStatusChange(selectedQuotation.id, 'accepted', selectedIds, qty)}
                />

                {/* Mark as Finished */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={selectedQuotation.status === 'finished' ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600' : 'hover:border-orange-500 hover:text-orange-500'}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      {selectedQuotation.status === 'finished' ? 'No Order' : 'Mark Finished'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {selectedQuotation.status === 'finished' ? 'Reopen Quotation?' : 'Mark as Finished?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedQuotation.status === 'finished'
                          ? `This will reopen "${selectedQuotation.quoteNumber}" and set its status back to sent.`
                          : `This will mark "${selectedQuotation.quoteNumber}" as finished (no order received).`
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleStatusChange(selectedQuotation.id, selectedQuotation.status === 'finished' ? 'sent' : 'finished')}
                        className={selectedQuotation.status === 'finished' ? '' : 'bg-orange-500 hover:bg-orange-600'}
                      >
                        {selectedQuotation.status === 'finished' ? 'Reopen' : 'Mark as Finished'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <h2 className="heading-display text-2xl text-foreground mb-6">
              Edit Quotation - {selectedQuotation.quoteNumber}
            </h2>
            <QuotationForm 
              onSubmit={handleUpdateQuotation} 
              initialData={selectedQuotation}
              isEditing
            />
          </div>
        )}

        {currentView === 'preview' && selectedQuotation && (
          <QuotationPreview
            quotation={selectedQuotation}
            emailTracking={getTrackingForQuotation(selectedQuotation.id)}
            onBack={() => {
              navigateToView('list', null);
            }}
            onEdit={() => {
              navigateToView('edit');
            }}
            onEditCustomer={handleEditCustomer}
            onStatusChange={handleStatusChange}
          />
        )}

        {currentView === 'archive' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Archive className="w-6 h-6 text-muted-foreground" />
                <h2 className="heading-display text-2xl text-foreground">
                  Archived Quotations
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {archivedQuotations.length} archived
              </p>
            </div>
            {archivedQuotations.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No archived quotations</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Deleted quotations will appear here
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedQuotations.map((quotation) => (
                  <ArchivedQuotationCard
                    key={quotation.id}
                    quotation={quotation}
                    isAdmin={isAdmin}
                    onRestore={handleRestoreQuotation}
                    onPermanentDelete={handlePermanentDelete}
                  />
                ))}
              </div>
            )}
            {!isAdmin && archivedQuotations.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Only administrators can permanently delete archived quotations.
              </p>
            )}
          </div>
        )}

        {currentView === 'users' && isAdmin && (
          <UserManagement onOpenPricePortal={() => navigateToView('portal-accounts')} />
        )}

        {currentView === 'portal-accounts' && canPricePortal && (
          <CustomerAccountsAdmin />
        )}


        {currentView === 'settings' && isAdmin && (
          <div className="space-y-6">
            <h2 className="heading-display text-2xl">Settings</h2>
            <CatalogSyncPanel />
            <ProductMediaAdmin />
          </div>
        )}

        {currentView === 'customers' && (
          <CustomerList
            onSelectCustomer={(email) => {
              setSearchQuery(email);
              navigateToView('list');
            }}
            onViewReport={(customer) => {
              setReportCustomer(customer);
              navigateToView('report');
            }}
          />
        )}

        {currentView === 'recurring' && (
          <RecurringQuotationsView onBack={() => navigateToView('list')} />
        )}

        {currentView === 'activity' && (
          <ActivityFeed userNameMap={userNameMap} limit={50} />
        )}



        {currentView === 'report' && reportCustomer && (
          <CustomerReport
            customerName={reportCustomer.name}
            customerEmail={reportCustomer.email}
            customerAddress={reportCustomer.address}
            quotations={quotations}
            onBack={() => {
              setReportCustomer(null);
              navigateToView('customers');
            }}
            onViewQuotation={(id) => {
              navigateToView('preview', id);
            }}
          />
        )}

        {currentView === 'reports' && (
          <QuotationReport
            quotations={quotations}
            onBack={() => navigateToView('list')}
            onViewQuotation={(id) => navigateToView('preview', id)}
            userNameMap={userNameMap}
          />
        )}
      </main>

      {/* Footer - hidden in print, shown in app */}
      <footer className="border-t bg-muted/30 mt-auto no-print">
        <div className="container py-4">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div>
              <p className="font-semibold text-foreground text-sm">Noga Engineering & Technology Ltd.</p>
              <p className="text-xs text-muted-foreground">Hakryia 1, Dora Industrial Area, 2283201, Shlomi, Israel</p>
              <a 
                href="https://www.nogamt.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                www.nogamt.com
              </a>
            </div>
          </div>
        </div>
      </footer>

      <TeamChat userNameMap={userNameMap} />

      <AIQuoteAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        onPrefill={(data) => {
          setAiPrefillData(data);
          navigateToView('create');
        }}
      />
    </div>
  );
};

export default Index;
