import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Package, Clock, Users, Calculator, Scale, DollarSign } from 'lucide-react';

const UNIDADES = ['M2', 'ML', 'PZA', 'KG'];

const emptyMaterial = () => ({
  id: Date.now(),
  nombre: '',
  unidad: 'PZA',
  costoUnitario: 0,
  esAcero: true,
  pesoTeorico: 0,
  ancho: '',
  alto: '',
  cantidadPzas: '',
  longitud: '',
  cantidad: '',
  pctMerma: 0,
});

const emptyCorte = () => ({ id: Date.now(), proceso: '', minutos: 0, tarifaMin: 0 });
const emptyManoObra = () => ({ id: Date.now(), tarea: '', horas: 0, tarifaHora: 0 });

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

export default function CalculadoraCostosPartida() {
  const [materiales, setMateriales] = useState([emptyMaterial()]);
  const [cortes, setCortes] = useState([emptyCorte()]);
  const [manoObra, setManoObra] = useState([emptyManoObra()]);
  const [indirectosPct, setIndirectosPct] = useState(0);
  const [margenPct, setMargenPct] = useState(0);
  const [precioVentaKg, setPrecioVentaKg] = useState(0);
  const [precioFinalManual, setPrecioFinalManual] = useState('');

  const updateMaterial = (idx, field, value) => {
    setMateriales((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const totalUnidadesMaterial = (m) => {
    const u = (m.unidad || 'PZA').toUpperCase();
    if (u === 'M2') {
      const ancho = parseFloat(m.ancho) || 0;
      const alto = parseFloat(m.alto) || 0;
      const cant = parseFloat(m.cantidadPzas) || 0;
      return ancho * alto * cant;
    }
    if (u === 'ML') {
      const long = parseFloat(m.longitud) || 0;
      const cant = parseFloat(m.cantidadPzas) || 0;
      return long * cant;
    }
    return parseFloat(m.cantidad) || 0;
  };

  const subtotalFilaMaterial = (m) => {
    const tot = totalUnidadesMaterial(m);
    const costo = parseFloat(m.costoUnitario) || 0;
    const sub = tot * costo;
    const merma = parseFloat(m.pctMerma) || 0;
    return sub * (1 + merma / 100);
  };

  const pesoTotalFila = (m) => {
    const tot = totalUnidadesMaterial(m);
    const peso = parseFloat(m.pesoTeorico) || 0;
    return tot * peso;
  };

  const sumaMateriales = useMemo(
    () => materiales.reduce((s, m) => s + subtotalFilaMaterial(m), 0),
    [materiales]
  );
  const sumaCorte = useMemo(
    () => cortes.reduce((s, c) => s + (parseFloat(c.minutos) || 0) * (parseFloat(c.tarifaMin) || 0), 0),
    [cortes]
  );
  const sumaManoObra = useMemo(
    () => manoObra.reduce((s, o) => s + (parseFloat(o.horas) || 0) * (parseFloat(o.tarifaHora) || 0), 0),
    [manoObra]
  );

  const costoDirecto = sumaMateriales + sumaCorte + sumaManoObra;
  const indirectosVal = costoDirecto * ((parseFloat(indirectosPct) || 0) / 100);
  const costoTotal = costoDirecto + indirectosVal;
  const margen = parseFloat(margenPct) || 0;
  const precioSugeridoDesglose = margen < 100 ? costoTotal / (1 - margen / 100) : costoTotal;

  const pesoTotalProyecto = useMemo(
    () => materiales.filter((m) => m.esAcero).reduce((s, m) => s + pesoTotalFila(m), 0),
    [materiales]
  );
  const precioSugeridoVolumen = pesoTotalProyecto * (parseFloat(precioVentaKg) || 0);

  const diferencia = precioSugeridoVolumen - precioSugeridoDesglose;
  const precioFinalNum = parseFloat(precioFinalManual) || 0;

  return (
    <div className="space-y-6">
      {/* Sección Materiales */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Materiales
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-2 font-medium text-gray-700">Nombre</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700 w-20">Unidad</th>
                <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Costo Unit.</th>
                <th className="text-center py-2 px-2 font-medium text-gray-700 w-28">Es Acero</th>
                <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Peso Teór.</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700">Cantidad (según unidad)</th>
                <th className="text-right py-2 px-2 font-medium text-gray-700 w-20">% Merma</th>
                <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Subtotal Fila</th>
                <th className="text-right py-2 px-2 font-medium text-gray-700 w-24">Peso Total Fila</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m, idx) => {
                const u = (m.unidad || 'PZA').toUpperCase();
                return (
                  <tr key={m.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 px-2">
                      <Input
                        value={m.nombre}
                        onChange={(e) => updateMaterial(idx, 'nombre', e.target.value)}
                        placeholder="Nombre material"
                        className="text-sm h-8"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select value={m.unidad} onValueChange={(v) => updateMaterial(idx, 'unidad', v)}>
                        <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.costoUnitario || ''}
                        onChange={(e) => updateMaterial(idx, 'costoUnitario', e.target.value)}
                        className="text-sm h-8 text-right"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Switch
                        checked={m.esAcero !== false}
                        onCheckedChange={(v) => updateMaterial(idx, 'esAcero', v)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.pesoTeorico || ''}
                        onChange={(e) => updateMaterial(idx, 'pesoTeorico', e.target.value)}
                        placeholder="kg"
                        className="text-sm h-8 text-right"
                      />
                    </td>
                    <td className="py-2 px-2">
                      {u === 'M2' && (
                        <div className="flex flex-wrap gap-1 items-center">
                          <Input type="number" min="0" step="0.01" placeholder="Ancho m" value={m.ancho || ''} onChange={(e) => updateMaterial(idx, 'ancho', e.target.value)} className="w-20 h-8 text-sm" />
                          <span>×</span>
                          <Input type="number" min="0" step="0.01" placeholder="Alto m" value={m.alto || ''} onChange={(e) => updateMaterial(idx, 'alto', e.target.value)} className="w-20 h-8 text-sm" />
                          <span>×</span>
                          <Input type="number" min="0" placeholder="Pzas" value={m.cantidadPzas || ''} onChange={(e) => updateMaterial(idx, 'cantidadPzas', e.target.value)} className="w-16 h-8 text-sm" />
                        </div>
                      )}
                      {u === 'ML' && (
                        <div className="flex flex-wrap gap-1 items-center">
                          <Input type="number" min="0" step="0.01" placeholder="Long m" value={m.longitud || ''} onChange={(e) => updateMaterial(idx, 'longitud', e.target.value)} className="w-24 h-8 text-sm" />
                          <span>×</span>
                          <Input type="number" min="0" placeholder="Pzas" value={m.cantidadPzas || ''} onChange={(e) => updateMaterial(idx, 'cantidadPzas', e.target.value)} className="w-16 h-8 text-sm" />
                        </div>
                      )}
                      {(u === 'PZA' || u === 'KG') && (
                        <Input type="number" min="0" step="0.01" placeholder="Cantidad" value={m.cantidad || ''} onChange={(e) => updateMaterial(idx, 'cantidad', e.target.value)} className="w-24 h-8 text-sm" />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.pctMerma || ''}
                        onChange={(e) => updateMaterial(idx, 'pctMerma', e.target.value)}
                        className="text-sm h-8 text-right w-16"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-800 tabular-nums">
                      {formatCurrency(subtotalFilaMaterial(m))}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600 tabular-nums bg-gray-50">
                      {pesoTotalFila(m).toFixed(2)} kg
                    </td>
                    <td className="py-2 px-2">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setMateriales((p) => p.filter((_, i) => i !== idx))} disabled={materiales.length <= 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setMateriales((p) => [...p, emptyMaterial()])}>
          <Plus className="w-4 h-4" /> Agregar material
        </Button>
      </div>

      {/* Sección Tiempos de Corte / Maquilado */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Tiempos de Corte / Maquilado
        </h3>
        <div className="space-y-2">
          {cortes.map((c, idx) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <Input value={c.proceso} onChange={(e) => setCortes((p) => p.map((x, i) => (i === idx ? { ...x, proceso: e.target.value } : x)))} placeholder="Proceso" className="w-40 h-8 text-sm" />
              <Input type="number" min="0" step="0.01" placeholder="Min" value={c.minutos || ''} onChange={(e) => setCortes((p) => p.map((x, i) => (i === idx ? { ...x, minutos: e.target.value } : x)))} className="w-20 h-8 text-sm" />
              <Input type="number" min="0" step="0.01" placeholder="Tarifa/min" value={c.tarifaMin || ''} onChange={(e) => setCortes((p) => p.map((x, i) => (i === idx ? { ...x, tarifaMin: e.target.value } : x)))} className="w-24 h-8 text-sm" />
              <span className="text-sm font-medium text-gray-700 tabular-nums">
                = {formatCurrency((parseFloat(c.minutos) || 0) * (parseFloat(c.tarifaMin) || 0))}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setCortes((p) => p.filter((_, i) => i !== idx))} disabled={cortes.length <= 1}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setCortes((p) => [...p, emptyCorte()])}>
          <Plus className="w-4 h-4" /> Agregar proceso
        </Button>
      </div>

      {/* Sección Mano de Obra y Acabados */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Mano de Obra y Acabados
        </h3>
        <div className="space-y-2">
          {manoObra.map((o, idx) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <Input value={o.tarea} onChange={(e) => setManoObra((p) => p.map((x, i) => (i === idx ? { ...x, tarea: e.target.value } : x)))} placeholder="Tarea" className="w-40 h-8 text-sm" />
              <Input type="number" min="0" step="0.01" placeholder="Horas" value={o.horas || ''} onChange={(e) => setManoObra((p) => p.map((x, i) => (i === idx ? { ...x, horas: e.target.value } : x)))} className="w-20 h-8 text-sm" />
              <Input type="number" min="0" step="0.01" placeholder="Tarifa/hora" value={o.tarifaHora || ''} onChange={(e) => setManoObra((p) => p.map((x, i) => (i === idx ? { ...x, tarifaHora: e.target.value } : x)))} className="w-24 h-8 text-sm" />
              <span className="text-sm font-medium text-gray-700 tabular-nums">
                = {formatCurrency((parseFloat(o.horas) || 0) * (parseFloat(o.tarifaHora) || 0))}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setManoObra((p) => p.filter((_, i) => i !== idx))} disabled={manoObra.length <= 1}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setManoObra((p) => [...p, emptyManoObra()])}>
          <Plus className="w-4 h-4" /> Agregar tarea
        </Button>
      </div>

      {/* Panel Resumen Financiero (fijo, visión dual) */}
      <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm p-5 sticky bottom-0 z-10">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Resumen Financiero
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BLOQUE A: Desglose */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Por desglose</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Costo directo (Materiales + Corte + MO):</span><span className="font-medium tabular-nums">{formatCurrency(costoDirecto)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600">Indirectos (%):</span>
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" step="0.01" value={indirectosPct || ''} onChange={(e) => setIndirectosPct(e.target.value)} className="w-16 h-8 text-sm text-right" />
                  <span className="font-medium tabular-nums">= {formatCurrency(indirectosVal)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-semibold text-gray-800">Costo total:</span><span className="font-semibold tabular-nums">{formatCurrency(costoTotal)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600">Margen utilidad (%):</span>
                <Input type="number" min="0" max="99" step="0.5" value={margenPct || ''} onChange={(e) => setMargenPct(e.target.value)} className="w-16 h-8 text-sm text-right" />
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="font-bold text-blue-700">Precio sugerido (desglose):</span>
                <span className="font-bold text-blue-700 tabular-nums">{formatCurrency(precioSugeridoDesglose)}</span>
              </div>
            </div>
          </div>

          {/* BLOQUE B: Volumen (solo acero) */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1"><Scale className="w-4 h-4" /> Por volumen (solo acero)</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Peso total del proyecto (kg):</span><span className="font-medium tabular-nums">{pesoTotalProyecto.toFixed(2)}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600">Precio venta por kg ($):</span>
                <Input type="number" min="0" step="0.01" value={precioVentaKg || ''} onChange={(e) => setPrecioVentaKg(e.target.value)} className="w-24 h-8 text-sm text-right" />
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="font-bold text-emerald-700">Precio sugerido (volumen):</span>
                <span className="font-bold text-emerald-700 tabular-nums">{formatCurrency(precioSugeridoVolumen)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE C: Comparativa y precio final */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-gray-700">Comparativa:</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${diferencia >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Vender por volumen es {formatCurrency(Math.abs(diferencia))} {diferencia >= 0 ? 'más rentable' : 'menos rentable'} que el desglose
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Precio de venta final (manual):</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={precioFinalManual}
              onChange={(e) => setPrecioFinalManual(e.target.value)}
              placeholder="0.00"
              className="w-36 h-9 font-semibold text-right"
            />
            {precioFinalNum > 0 && <span className="text-sm text-gray-500 tabular-nums">{formatCurrency(precioFinalNum)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
