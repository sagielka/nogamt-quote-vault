INSERT INTO public.product_media (sku, image_path, model_path, step_path)
VALUES
 ('UF7313','UF7313/image.png','UF7313/model.glb','UF7313/step.stp'),
 ('UF7319','UF7319/image.png','UF7319/model.glb','UF7319/step.stp'),
 ('UF7322','UF7322/image.png','UF7322/model.glb','UF7322/step.stp'),
 ('UF7325','UF7325/image.png','UF7325/model.glb','UF7325/step.stp'),
 ('UF7330','UF7330/image.png','UF7330/model.glb','UF7330/step.stp'),
 ('UF-GD-D013','UF7313/image.png','UF7313/model.glb','UF7313/step.stp'),
 ('UF-GD-D019','UF7319/image.png','UF7319/model.glb','UF7319/step.stp'),
 ('UF-GD-D022','UF7322/image.png','UF7322/model.glb','UF7322/step.stp'),
 ('UF-GD-D025','UF7325/image.png','UF7325/model.glb','UF7325/step.stp'),
 ('UF-GD-D030','UF7330/image.png','UF7330/model.glb','UF7330/step.stp')
ON CONFLICT (sku) DO UPDATE SET
 image_path = EXCLUDED.image_path,
 model_path = EXCLUDED.model_path,
 step_path = EXCLUDED.step_path,
 updated_at = now();