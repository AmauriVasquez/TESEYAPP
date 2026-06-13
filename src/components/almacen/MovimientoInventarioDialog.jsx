import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Loader2 } from 'lucide-react';
import { registrarMovimiento } from '@/lib/inventarioApi';

const MOTIVOS = {
  entrada: ['recepcion', 'devolucion', 'traspaso', 'saldo_inicial', 'otro'],
  salida: ['consumo', 'merma', 'traspaso', 'otro'],
  ajuste: ['conteo_fisico', 'correccion'],
};

const TIPOS = [
  { value: 'entrada', label: 'Entrada', icon: ArrowDownToLine, color: 'text-green-600' },
  { value: 'salida', label: 'Salida', icon: ArrowUpFromLine, color: 'text-red-600' },
  { value: 'ajuste', label: 'Ajuste (conteo)', icon: ClipboardCheck, color: 'text-amber-600' },
];

const MovimientoInventarioDialog = ({ open, onOpenChange, material, onSaved }) => {
  const { toast } = useToast();
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('recepcion');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [permitirNegativo, setPermitirNegativo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo('entrada');
      setCantidad('');
      setMotivo('recepcion');
      setReferencia('');
      setObservaciones('');
      setPermitirNegativo(false);
    }
  }, [open, material?.id]);

  const handleTipoChange = (value) => {
    setTipo(value);
    setMotivo(MOTIVOS[value][0]);
    setPermitirNegativo(false);
  };

  const unidad = material?.unidad_uso || 'u';
  const existencias = Number(material?.existencias) || 0;

  const preview = useMemo(() => {
    const c = parseFloat(cantidad);
    if (!Number.isFinite(c)) return null;
    if (tipo === 'entrada') return existencias + Math.abs(c);
    if (tipo === 'salida') return existencias - Math.abs(c);
    return c; // ajuste: el conteo es la nueva existencia
  }, [cantidad, tipo, existencias]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const c = parseFloat(cantidad);
    if (!Number.isFinite(c) || c < 0) {
      toast({ variant: 'destructive', title: 'Cantidad inválida', description: 'Captura un número válido.' });
      return;
    }
    if (tipo !== 'ajuste' && c <= 0) {
      toast({ variant: 'destructive', title: 'Cantidad inválida', description: 'Debe ser mayor a 0.' });
      return;
    }
    setSaving(true);
    try {
      await registrarMovimiento({
        material_id: material.id,
        tipo,
        cantidad: c,
        motivo,
        referencia: referencia.trim() || null,
        observaciones: observaciones.trim() || null,
        permitir_negativo: permitirNegativo,
      });
      toast({ title: '✅ Movimiento registrado', description: `${material.descripcion}` });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo registrar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            Movimiento de inventario
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">
              {material.clave ? `${material.clave} · ` : ''}{material.descripcion}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
            Existencia actual: <span className="font-semibold">{existencias}</span> {unidad}
          </div>

          <Tabs value={tipo} onValueChange={handleTipoChange}>
            <TabsList className="grid w-full grid-cols-3">
              {TIPOS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  <t.icon className={`w-4 h-4 ${t.color}`} />{t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div>
            <Label htmlFor="cantidad">
              {tipo === 'ajuste' ? `Conteo físico real (${unidad})` : `Cantidad (${unidad})`}
            </Label>
            <Input
              id="cantidad" type="number" step="any" min="0" value={cantidad}
              onChange={(e) => setCantidad(e.target.value)} autoFocus
              placeholder={tipo === 'ajuste' ? 'Existencia contada' : '0'}
            />
            {preview != null && (
              <p className={`text-xs mt-1 ${preview < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                Existencia resultante: <span className="font-semibold">{preview}</span> {unidad}
                {preview < 0 && ' (negativa)'}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="motivo">Motivo</Label>
            <select
              id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
            >
              {MOTIVOS[tipo].map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <Input
              id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)}
              placeholder="Folio, proyecto, nota…"
            />
          </div>

          <div>
            <Label htmlFor="obs">Observaciones (opcional)</Label>
            <Textarea id="obs" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          {tipo === 'salida' && preview != null && preview < 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <Checkbox checked={permitirNegativo} onCheckedChange={(v) => setPermitirNegativo(!!v)} className="mt-0.5" />
              <span className="text-amber-800">
                Permitir existencia negativa (registrar este consumo aunque la entrada aún no se capture).
              </span>
            </label>
          )}

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MovimientoInventarioDialog;
