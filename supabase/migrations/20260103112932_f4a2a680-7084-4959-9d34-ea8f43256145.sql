-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy: users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create archived_quotations table (same structure as quotations)
CREATE TABLE public.archived_quotations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id uuid NOT NULL,
    user_id uuid NOT NULL,
    quote_number text NOT NULL,
    client_name text NOT NULL,
    client_email text NOT NULL,
    client_address text,
    items jsonb NOT NULL,
    tax_rate numeric NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'USD',
    valid_until timestamp with time zone NOT NULL,
    notes text,
    status text,
    discount_type text,
    discount_value numeric DEFAULT 0,
    attachments jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    archived_at timestamp with time zone NOT NULL DEFAULT now(),
    archived_by uuid NOT NULL
);

-- Enable RLS on archived_quotations
ALTER TABLE public.archived_quotations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own archived quotations
CREATE POLICY "Users can view their own archived quotations"
ON public.archived_quotations
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Users can insert their own archived quotations (when deleting)
CREATE POLICY "Users can archive their own quotations"
ON public.archived_quotations
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() = archived_by);

-- RLS: Only admins can permanently delete from archive
CREATE POLICY "Only admins can delete from archive"
ON public.archived_quotations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Assign admin role to your account (nogamt@x.co)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'nogamt@x.co';