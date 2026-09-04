-- Migration to add financial projections support

CREATE TABLE IF NOT EXISTS public.financial_projections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    starting_balances jsonb NOT NULL DEFAULT '{}'::jsonb,
    payroll jsonb NOT NULL DEFAULT '{}'::jsonb,
    sales jsonb NOT NULL DEFAULT '{}'::jsonb,
    opex jsonb NOT NULL DEFAULT '{}'::jsonb,
    cogs jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    owner_id uuid REFERENCES auth.users(id) -- Assuming auth schema is standard supabase
);

-- Enable RLS
ALTER TABLE public.financial_projections ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Users can view their own projections."
    ON public.financial_projections FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own projections."
    ON public.financial_projections FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projections."
    ON public.financial_projections FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projections."
    ON public.financial_projections FOR DELETE
    USING (auth.uid() = owner_id);
