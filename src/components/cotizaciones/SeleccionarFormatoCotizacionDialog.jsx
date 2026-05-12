import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil, RotateCcw, Copy, ChevronDown } from 'lucide-react';
import FormatoCotizacionTESEY from '@/components/formatos/FormatoCotizacionTESEY';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const SeleccionarFormatoCotizacionDialog = ({
  open,
  onOpenChange,
  cotizacion: cotizacionProp,
  cotizacionId,
  modoProyecto = false,
  onEditar,
  onCrearNuevaVersion,
  onDuplicarPlantilla,
}) => {
  const [loading, setLoading] = useState(false);
  const [fullCotizacionData, setFullCotizacionData] = useState(null);
  const { toast } = useToast();
  const quoteId = cotizacionProp?.id ?? cotizacionId;

  useEffect(() => {
    if (!open || !quoteId) {
      setFullCotizacionData(null);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        let cotizacion = cotizacionProp;
        if (!cotizacion?.id && quoteId) {
          const { data: quoteRow, error: quoteError } = await supabase
            .from('cotizaciones')
            .select('*')
            .eq('id', quoteId)
            .single();
          if (quoteError) throw quoteError;
          cotizacion = quoteRow;
        }
        if (!cotizacion) return;

        const { data: itemsData, error: itemsError } = await supabase
          .from('cotizaciones_items')
          .select('*')
          .eq('cotizacion_id', cotizacion.id);
        if (itemsError) throw itemsError;

        let clienteData = cotizacion.cliente;
        if (!clienteData && cotizacion.cliente_id) {
          const { data: client, error: clientError } = await supabase
            .from('clientes')
            .select('nombre')
            .eq('id', cotizacion.cliente_id)
            .single();
          if (!clientError) clienteData = client;
        }

        let vendedorData = null;
        if (cotizacion.usuario_cotizacion) {
          const { data: vendor, error: vendorError } = await supabase
            .from('usuarios')
            .select('nombre_completo, telefono, correo')
            .eq('nombre_completo', cotizacion.usuario_cotizacion)
            .maybeSingle();
          if (!vendorError && vendor) vendedorData = vendor;
          else {
            const { data: vendorLike, error: vendorLikeError } = await supabase
              .from('usuarios')
              .select('nombre_completo, telefono, correo')
              .ilike('nombre_completo', `%${cotizacion.usuario_cotizacion}%`)
              .limit(1)
              .maybeSingle();
            if (!vendorLikeError && vendorLike) vendedorData = vendorLike;
          }
        }

        setFullCotizacionData({
          ...cotizacion,
          cliente: clienteData,
          items: itemsData || [],
          vendedor: vendedorData,
        });
      } catch (error) {
        console.error('Error fetching quotation details:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los detalles de la cotización.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [open, quoteId, cotizacionProp?.id, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-y-auto p-0 bg-gray-100">
        <div className="p-4 md:p-6">
          <DialogHeader className="mb-4 flex flex-row items-center justify-between gap-4">
            <DialogTitle>Vista Previa de Impresión</DialogTitle>
            {modoProyecto && fullCotizacionData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="bg-red-800 hover:bg-red-900 text-white gap-1.5 font-medium"
                  >
                    Editar / Versiones
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => onEditar?.(fullCotizacionData)}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    Corregir (Sobrescribir)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCrearNuevaVersion?.(fullCotizacionData)}
                    className="gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Crear Nueva Versión
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDuplicarPlantilla?.(fullCotizacionData)}
                    className="gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicar (Como Plantilla)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="ml-2 text-gray-600">Generando formato...</span>
            </div>
          ) : fullCotizacionData ? (
            <FormatoCotizacionTESEY
              cotizacionData={fullCotizacionData}
              onPrint={() => {}}
              hidePrintButton={modoProyecto}
            />
          ) : (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg">
              No hay datos disponibles para visualizar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SeleccionarFormatoCotizacionDialog;