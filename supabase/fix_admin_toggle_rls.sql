-- Fix RLS Policies for Admin Toggle
-- This allows admins to update the isAdmin field

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Admin can update all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- This function runs with SECURITY DEFINER so it uses the table owner's privileges
-- and avoids recursive self-selects inside policies.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(u."isAdmin", false)
    FROM public.users u
    WHERE u.id = auth.uid();
$$;

-- Ensure function owner bypasses RLS; table owners bypass RLS by default in Postgres.
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Allow users to update their own profile (except isAdmin)
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND (
        -- Prevent changing isAdmin by non-admins
        (SELECT u."isAdmin" FROM users u WHERE u.id = auth.uid()) IS NOT DISTINCT FROM "isAdmin"
    )
);

-- Allow admins to update any user including isAdmin field
CREATE POLICY "Admin can update all users"
ON users
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- Allow admins to select all users
DROP POLICY IF EXISTS "Admin can select all users" ON users;
CREATE POLICY "Admin can select all users"
ON users
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

-- Allow users to select their own profile
DROP POLICY IF EXISTS "Users can select own profile" ON users;
CREATE POLICY "Users can select own profile"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow admins to delete any user
DROP POLICY IF EXISTS "Admin can delete all users" ON users;
CREATE POLICY "Admin can delete all users"
ON users
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Allow users to delete their own profile (optional; comment out if not desired)
DROP POLICY IF EXISTS "Users can delete own profile" ON users;
CREATE POLICY "Users can delete own profile"
ON users
FOR DELETE
TO authenticated
USING (auth.uid() = id);
