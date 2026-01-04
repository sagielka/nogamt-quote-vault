-- Enable realtime for quotations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;

-- Enable realtime for archived_quotations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.archived_quotations;