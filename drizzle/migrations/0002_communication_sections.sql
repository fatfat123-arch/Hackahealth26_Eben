ALTER TABLE public.patients
  ADD COLUMN communicates text[] NOT NULL DEFAULT '{}',
  ADD COLUMN understanding_needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN facilitators text[] NOT NULL DEFAULT '{}';
UPDATE public.patients SET how_to = 'Cette page vous aide à comprendre ce que je souhaite vous dire. Découvrez mes gestes dans mon dictionnaire et ce qui est important pour moi dans les rubriques ci-dessous. Adressez-vous directement à moi, avec des phrases simples, et laissez-moi le temps de répondre.' WHERE trim(how_to) = '';
COMMENT ON COLUMN public.patients.photo_alt IS 'DEPRECATED: alt text is now generated as "Photo de {prénom}"';