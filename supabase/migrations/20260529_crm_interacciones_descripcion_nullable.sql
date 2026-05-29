-- Las notas previas al agendar una cita son opcionales en la UI.
-- crm_interacciones.descripcion era NOT NULL, lo que rompía el insert.
ALTER TABLE public.crm_interacciones ALTER COLUMN descripcion DROP NOT NULL;
