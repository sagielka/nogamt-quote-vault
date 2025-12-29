import { useState } from 'react';
import { useQuotations } from '@/hooks/useQuotations';
import { QuotationFormData } from '@/types/quotation';
import { QuotationForm } from '@/components/quotation/QuotationForm';
import { QuotationCard } from '@/components/quotation/QuotationCard';
import { QuotationPreview } from '@/components/quotation/QuotationPreview';
import { EmptyState } from '@/components/quotation/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.jpg';
import thinkingInside from '@/assets/thinking-inside.png';

type View = 'list' | 'create' | 'edit' | 'preview';

const Index = () => {
  const { quotations, addQuotation, updateQuotation, deleteQuotation, getQuotation } = useQuotations();
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreateQuotation = (data: QuotationFormData) => {
    const newQuotation = addQuotation(data);
    toast({
      title: 'Quotation Created',
      description: `Quote ${newQuotation.quoteNumber} has been created successfully.`,
    });
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

  const handleDeleteQuotation = (id: string) => {
    deleteQuotation(id);
    toast({
      title: 'Quotation Deleted',
      description: 'The quotation has been removed.',
      variant: 'destructive',
    });
  };

  const selectedQuotation = selectedQuotationId ? getQuotation(selectedQuotationId) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b no-print">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="NogaMT Logo" className="h-12 w-auto" />
            </div>
            <div className="flex items-center gap-4">
              {currentView === 'list' && quotations.length > 0 && (
                <Button onClick={() => setCurrentView('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Quote
                </Button>
              )}
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
                    {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {quotations.map((quotation) => (
                    <QuotationCard
                      key={quotation.id}
                      quotation={quotation}
                      onView={handleViewQuotation}
                      onEdit={handleEditQuotation}
                      onDelete={handleDeleteQuotation}
                    />
                  ))}
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
    </div>
  );
};

export default Index;