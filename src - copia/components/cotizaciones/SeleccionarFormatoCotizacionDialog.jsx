import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import FormatoCotizacionTESEY from '@/components/formatos/FormatoCotizacionTESEY';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const SeleccionarFormatoCotizacionDialog = ({ open, onOpenChange, cotizacion }) => {
  const [loading, setLoading] = useState(false);
  const [fullCotizacionData, setFullCotizacionData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && cotizacion) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // 1. Fetch Items associated with the quotation
          const { data: itemsData, error: itemsError } = await supabase
            .from('cotizaciones_items')
            .select('*')
            .eq('cotizacion_id', cotizacion.id);

          if (itemsError) throw itemsError;

          // 2. Fetch Cliente details if not fully populated
          let clienteData = cotizacion.cliente;
          if (!clienteData && cotizacion.cliente_id) {
             const { data: client, error: clientError } = await supabase
                .from('clientes')
                .select('nombre')
                .eq('id', cotizacion.cliente_id)
                .single();
             if (!clientError) clienteData = client;
          }

          // 3. Fetch Vendor (Usuario Cotizacion) details
          // The database currently stores the vendor NAME as a string in 'usuario_cotizacion' column.
          // We look up this user in the 'usuarios' table by name to get phone/email.
          let vendedorData = null;
          if (cotizacion.usuario_cotizacion) {
              const { data: vendor, error: vendorError } = await supabase
                  .from('usuarios')
                  .select('nombre_completo, telefono, correo') // Ensure we select 'correo' specifically
                  .eq('nombre_completo', cotizacion.usuario_cotizacion)
                  .maybeSingle();
              
              if (!vendorError && vendor) {
                  vendedorData = vendor;
              } else {
                  // Fallback: try to find by partial match if exact match fails or if stored name format differs
                   const { data: vendorLike, error: vendorLikeError } = await supabase
                    .from('usuarios')
                    .select('nombre_completo, telefono, correo')
                    .ilike('nombre_completo', `%${cotizacion.usuario_cotizacion}%`)
                    .limit(1)
                    .maybeSingle();
                    
                   if(!vendorLikeError && vendorLike) {
                       vendedorData = vendorLike;
                   }
              }
          }

          setFullCotizacionData({
            ...cotizacion,
            cliente: clienteData,
            items: itemsData || [],
            vendedor: vendedorData
          });
        } catch (error) {
          console.error('Error fetching quotation details:', error);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los detalles de la cotización.' });
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    } else {
        setFullCotizacionData(null);
    }
  }, [open, cotizacion, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[230mm] w-full max-h-[95vh] overflow-y-auto p-0 bg-gray-100">
        <div className="p-4 md:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle>Vista Previa de Impresión</DialogTitle>
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