-- Add optional 3D model URL for curator-uploaded GLB files.
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS model_url VARCHAR(500) NOT NULL DEFAULT '';
