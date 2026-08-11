INSERT INTO public.product_media (sku, image_path, model_path, step_path)
SELECT p || s, 'UF73' || s || '/image.png', 'UF73' || s || '/model.glb', 'UF73' || s || '/step.stp'
FROM unnest(ARRAY['UF71','UF72','UF74','UF75','UF76']) p,
     unnest(ARRAY['13','19','22','25','30']) s
ON CONFLICT (sku) DO UPDATE SET
  image_path = EXCLUDED.image_path,
  model_path = EXCLUDED.model_path,
  step_path = EXCLUDED.step_path,
  updated_at = now();