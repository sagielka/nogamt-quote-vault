import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotations } from '@/hooks/useQuotations';
import { useArchivedQuotations, ArchivedQuotation } from '@/hooks/useArchivedQuotations';
import { useAuth } from '@/hooks/useAuth';
import { QuotationFormData } from '@/types/quotation';
import { QuotationForm } from '@/components/quotation/QuotationForm';
import { QuotationCard } from '@/components/quotation/QuotationCard';
import { QuotationPreview } from '@/components/quotation/QuotationPreview';
import { ArchivedQuotationCard } from '@/components/quotation/ArchivedQuotationCard';
import { EmptyState } from '@/components/quotation/EmptyState';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { UserManagement } from '@/components/UserManagement';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, LogOut, Archive, FolderOpen, Search, Users, User } from 'lucide-react';
import { TeamChat } from '@/components/TeamChat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import thinkingInside from '@/assets/thinking-inside.png';

type View = 'list' | 'create' | 'edit' | 'preview' | 'archive' | 'users';

const Index = () => {
  const { quotations, addQuotation, updateQuotation, deleteQuotation, duplicateQuotation, getQuotation, refreshQuotations } = useQuotations();
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
  const [desktopAppVersion, setDesktopAppVersion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    let cancelled = false;

    const loadDesktopVersion = async () => {
      const electronAPI = (window as any).electronAPI as any;
      if (!electronAPI?.isElectron || !electronAPI?.getAppVersion) return;

      try {
        const v = await electronAPI.getAppVersion();
        if (!cancelled) setDesktopAppVersion(v);
      } catch {
        // ignore
      }
    };

    loadDesktopVersion();

    return () => {
      cancelled = true;
    };
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
              <SyncStatusIndicator />
              <div className="hidden sm:flex items-center gap-2 ml-2 px-3 py-1.5 rounded-full bg-muted/50">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(user.email?.slice(0, 2) || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground truncate max-w-[150px]">
                  {user.email}
                </span>
              </div>
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
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  {filteredQuotations.map((quotation, index) => (
                    <QuotationCard
                      key={quotation.id}
                      quotation={quotation}
                      index={filteredQuotations.length - index}
                      onView={handleViewQuotation}
                      onEdit={handleEditQuotation}
                      onDelete={handleDeleteQuotation}
                      onDuplicate={handleDuplicateQuotation}
                      onStatusChange={handleStatusChange}
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
            onBack={() => {
              setSelectedQuotationId(null);
              setCurrentView('list');
            }}
            onEdit={() => {
              setCurrentView('edit');
            }}
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
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground/60">
                  v{window.electronAPI?.isElectron && desktopAppVersion ? desktopAppVersion : (import.meta.env.PACKAGE_VERSION || '1.0.0')}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  window.electronAPI?.isElectron 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {window.electronAPI?.isElectron ? '🖥️ Desktop' : '🌐 Web'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <TeamChat />
    </div>
  );
};

export default Index;
