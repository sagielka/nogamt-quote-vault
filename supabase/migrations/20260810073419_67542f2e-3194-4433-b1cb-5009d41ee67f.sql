INSERT INTO public.user_roles (user_id, role)
VALUES
  ('22040cee-4ca2-4f00-b533-7f545024af8a', 'user'),
  ('3bd1fc91-2ac9-429e-9cce-6646894855c7', 'user')
ON CONFLICT (user_id, role) DO NOTHING;