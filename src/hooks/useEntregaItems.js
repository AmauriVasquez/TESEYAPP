import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Ítems de cotización con pendientes vía RPC `get_items_con_pendiente`.
 * Efecto: dependencia única `cotizacionId` (sin objetos).
 * `refetch` re-ejecuta la misma carga sin añadir dependencias al efecto.
 */
export const useEntregaItems = (cotizacionId) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cotizacionId == null || cotizacionId === '') {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_items_con_pendiente', {
          cotizacion_id_input: cotizacionId,
        });
        if (!active) return;
        if (error) throw error;
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error cargando ítems con pendiente:', err);
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [cotizacionId]);

  const refetch = useCallback(async () => {
    if (cotizacionId == null || cotizacionId === '') {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_items_con_pendiente', {
        cotizacion_id_input: cotizacionId,
      });
      if (error) throw error;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando ítems con pendiente:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cotizacionId]);

  return { items, loading, refetch };
};
