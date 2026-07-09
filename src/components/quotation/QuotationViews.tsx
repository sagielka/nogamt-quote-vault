import { useState, useMemo } from 'react';
import { Quotation } from '@/types/quotation';
import { QuotationCard } from '@/components/quotation/QuotationCard';
import { ViewMode } from '@/components/ViewModeToggle';
import { formatCurrency, formatDate, calculateTotal, getStatusColor } from '@/lib/quotation-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  mode: ViewMode;
  quotations: Quotation[];
  selectedIds: string[];
  userNameMap: Record<string, string>;
  userList: { id: string; name: string }[];
  getEmailReadAt: (id: string) => string | null;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onStatusChange: (id: string, status: Quotation['status'], orderedItems?: string[]) => void;
  onCreatorChange: (id: string, newUserId: string) => void;
  onEditCustomer: (id: string, data: { clientName: string; clientEmail: string; clientAddress: string }) => void;
}

const STATUS_COLUMNS: Quotation['status'][] = ['draft', 'sent', 'accepted', 'declined', 'finished'];
const STATUS_LABEL: Record<Quotation['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  finished: 'Finished',
};

type SortKey = 'quoteNumber' | 'clientName' | 'total' | 'status' | 'createdAt' | 'validUntil';

export const QuotationViews = (props: Props) => {
  const { mode, quotations } = props;

  if (mode === 'grid') {
    return (
      <div className="flex flex-col gap-4">
        {quotations.map((quotation, index) => (
          <QuotationCard
            key={quotation.id}
            quotation={quotation}
            index={quotations.length - index}
            creatorName={props.userNameMap[quotation.userId] || quotation.userId?.slice(0, 6)}
            userList={props.userList}
            emailReadAt={props.getEmailReadAt(quotation.id)}
            isSelected={props.selectedIds.includes(quotation.id)}
            onToggleSelect={props.onToggleSelect}
            onView={props.onView}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
            onDuplicate={props.onDuplicate}
            onStatusChange={props.onStatusChange}
            onCreatorChange={props.onCreatorChange}
            onEditCustomer={props.onEditCustomer}
          />
        ))}
      </div>
    );
  }

  if (mode === 'list') return <CompactList {...props} />;
  if (mode === 'table') return <TableView {...props} />;
  if (mode === 'kanban') return <KanbanView {...props} />;
  return null;
};

const CompactList = ({ quotations, selectedIds, onToggleSelect, onView, userNameMap, getEmailReadAt }: Props) => {
  return (
    <div className="flex flex-col divide-y divide-primary/10 rounded-lg border border-primary/10 overflow-hidden bg-card">
      {quotations.map((q) => {
        const total = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
        const readAt = getEmailReadAt(q.id);
        return (
          <div
            key={q.id}
            className={`flex items-center gap-3 px-3 py-2 hover:bg-primary/5 transition-colors cursor-pointer ${selectedIds.includes(q.id) ? 'bg-primary/5' : ''}`}
            onClick={() => onView(q.id)}
          >
            <Checkbox
              checked={selectedIds.includes(q.id)}
              onCheckedChange={() => onToggleSelect(q.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="font-mono text-xs text-primary w-32 shrink-0 truncate">{q.quoteNumber}</span>
            <span className="text-sm truncate flex-1 min-w-0">{q.clientName}</span>
            <Badge variant="outline" className={`${getStatusColor(q.status)} text-[10px]`}>{STATUS_LABEL[q.status]}</Badge>
            <span className="text-sm font-medium w-28 text-right shrink-0">{formatCurrency(total, q.currency)}</span>
            <span className="text-xs text-muted-foreground w-24 text-right shrink-0 hidden sm:inline">{formatDate(q.createdAt)}</span>
            <span className="text-xs text-muted-foreground w-20 text-right shrink-0 hidden md:inline">
              {userNameMap[q.userId]?.split(' ')[0] || '—'}
            </span>
            {readAt && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title={`Read ${formatDate(readAt)}`} />}
          </div>
        );
      })}
    </div>
  );
};

const TableView = (props: Props) => {
  const { quotations, selectedIds, onToggleSelect, onView, userNameMap } = props;
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...quotations];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'quoteNumber': av = a.quoteNumber; bv = b.quoteNumber; break;
        case 'clientName': av = a.clientName.toLowerCase(); bv = b.clientName.toLowerCase(); break;
        case 'total':
          av = calculateTotal(a.items, a.taxRate, a.discountType, a.discountValue);
          bv = calculateTotal(b.items, b.taxRate, b.discountType, b.discountValue);
          break;
        case 'status': av = a.status; bv = b.status; break;
        case 'validUntil': av = new Date(a.validUntil).getTime(); bv = new Date(b.validUntil).getTime(); break;
        default: av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [quotations, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${className || ''}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children} <SortIcon k={k} />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-primary/10 bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary/30 border-b border-primary/10">
          <tr>
            <th className="px-3 py-2 w-10"></th>
            <Th k="quoteNumber">Quote #</Th>
            <Th k="clientName">Client</Th>
            <Th k="status">Status</Th>
            <Th k="total" className="text-right">Total</Th>
            <Th k="createdAt">Created</Th>
            <Th k="validUntil">Valid Until</Th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Handler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/10">
          {sorted.map((q) => {
            const total = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
            return (
              <tr
                key={q.id}
                onClick={() => onView(q.id)}
                className={`cursor-pointer hover:bg-primary/5 ${selectedIds.includes(q.id) ? 'bg-primary/5' : ''}`}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.includes(q.id)} onCheckedChange={() => onToggleSelect(q.id)} />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-primary whitespace-nowrap">{q.quoteNumber}</td>
                <td className="px-3 py-2 max-w-xs truncate">{q.clientName}</td>
                <td className="px-3 py-2"><Badge variant="outline" className={`${getStatusColor(q.status)} text-[10px]`}>{STATUS_LABEL[q.status]}</Badge></td>
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatCurrency(total, q.currency)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(q.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(q.validUntil)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{userNameMap[q.userId]?.split(' ')[0] || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const KanbanView = ({ quotations, onView, selectedIds, onToggleSelect }: Props) => {
  const grouped = useMemo(() => {
    const g: Record<Quotation['status'], Quotation[]> = {
      draft: [], sent: [], accepted: [], declined: [], finished: [],
    };
    quotations.forEach(q => { g[q.status].push(q); });
    return g;
  }, [quotations]);

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {STATUS_COLUMNS.map(status => (
        <div key={status} className="rounded-lg border border-primary/10 bg-card p-2 min-h-[200px]">
          <div className="flex items-center justify-between px-1 py-1 mb-2">
            <Badge variant="outline" className={`${getStatusColor(status)} text-[10px]`}>{STATUS_LABEL[status]}</Badge>
            <span className="text-xs text-muted-foreground">{grouped[status].length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {grouped[status].map(q => {
              const total = calculateTotal(q.items, q.taxRate, q.discountType, q.discountValue);
              return (
                <div
                  key={q.id}
                  onClick={() => onView(q.id)}
                  className={`rounded-md border border-primary/10 bg-background p-2 cursor-pointer hover:border-primary/40 transition-colors ${selectedIds.includes(q.id) ? 'border-primary/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[10px] text-primary truncate">{q.quoteNumber}</span>
                    <Checkbox
                      checked={selectedIds.includes(q.id)}
                      onCheckedChange={() => onToggleSelect(q.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  <div className="text-xs font-medium truncate">{q.clientName}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                    <span>{formatDate(q.createdAt)}</span>
                    <span className="font-medium text-foreground">{formatCurrency(total, q.currency)}</span>
                  </div>
                </div>
              );
            })}
            {grouped[status].length === 0 && (
              <div className="text-[11px] text-muted-foreground/60 text-center py-4">Empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
