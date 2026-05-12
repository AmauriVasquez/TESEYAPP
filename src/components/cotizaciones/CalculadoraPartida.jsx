import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Package, Clock, Users, Calculator, Scale, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const UNIDADES_UI = ['M2', 'ML', 'PZA', 'KG'];
const VALUE_NONE = '__none__';
const num = (v) => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createMaterialRow = () => ({
  id: Date.now() + Math.random(),
  materialId: '',
  descripcion: '',
  unidad: 'PZA',
  costo: 0,
  cantidad: 0,
  ancho: '',
  alto: '',
  longitud: '',
  mermaPct: 0,
  pesoTeorico: 0,
  esAcero: false,
});

const createMaquiladoRow = () => ({
  id: Date.now() + Math.random(),
  tarifaId: '',
  descripcion: '',
  minutos: 0,
  tarifa: 0,
});

const createManoObraRow = () => ({
  id: Date.now() + Math.random(),
  tarifaId: '',
  descripcion: '',
  horas: 0,
  tarifa: 0,
});

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(num(n));
}

function normalizeMaterial(row) {
  return {
    id: row.id,
    descripcion: row.descripcion ?? 'Sin descripción',
    unidad: String(row.unidad ?? 'PZA').toUpperCase().trim(),
    costo: num(row.costo ?? row.precio ?? 0),
    peso_teorico: num(row.peso_teorico),
    es_acero: Boolean(row.es_acero),
  };
}

export default function CalculadoraPartida({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [materialesDb, setMaterialesDb] = useState([]);
  const [maquiladoDb, setMaquiladoDb] = useState([]);
  const [manoObraDb, setManoObraDb] = useState([]);

  const [materiales, setMateriales] = useState([createMaterialRow()]);
  const [maquilado, setMaquilado] = useState([createMaquiladoRow()]);
  const [manoObra, setManoObra] = useState([createManoObraRow()]);

  const [indirectosPct, setIndirectosPct] = useState(10);
  const [margenPct, setMargenPct] = useState(30);
  const [precioVentaKg, setPrecioVentaKg] = useState(60);
  const [precioVentaFinal, setPrecioVentaFinal] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [materialesRes, tarifasRes] = await Promise.all([
          supabase.from('materiales').select('id, descripcion, unidad, costo, precio, peso_teorico, es_acero').order('descripcion'),
          supabase.from('tarifas_produccion').select('id, tipo, descripcion, tarifa, unidad').order('tipo').order('descripcion'),
        ]);

        if (materialesRes.error) throw materialesRes.error;
        if (tarifasRes.error) throw tarifasRes.error;
        if (!mounted) return;

        const mats = (materialesRes.data || []).map(normalizeMaterial);
        const tarifas = tarifasRes.data || [];
        setMaterialesDb(mats);
        setMaquiladoDb(tarifas.filter((t) => String(t.tipo || '').toUpperCase() === 'MAQUILADO'));
        setManoObraDb(tarifas.filter((t) => String(t.tipo || '').toUpperCase() === 'MANO_OBRA'));
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'No se pudieron cargar los catálogos de la calculadora.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const updateMaterial = (idx, field, value) => {
    setMateriales((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };
  const updateMaquilado = (idx, field, value) => {
    setMaquilado((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };
  const updateManoObra = (idx, field, value) => {
    setManoObra((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const unidadesTotales = (row) => {
    const unidad = String(row.unidad || 'PZA').toUpperCase();
    if (unidad === 'M2') return num(row.ancho) * num(row.alto) * num(row.cantidad);
    if (unidad === 'ML') return num(row.longitud) * num(row.cantidad);
    return num(row.cantidad);
  };
  const subtotalMaterial = (row) => (unidadesTotales(row) * num(row.costo)) * (1 + (num(row.mermaPct) / 100));
  const pesoFila = (row) => unidadesTotales(row) * num(row.pesoTeorico);

  const costoMateriales = useMemo(() => materiales.reduce((acc, row) => acc + subtotalMaterial(row), 0), [materiales]);
  const costoMaquilado = useMemo(() => maquilado.reduce((acc, row) => acc + ((num(row.minutos) * num(row.tarifa))), 0), [maquilado]);
  const costoManoObra = useMemo(() => manoObra.reduce((acc, row) => acc + ((num(row.horas) * num(row.tarifa))), 0), [manoObra]);

  const costoDirecto = num(costoMateriales) + num(costoMaquilado) + num(costoManoObra);
  const montoIndirectos = costoDirecto * (num(indirectosPct) / 100);
  const costoTotal = costoDirecto + montoIndirectos;
  const divisorMargen = 1 - (num(margenPct) / 100);
  const precioSugeridoDesglose = divisorMargen > 0 ? costoTotal / divisorMargen : 0;

  const pesoTotalAcero = useMemo(
    () => materiales.reduce((acc, row) => (row.esAcero ? acc + pesoFila(row) : acc), 0),
    [materiales]
  );
  const precioSugeridoVolumen = pesoTotalAcero * num(precioVentaKg);

  return (
    <div className="max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Calculator className="h-5 w-5 text-amber-600" />
          Calculadora de Partida
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar calculadora">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando catálogos...
        </div>
      )}

      {!loading && error && (
        <div className="px-6 pt-4">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
          </Card>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-10">
          <div className="space-y-4 lg:col-span-7">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-blue-600" />Materiales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {materiales.map((row, idx) => {
                  const unidad = String(row.unidad || 'PZA').toUpperCase();
                  return (
                    <div key={row.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <Label className="text-xs">Material</Label>
                          <Select value={row.materialId || VALUE_NONE} onValueChange={(value) => {
                            if (value === VALUE_NONE) {
                              updateMaterial(idx, 'materialId', '');
                              return;
                            }
                            const selected = materialesDb.find((mat) => String(mat.id) === value);
                            if (!selected) return;
                            setMateriales((prev) => prev.map((item, itemIdx) => (itemIdx === idx ? {
                              ...item,
                              materialId: String(selected.id),
                              descripcion: selected.descripcion,
                              unidad: UNIDADES_UI.includes(selected.unidad) ? selected.unidad : 'PZA',
                              costo: num(selected.costo),
                              pesoTeorico: num(selected.peso_teorico),
                              esAcero: Boolean(selected.es_acero),
                            } : item)));
                          }}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar material" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={VALUE_NONE}>Sin selección</SelectItem>
                              {materialesDb.map((mat) => (
                                <SelectItem key={mat.id} value={String(mat.id)}>{mat.descripcion}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Unidad</Label>
                          <Select value={unidad} onValueChange={(value) => updateMaterial(idx, 'unidad', value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNIDADES_UI.map((opt) => (
                                <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Costo</Label>
                          <Input type="number" min="0" step="0.01" value={row.costo ?? ''} onChange={(e) => updateMaterial(idx, 'costo', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">% Merma</Label>
                          <Input type="number" min="0" step="0.01" value={row.mermaPct ?? ''} onChange={(e) => updateMaterial(idx, 'mermaPct', e.target.value)} />
                        </div>
                        <div className="md:col-span-2 flex items-end justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setMateriales((prev) => prev.filter((_, i) => i !== idx))} disabled={materiales.length <= 1}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                        {unidad === 'M2' && (
                          <>
                            <div className="md:col-span-3"><Label className="text-xs">Ancho (m)</Label><Input type="number" min="0" step="0.01" value={row.ancho ?? ''} onChange={(e) => updateMaterial(idx, 'ancho', e.target.value)} /></div>
                            <div className="md:col-span-3"><Label className="text-xs">Alto (m)</Label><Input type="number" min="0" step="0.01" value={row.alto ?? ''} onChange={(e) => updateMaterial(idx, 'alto', e.target.value)} /></div>
                            <div className="md:col-span-3"><Label className="text-xs">Cant</Label><Input type="number" min="0" step="0.01" value={row.cantidad ?? ''} onChange={(e) => updateMaterial(idx, 'cantidad', e.target.value)} /></div>
                          </>
                        )}
                        {unidad === 'ML' && (
                          <>
                            <div className="md:col-span-4"><Label className="text-xs">Longitud (m)</Label><Input type="number" min="0" step="0.01" value={row.longitud ?? ''} onChange={(e) => updateMaterial(idx, 'longitud', e.target.value)} /></div>
                            <div className="md:col-span-3"><Label className="text-xs">Cant</Label><Input type="number" min="0" step="0.01" value={row.cantidad ?? ''} onChange={(e) => updateMaterial(idx, 'cantidad', e.target.value)} /></div>
                          </>
                        )}
                        {(unidad === 'PZA' || unidad === 'KG') && (
                          <div className="md:col-span-4"><Label className="text-xs">Cant</Label><Input type="number" min="0" step="0.01" value={row.cantidad ?? ''} onChange={(e) => updateMaterial(idx, 'cantidad', e.target.value)} /></div>
                        )}
                        <div className="md:col-span-3"><Label className="text-xs">Peso Teórico</Label><Input type="number" min="0" step="0.01" value={row.pesoTeorico ?? ''} onChange={(e) => updateMaterial(idx, 'pesoTeorico', e.target.value)} /></div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Subtotal: {formatCurrency(subtotalMaterial(row))}
                        {row.esAcero ? ` · Peso fila: ${pesoFila(row).toFixed(2)} kg` : ''}
                      </p>
                    </div>
                  );
                })}
                <Button variant="outline" className="gap-1" onClick={() => setMateriales((prev) => [...prev, createMaterialRow()])}>
                  <Plus className="h-4 w-4" /> Agregar Material
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-amber-600" />Maquilado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {maquilado.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <Label className="text-xs">Proceso</Label>
                      <Select value={row.tarifaId || VALUE_NONE} onValueChange={(value) => {
                        if (value === VALUE_NONE) {
                          updateMaquilado(idx, 'tarifaId', '');
                          updateMaquilado(idx, 'descripcion', '');
                          updateMaquilado(idx, 'tarifa', 0);
                          return;
                        }
                        const selected = maquiladoDb.find((item) => String(item.id) === value);
                        if (!selected) return;
                        setMaquilado((prev) => prev.map((item, itemIdx) => itemIdx === idx ? {
                          ...item,
                          tarifaId: String(selected.id),
                          descripcion: selected.descripcion ?? '',
                          tarifa: num(selected.tarifa),
                        } : item));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar proceso" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={VALUE_NONE}>Sin selección</SelectItem>
                          {maquiladoDb.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>{item.descripcion}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2"><Label className="text-xs">Minutos</Label><Input type="number" min="0" step="0.01" value={row.minutos ?? ''} onChange={(e) => updateMaquilado(idx, 'minutos', e.target.value)} /></div>
                    <div className="md:col-span-2"><Label className="text-xs">Tarifa</Label><Input value={row.tarifa ?? ''} readOnly /></div>
                    <div className="md:col-span-2 flex items-end text-sm font-medium">{formatCurrency(num(row.minutos) * num(row.tarifa))}</div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setMaquilado((prev) => prev.filter((_, i) => i !== idx))} disabled={maquilado.length <= 1}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="gap-1" onClick={() => setMaquilado((prev) => [...prev, createMaquiladoRow()])}>
                  <Plus className="h-4 w-4" /> Agregar Proceso
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-emerald-600" />Mano de Obra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {manoObra.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <Label className="text-xs">Tarea</Label>
                      <Select value={row.tarifaId || VALUE_NONE} onValueChange={(value) => {
                        if (value === VALUE_NONE) {
                          updateManoObra(idx, 'tarifaId', '');
                          updateManoObra(idx, 'descripcion', '');
                          updateManoObra(idx, 'tarifa', 0);
                          return;
                        }
                        const selected = manoObraDb.find((item) => String(item.id) === value);
                        if (!selected) return;
                        setManoObra((prev) => prev.map((item, itemIdx) => itemIdx === idx ? {
                          ...item,
                          tarifaId: String(selected.id),
                          descripcion: selected.descripcion ?? '',
                          tarifa: num(selected.tarifa),
                        } : item));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar tarea" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={VALUE_NONE}>Sin selección</SelectItem>
                          {manoObraDb.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>{item.descripcion}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2"><Label className="text-xs">Horas</Label><Input type="number" min="0" step="0.01" value={row.horas ?? ''} onChange={(e) => updateManoObra(idx, 'horas', e.target.value)} /></div>
                    <div className="md:col-span-2"><Label className="text-xs">Tarifa</Label><Input value={row.tarifa ?? ''} readOnly /></div>
                    <div className="md:col-span-2 flex items-end text-sm font-medium">{formatCurrency(num(row.horas) * num(row.tarifa))}</div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setManoObra((prev) => prev.filter((_, i) => i !== idx))} disabled={manoObra.length <= 1}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="gap-1" onClick={() => setManoObra((prev) => [...prev, createManoObraRow()])}>
                  <Plus className="h-4 w-4" /> Agregar Tarea
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 lg:sticky lg:top-4 lg:self-start">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" />Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1 rounded-lg border p-3">
                  <div className="font-semibold">Bloque A: Desglose</div>
                  <div className="flex justify-between"><span>Materiales</span><span>{formatCurrency(costoMateriales)}</span></div>
                  <div className="flex justify-between"><span>Maquilado</span><span>{formatCurrency(costoMaquilado)}</span></div>
                  <div className="flex justify-between"><span>Mano de Obra</span><span>{formatCurrency(costoManoObra)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span>Costo Directo</span><span className="font-semibold">{formatCurrency(costoDirecto)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>% Indirectos</span><Input className="w-20 text-right" type="number" min="0" step="0.1" value={indirectosPct} onChange={(e) => setIndirectosPct(e.target.value)} /></div>
                  <div className="flex justify-between"><span>Monto Indirectos</span><span>{formatCurrency(montoIndirectos)}</span></div>
                  <div className="flex justify-between"><span>Costo Total</span><span className="font-semibold">{formatCurrency(costoTotal)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>% Margen Utilidad</span><Input className="w-20 text-right" type="number" min="0" step="0.1" value={margenPct} onChange={(e) => setMargenPct(e.target.value)} /></div>
                  <div className="flex justify-between border-t pt-1 font-semibold text-blue-700"><span>Precio Sugerido Desglose</span><span>{formatCurrency(precioSugeridoDesglose)}</span></div>
                </div>

                <div className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center gap-1 font-semibold"><Scale className="h-4 w-4" />Bloque B: Volumen (Acero)</div>
                  <div className="flex justify-between"><span>Peso Total Acero</span><span>{pesoTotalAcero.toFixed(2)} kg</span></div>
                  <div className="flex items-center justify-between gap-2"><span>Precio Venta por KG ($)</span><Input className="w-24 text-right" type="number" min="0" step="0.1" value={precioVentaKg} onChange={(e) => setPrecioVentaKg(e.target.value)} /></div>
                  <div className="flex justify-between border-t pt-1 font-semibold text-emerald-700"><span>Precio Sugerido Volumen</span><span>{formatCurrency(precioSugeridoVolumen)}</span></div>
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="font-semibold">Cierre</div>
                  <Label>Precio Venta Final (Manual)</Label>
                  <Input type="number" min="0" step="0.01" value={precioVentaFinal} onChange={(e) => setPrecioVentaFinal(e.target.value)} className="h-11 text-right text-base font-semibold" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
