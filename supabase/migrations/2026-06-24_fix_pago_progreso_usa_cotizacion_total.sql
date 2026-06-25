-- 2026-06-24_fix_pago_progreso_usa_cotizacion_total.sql
-- FIX: el % de pago usaba proyectos.costo_total (columna que se vuelve stale cuando
-- la cotización cambia de total/IVA después de aprobar). El resto de la app usa
-- cotizaciones.total (vivo), causando que proyectos pagados no llegaran a 100%.
-- La vista ahora divide entre cotizaciones.total (fallback a costo_total si no hay cotización).
-- Aplicada en prod (czbmqzimjlwwgcglubey) vía MCP el 2026-06-24. Sin cambios de datos.
CREATE OR REPLACE VIEW v_proyecto_pago_progreso AS
SELECT p.id AS proyecto_id,
       COALESCE(c.total, p.costo_total)::numeric(14,2) AS costo_total,
       COALESCE(SUM(pp.monto), 0) AS total_pagado,
       CASE WHEN COALESCE(c.total, p.costo_total, 0) > 0
            THEN LEAST(100, ROUND(COALESCE(SUM(pp.monto), 0) / COALESCE(c.total, p.costo_total) * 100, 1))
            ELSE 0 END AS pct_pagado
FROM proyectos p
LEFT JOIN cotizaciones c ON c.id = p.cotizacion_id
LEFT JOIN proyecto_pagos pp ON pp.proyecto_id = p.id
GROUP BY p.id, c.total, p.costo_total;
