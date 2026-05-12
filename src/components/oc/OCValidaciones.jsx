import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { entregaBadgeKeyFromDb, entregaLabelFromKey } from '@/lib/ordenesCompraRecepcion';

const ENTREGA_BADGE_CLASS = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  parcial: 'bg-amber-100 text-amber-800 border-amber-300',
  completa: 'bg-green-100 text-green-800 border-green-300',
};

/**
 * Validaciones y estado de entrega.
 * Actualiza ordenes_compra: validacion_admin, validacion_contraentrega.
 * estado_entrega se calcula al registrar recepción en partidas.
 */
export default function OCValidaciones({ oc, onUpdate, canEnableContraentrega = true }) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const updateField = useCallback(async (payload) => {
    if (!oc?.id) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('ordenes_compra').update(payload).eq('id', oc.id);
      if (error) throw error;
      toast({ title: 'Actualizado', description: 'Cambios guardados.' });
      onUpdate?.();
    } catch (err) {
      console.error('Error en OCValidaciones update:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo guardar.' });
    } finally {
      setUpdating(false);
    }
  }, [oc, toast, onUpdate]);

  const handleSwitch = useCallback((field, checked) => {
    updateField({ [field]: !!checked });
  }, [updateField]);

  if (!oc) return null;

  const entregaKey = entregaBadgeKeyFromDb(oc.estado_entrega);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Validaciones y Entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validaciones */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Validaciones</h4>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="validacion_admin">Validación administrativa</Label>
              <p className="text-xs text-gray-500" title="Para cierres de mes contables">Para cierres de mes contables</p>
            </div>
            <Switch
              id="validacion_admin"
              checked={!!oc.validacion_admin}
              onCheckedChange={(c) => handleSwitch('validacion_admin', c)}
              disabled={updating}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="validacion_contraentrega">Validación contraentrega</Label>
              <p className="text-xs text-gray-500" title={canEnableContraentrega ? 'Material cotejado vs OC y factura' : 'Habilita cuando el material esté recibido y el total facturado coincida con el valor recibido'}>
                {canEnableContraentrega ? 'Material cotejado vs OC y factura' : 'Requiere entrega completa y facturación al valor recibido'}
              </p>
            </div>
            <Switch
              id="validacion_contraentrega"
              checked={!!oc.validacion_contraentrega}
              onCheckedChange={(c) => handleSwitch('validacion_contraentrega', c)}
              disabled={updating || !canEnableContraentrega}
            />
          </div>
        </div>

        {/* Estado de entrega (solo lectura; se recalcula al recibir materiales) */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Estado de entrega</h4>
          <p className="text-xs text-gray-500">
            Pendiente, entrega parcial o entrega completa según las cantidades recibidas en cada partida de la OC.
          </p>
          <Badge className={cn('border', ENTREGA_BADGE_CLASS[entregaKey] ?? ENTREGA_BADGE_CLASS.pendiente)}>
            {entregaLabelFromKey(entregaKey)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
