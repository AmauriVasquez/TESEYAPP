# Parámetros de corte láser — semilla para el cotizador

> Fuente: `PARAMETROS DE CORTE CNC .pptx` (INVENTARIO, Drive). 22 sets de parámetros
> capturados del controlador (tipo CypCut). **Máquina: láser de fibra 2000 W.**
> Extraído el 2026-06-13. Este documento es **dato de referencia** para el módulo de
> cálculo de corte del cotizador (capa `parametros_maquina`). Ver [DISENO_COTIZADOR.md](DISENO_COTIZADOR.md).

## Para qué sirve

El dato crítico para costear es la **velocidad de corte (mm/min)** por material/calibre/gas.
De ahí sale el tiempo de corte y el costo:

```
minutos_corte = longitud_corte_mm / velocidad_mm_min  +  n_pierces * tiempo_por_pierce
costo_corte    = minutos_corte * costo_min
costo_min      = potencia_kW * cfe_kwh / 60  +  costo_gas_min  +  mtto_min
```

La longitud de corte y los pierces salen del DXF; la velocidad y el gas salen de esta tabla;
`cfe_kwh`, `costo_gas_min`, `mtto_min` y `tiempo_por_pierce` son insumos por capturar (ver abajo).

## Tabla de parámetros (los 22 sets)

Espesores en mm son aproximados por calibre (referencia, el cotizador debe indexar por el
**calibre/medida nombrado**, no por mi mm estimado). "Gas real" = lo que dicen las notas del
operador; "Campo máquina" = lo que mostraba el dropdown (no siempre coinciden, ver Notas).

| # | Material | Medida | Espesor aprox. | Gas real | Veloc. mm/min | Boquilla | Potencia | Presión | Pulso | Foco | Campo máquina |
|--:|---|---|--:|---|--:|---|--:|--:|--:|--:|---|
| 1 | Galvanizado | Cal. 24 | 0.6 mm | Aire comp. | **13,500** | 1.0 sencilla | 2000 W | 1.3 bar | 5000 Hz | 0 | Nitrogen |
| 2 | Galvanizado | Cal. 16 | 1.5 mm | Aire comp. | **8,500** | 1.0 sencilla | 2000 W | 1.3 bar | 5000 Hz | -1 | Nitrogen |
| 3 | Aluminio | Cal. 11 | 2.0 mm (nota) | Aire comp. | **3,100** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | -1 | Nitrogen |
| 4 | Inox | 1/4" | 6.35 mm | Aire comp. | **1,600** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | -3.5 | Nitrogen |
| 5 | Inox antiderrapante | 1/4" | 6.35 mm | Aire comp. | **1,200** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | -4 | Nitrogen |
| 6 | Inox | Cal. 10 | 3.4 mm | Aire comp. | **1,500** | 1.5 sencilla | 2000 W (duty 80%) | 1.3 bar | 5000 Hz | -3.5 | Nitrogen |
| 7 | Inox | 1/8" | 3.2 mm | Aire comp. | **3,000** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | -2 | Nitrogen |
| 8 | Inox | Cal. 14 | 1.9 mm | Aire comp. | **8,500** | 1.0 sencilla | 2000 W | 1.3 bar | 35000 Hz | -1 | Nitrogen |
| 9 | Inox | Cal. 16 | 1.5 mm | Aire comp. | **9,500** | 1.0 sencilla | 2000 W | 1.3 bar | 35000 Hz | -1 | Nitrogen |
| 10 | Inox | Cal. 20 | 0.9 mm | Aire comp. | **14,000** | 1.0 sencilla | 2000 W | 1.3 bar | 35000 Hz | 0 | Nitrogen |
| 11 | Inox | Cal. 12 | 2.7 mm | Aire comp. | **3,000** | 1.5 sencilla | 1800 W (90%) | 1.3 bar | 5000 Hz | -1.6 | Nitrogen |
| 12 | Acero carbón antiderrapante | 1/8" | 3.2 mm | Aire comp. | **1,500** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | ~-3 | Nitrogen |
| 13 | Acero carbón antiderrapante | 1/8" | 3.2 mm | Oxígeno | **3,400** | 1.0 doble | 2000 W | 1.3 bar | 5000 Hz | 5.4 | Oxygen |
| 14 | Acero carbón | Placa 1/4" | 6.35 mm | Oxígeno | **1,700** | 1.5 doble | 2000 W | 0.5 bar | 3000 Hz | 5 | Oxygen |
| 15 | Acero carbón | Cal. 14 (placa) | 1.9 mm | Oxígeno | **3,800** | 1.0 doble | 2000 W (duty 50%) | 1.8 bar | 5000 Hz | 6 | Oxygen |
| 16 | Acero carbón | Cal. 18 | 1.2 mm | Aire comp. | **8,000** | 1.0 sencilla | 2000 W | 1.3 bar | 5000 Hz | 0 | Nitrogen |
| 17 | Acero carbón | Cal. 14 | 1.9 mm | Aire comp. | **7,500** | 1.0 doble | 2000 W | 1.3 bar | 5000 Hz | -1 | Nitrogen |
| 18 | Acero carbón | Placa 1/8" | 3.2 mm | Aire comp. | **4,000** | 1.5 sencilla | 2000 W | 1.3 bar | 5000 Hz | -1.5 | Nitrogen |
| 19 | Acero carbón | Placa 3/8" | 9.5 mm | Oxígeno | **1,300** | 1.5 doble | 2000 W | 0.5 bar | 5000 Hz | 5.5 | Oxygen |
| 20 | Acero carbón | Placa 3/16" | 4.8 mm | Oxígeno | **2,400** | 1.0 doble | 1800 W (90%) | 0.5 bar | 5000 Hz | 7.5 | Oxygen |
| 21 | Acero carbón | Placa 1/2" | 12.7 mm | Oxígeno | **1,000** | 2.5 doble | 2000 W | 0.5 bar | 5000 Hz | 6 | Oxygen |
| 22 | Acero carbón | Placa 1/8" | 3.2 mm | Oxígeno | **3,400** | 1.0 doble | 2000 W | 1.3 bar | 5000 Hz | 5.4 | Oxygen |

## Notas y asunciones (pendientes de confirmar con el operador)

- **Gas real vs campo máquina:** el dropdown "Gas type" mostraba *Nitrogen* en los cortes que las
  notas describen como **aire comprimido**. Para costeo se toma el **gas real de las notas**: aire
  comprimido (compresor, costo ≈ solo electricidad) en galvanizado/inox/aluminio/acero delgado, y
  **oxígeno** (cilindro, costo real) en las placas gruesas de acero al carbón. **Confirmar.**
- **Boquilla doble** se usa en cortes con oxígeno y placas gruesas (consumible/mtto mayor).
- **Anomalías a validar:** Inox 1/4" (1,600) sale algo más rápido que Inox Cal. 10 (1,500) pese a ser
  más grueso; antiderrapante 1/8" en aire (1,500) vs oxígeno (3,400). Son valores tuneados en máquina;
  se dejan tal cual salvo que el operador corrija.
- Potencia base 2000 W (máquina al 100%); algunos sets a 1800 W (90%) o duty reducido.

## Insumos faltantes para cerrar el costo de corte

Estos NO vienen en las capturas; hay que capturarlos para calcular `costo_min`:

1. **$/kWh de CFE** (tarifa real).
2. **Costo del gas por minuto** — aire comprimido (≈ electricidad del compresor) vs **oxígeno**
   (costo del cilindro ÷ minutos de uso). Dato pendiente: precio del cilindro de O₂ y su rendimiento.
3. **Tiempo por pierce** (segundos por perforación de inicio).
4. **Costo de boquilla/consumibles y mantenimiento por hora.**

## Forma propuesta para la futura tabla `parametros_maquina`

Cuando se construya el módulo de cálculo de corte, esta tabla se carga como lookup
(`maquina = 'laser_fibra_2kw'`), indexada por `material + medida + gas`, con `velocidad_mm_min`,
`boquilla_mm`, `boquilla_tipo`, `potencia_w`, `gas`, versionada por vigencia (igual patrón que
`config_precios`). El cotizador, dado el material/calibre de la partida y la longitud del DXF,
busca la velocidad y deriva minutos → costo de corte.
