-- Add user_id column to customers table to link customers to specific users
ALTER TABLE public.customers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can delete customers" ON public.customers;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can view their own customers"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create their own customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own customers"
ON public.customers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);