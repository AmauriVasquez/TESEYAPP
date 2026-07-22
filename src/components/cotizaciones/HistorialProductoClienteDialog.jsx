import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const HistorialProductoClienteDialog = ({ producto, open, onOpenChange }) => {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    if (!open || !producto) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('cotizaciones_items')
        .select('cantidad, precio_unitario, cotizacion:cotizacion_id(folio, fecha, estatus)')
        .eq('producto_cliente_id', producto.id)
        .order('id', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Error cargando historial:', error);
        setRegistros([]);
      } else {
        setRegistros(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, producto]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de {producto?.codigo_interno} — {producto?.descripcion}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Precio cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length > 0 ? (
                registros.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.cotizacion?.folio || '-'}</TableCell>
                    <TableCell>{r.cotizacion?.fecha || '-'}</TableCell>
                    <TableCell>{r.cotizacion?.estatus || '-'}</TableCell>
                    <TableCell className="text-center">{r.cantidad}</TableCell>
                    <TableCell className="text-right">${Number(r.precio_unitario).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Esta pieza aún no se ha usado en ninguna cotización.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HistorialProductoClienteDialog;
