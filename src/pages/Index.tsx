import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotations } from '@/hooks/useQuotations';
import { useArchivedQuotations, ArchivedQuotation } from '@/hooks/useArchivedQuotations';
import { useAuth } from '@/hooks/useAuth';
import { useEmailTracking } from '@/hooks/useEmailTracking';
import { QuotationFormData } from '@/types/quotation';
import { QuotationForm } from '@/components/quotation/QuotationForm';
import { QuotationCard } from '@/components/quotation/QuotationCard';
import { QuotationPreview } from '@/components/quotation/QuotationPreview';
import { ArchivedQuotationCard } from '@/components/quotation/ArchivedQuotationCard';
import { EmptyState } from '@/components/quotation/EmptyState';
import { QuotationStats } from '@/components/quotation/QuotationStats';

import { UserManagement } from '@/components/UserManagement';
import { CustomerList } from '@/components/CustomerList';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, LogOut, Archive, FolderOpen, Search, Users, User, BookUser, X, Circle } from 'lucide-react';
import { TeamChat } from '@/components/TeamChat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import thinkingInside from '@/assets/thinking-inside.png';
import { generateQuotationPdf } from '@/lib/pdf-generator';
import { Quotation } from '@/types/quotation';
import { FileText } from 'lucide-react';

type View = 'list' | 'create' | 'edit' | 'preview' | 'archive' | 'users' | 'customers';

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
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<{ email: string; lastSeen: string }[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    const newQuotation = await addQuotation(data);
    if (newQuotation) {
      toast({
        title: 'Quotation Created',
        description: `Quote ${newQuotation.quoteNumber} has been created successfully.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to create quotation. Please try again.',
        variant: 'destructive',
      });
    }
    setCurrentView('list');
  };

  const handleUpdateQuotation = (data: QuotationFormData) => {
    if (selectedQuotationId) {
      updateQuotation(selectedQuotationId, data);
      toast({
        title: 'Quotation Updated',
        description: 'The quotation has been updated successfully.',
      });
      setSelectedQuotationId(null);
      setCurrentView('list');
    }
  };

  // TEMPORARY: Test PDF with 20 line items for page numbering verification
  const handleTestPdf = async () => {
    const testItems = Array.from({ length: 20 }, (_, i) => ({
      id: crypto.randomUUID(),
      sku: `SKU-${String(i + 1).padStart(3, '0')}`,
      description: `Sample Product Item #${i + 1} - Test Description`,
      leadTime: `${Math.floor(Math.random() * 12) + 1} weeks`,
      moq: Math.floor(Math.random() * 100) + 1,
      unitPrice: Math.round(Math.random() * 500 * 100) / 100,
      discountPercent: i % 5 === 0 ? 10 : 0,
      notes: i % 3 === 0 ? 'Sample note for testing' : '',
    }));
    const testQuotation: Quotation = {
      id: 'test-pdf',
      userId: user?.id || '',
      quoteNumber: 'TEST-20ITEMS-001',
      clientName: 'Test Customer Ltd.',
      clientEmail: 'test@example.com',
      clientAddress: '123 Test Street, Test City, 12345',
      items: testItems,
      taxRate: 17,
      discountType: 'percentage',
      discountValue: 5,
      notes: 'This is a test PDF with 20 line items to verify multi-page numbering.',
      createdAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft',
      currency: 'USD',
      attachments: [],
      reminderSentAt: null,
      followUpNotifiedAt: null,
    };
    try {
      const { blob, fileName } = await generateQuotationPdf(testQuotation);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Test PDF Generated', description: '20-item PDF downloaded.' });
    } catch (err) {
      console.error('Test PDF error:', err);
      toast({ title: 'Error', description: 'Failed to generate test PDF.', variant: 'destructive' });
    }
  };

  const handleViewQuotation = (id: string) => {
    setSelectedQuotationId(id);
    setCurrentView('preview');
  };

  const handleEditQuotation = (id: string) => {
    setSelectedQuotationId(id);
    setCurrentView('edit');
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

  const handleStatusChange = async (id: string, status: string) => {
    await updateQuotation(id, { status: status as any });
    toast({
      title: status === 'accepted' ? 'Order Marked as Received' : 'Status Reset',
      description: status === 'accepted' ? 'Quotation marked as order received.' : 'Quotation status reset to draft.',
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
    if (!searchQuery.trim()) return quotations;
    const q = searchQuery.toLowerCase();
    return quotations.filter(
      (qt) =>
        qt.quoteNumber.toLowerCase().includes(q) ||
        qt.clientName.toLowerCase().includes(q) ||
        qt.clientEmail.toLowerCase().includes(q) ||
        qt.items.some((item) => item.sku.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
    );
  }, [quotations, searchQuery]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b no-print">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="NogaMT Logo" className="h-12 w-auto" />
              
              <div className="hidden sm:flex items-center gap-2 ml-2 px-3 py-1.5 rounded-full bg-muted/50">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(user.email?.split('@')[0]?.slice(0, 2) || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
                  {user.email?.split('@')[0]}
                </span>
              </div>

              {/* Online Users */}
              {onlineUsers.length > 0 && (
                <TooltipProvider>
                  <div className="hidden sm:flex items-center gap-1 ml-2">
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
            <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {currentView === 'list' && quotations.length > 0 && (
                <Button onClick={() => setCurrentView('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Quote
                </Button>
              )}
              {currentView === 'list' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentView('archive')}
                  className="relative"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                  {archivedQuotations.length > 0 && (
                    <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
                      {archivedQuotations.length}
                    </span>
                  )}
                </Button>
              )}
              {currentView === 'list' && isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentView('users')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
              )}
              {currentView === 'list' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentView('customers')}
                >
                  <BookUser className="w-4 h-4 mr-2" />
                  Customers
                </Button>
              )}
              {currentView === 'archive' && (
                <Button variant="outline" size="sm" onClick={() => setCurrentView('list')}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Quotations
                </Button>
              )}
              {currentView === 'users' && (
                <Button variant="outline" size="sm" onClick={() => setCurrentView('list')}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Quotations
                </Button>
              )}
              {currentView === 'customers' && (
                <Button variant="outline" size="sm" onClick={() => setCurrentView('list')}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Quotations
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
              <img src={thinkingInside} alt="Thinking Inside" className="h-12 w-auto" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {currentView === 'list' && (
          <>
            {quotations.length === 0 ? (
              <EmptyState onCreateNew={() => setCurrentView('create')} />
            ) : (
              <div className="space-y-6">
                <QuotationStats quotations={quotations} isAdmin={isAdmin} userNameMap={userNameMap} />
                <div className="flex items-center justify-between">
                  <h2 className="heading-display text-2xl text-foreground">
                    Your Quotations
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredQuotations.length} of {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
                  </p>
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
                <div className="flex flex-col gap-4">
                  {filteredQuotations.map((quotation, index) => (
                    <QuotationCard
                      key={quotation.id}
                      quotation={quotation}
                      index={filteredQuotations.length - index}
                      creatorName={userNameMap[quotation.userId] || quotation.userId?.slice(0, 6)}
                      userList={userList}
                      emailReadAt={getLatestRead(quotation.id)?.read_at ?? null}
                      onView={handleViewQuotation}
                      onEdit={handleEditQuotation}
                      onDelete={handleDeleteQuotation}
                      onDuplicate={handleDuplicateQuotation}
                       onStatusChange={handleStatusChange}
                       onCreatorChange={handleCreatorChange}
                       onEditCustomer={handleEditCustomer}
                     />
                  ))}
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
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => setCurrentView('list')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quotations
              </Button>
            </div>
            <h2 className="heading-display text-2xl text-foreground mb-6">
              Create New Quotation
            </h2>
            <QuotationForm onSubmit={handleCreateQuotation} />
          </div>
        )}

        {currentView === 'edit' && selectedQuotation && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => {
                setSelectedQuotationId(null);
                setCurrentView('list');
              }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quotations
              </Button>
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
              setSelectedQuotationId(null);
              setCurrentView('list');
            }}
            onEdit={() => {
              setCurrentView('edit');
            }}
            onEditCustomer={handleEditCustomer}
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
          <UserManagement />
        )}

        {currentView === 'customers' && (
          <CustomerList onSelectCustomer={(email) => {
            setSearchQuery(email);
            setCurrentView('list');
          }} />
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
    </div>
  );
};

export default Index;
