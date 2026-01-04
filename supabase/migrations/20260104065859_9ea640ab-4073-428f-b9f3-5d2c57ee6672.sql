-- Drop existing restrictive policies on quotations
DROP POLICY IF EXISTS "Users can view their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can create their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can update their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can delete their own quotations" ON public.quotations;

-- Create new policies - all authenticated users can see all quotations
CREATE POLICY "Authenticated users can view all quotations" 
ON public.quotations 
FOR SELECT 
TO authenticated
USING (true);

-- Users can only create quotations with their own user_id
CREATE POLICY "Users can create their own quotations" 
ON public.quotations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- All authenticated users can update any quotation
CREATE POLICY "Authenticated users can update quotations" 
ON public.quotations 
FOR UPDATE 
TO authenticated
USING (true);

-- All authenticated users can delete any quotation (moves to archive)
CREATE POLICY "Authenticated users can delete quotations" 
ON public.quotations 
FOR DELETE 
TO authenticated
USING (true);

-- Drop existing policies on archived_quotations
DROP POLICY IF EXISTS "Users can view their own archived quotations or admins see all" ON public.archived_quotations;
DROP POLICY IF EXISTS "Users can archive their own quotations" ON public.archived_quotations;

-- All authenticated users can view all archived quotations
CREATE POLICY "Authenticated users can view all archived quotations" 
ON public.archived_quotations 
FOR SELECT 
TO authenticated
USING (true);

-- All authenticated users can archive quotations
CREATE POLICY "Authenticated users can archive quotations" 
ON public.archived_quotations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = archived_by);

-- Drop and recreate customer policies for shared access
DROP POLICY IF EXISTS "Authenticated users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can create their own customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete their own customers" ON public.customers;

-- All authenticated users can view all customers
CREATE POLICY "Authenticated users can view all customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (true);

-- Users can create customers with their own user_id
CREATE POLICY "Authenticated users can create customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- All authenticated users can update any customer
CREATE POLICY "Authenticated users can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (true);

-- All authenticated users can delete any customer
CREATE POLICY "Authenticated users can delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (true);