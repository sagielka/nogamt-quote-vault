-- Assign the orphaned customer record to the matching user by email
UPDATE public.customers 
SET user_id = '0278e621-4480-4eb4-94f0-74541dece44c' 
WHERE user_id IS NULL AND email = 'sagi@noga.com';

-- Delete any remaining orphaned records that can't be assigned (safety net)
DELETE FROM public.customers WHERE user_id IS NULL;

-- Add NOT NULL constraint to enforce ownership
ALTER TABLE public.customers ALTER COLUMN user_id SET NOT NULL;