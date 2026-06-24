-- 2026-06-23_ingresos_v2_f1_view.sql  (Ingresos V2 — F1)
-- Vista de presentación (no almacena nada). Aplicada en prod vía MCP el 2026-06-23.
CREATE OR REPLACE VIEW v_proyecto_pago_progreso AS
SELECT p.id AS proyecto_id,
       p.costo_total,
       COALESCE(SUM(pp.monto), 0) AS total_pagado,
       CASE WHEN COALESCE(p.costo_total, 0) > 0
            THEN LEAST(100, ROUND(COALESCE(SUM(pp.monto), 0) / p.costo_total * 100, 1))
            ELSE 0 END AS pct_pagado
FROM proyectos p
LEFT JOIN proyecto_pagos pp ON pp.proyecto_id = p.id
GROUP BY p.id, p.costo_total;
