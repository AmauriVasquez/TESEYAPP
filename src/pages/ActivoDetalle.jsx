import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Save,
  FileText,
  History,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchActivoByIdCompat } from '@/lib/supabaseActivosCompat';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsivasPanel from '@/components/activos/ResponsivasPanel';

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  disponible: 'Disponible',
  en_uso: 'En uso',
  en_mantenimiento: 'En mantenimiento',
  en_reparacion: 'En reparación',
  dado_de_baja: 'Dado de baja',
};

const estadoBadgeClass = (estado) => {
  switch (estado) {
    case 'pendiente':
      return 'bg-slate-100 text-slate-800';
    case 'disponible':
      return 'bg-sky-100 text-sky-900';
    case 'en_uso':
      return 'bg-green-100 text-green-800';
    case 'en_mantenimiento':
      return 'bg-amber-100 text-amber-900';
    case 'en_reparacion':
      return 'bg-orange-100 text-orange-900';
    case 'dado_de_baja':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const HISTORIAL_TIPO_LABEL = {
  alta: 'Alta',
  cambio_ubicacion: 'Cambio de ubicación',
  cambio_estado: 'Cambio de estado',
  asignacion: 'Asignación',
  devolucion: 'Devolución',
  mantenimiento: 'Mantenimiento',
  baja: 'Baja',
};

function toUpperTrimmed(v) {
  return String(v ?? '').trim().toUpperCase();
}

const ActivoDetalle = () => {
  const { id } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activo, setActivo] = useState(null);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [tab, setTab] = useState('general');

  const [editMarca, setEditMarca] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editSerie, setEditSerie] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editUbicacionId, setEditUbicacionId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUbicaciones = useCallback(async () => {
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('id, nombre, eliminado')
      .order('nombre', { ascending: true });
    if (error) {
      console.error(error);
      setUbicaciones([]);
      return;
    }
    setUbicaciones(data ?? []);
  }, []);

  const fetchActivo = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error, mode } = await fetchActivoByIdCompat(supabase, id);

    if (mode === 'failed' || error) {
      console.error('[DEBUG activos by id]', error?.message, error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message ?? 'No se pudo cargar el activo.' });
      setActivo(null);
    } else if (!data) {
      setActivo(null);
    } else {
      setActivo(data);
      setEditMarca(toUpperTrimmed(data.marca));
      setEditModelo(toUpperTrimmed(data.modelo));
      setEditSerie(String(data.numero_serie ?? '').trim());
      setEditDescripcion(String(data.descripcion ?? ''));
      setEditUbicacionId(data.ubicacion_id ?? '');
    }
    setLoading(false);
  }, [id, toast]);

  const fetchHistorial = useCallback(async () => {
    if (!id) return;
    setHistLoading(true);
    const { data, error } = await supabase
      .from('historial_activos')
      .select('id, tipo_evento, descripcion, empleado_id, fecha')
      .eq('activo_id', id)
      .order('fecha', { ascending: false });

    if (error) {
      console.error(error);
      setHistorial([]);
    } else {
      setHistorial(data ?? []);
    }
    setHistLoading(false);
  }, [id]);

  useEffect(() => {
    fetchUbicaciones();
  }, [fetchUbicaciones]);

  useEffect(() => {
    fetchActivo();
  }, [fetchActivo]);

  useEffect(() => {
    if (tab === 'historial') fetchHistorial();
  }, [tab, fetchHistorial]);

  const ubicacionesOptions = useMemo(() => {
    const currentId = activo?.ubicacion_id;
    return ubicaciones.filter((u) => !u.eliminado || u.id === currentId);
  }, [ubicaciones, activo?.ubicacion_id]);

  const handleGuardarDatosGenerales = async (e) => {
    e.preventDefault();
    if (!activo?.id) return;
    setSaving(true);
    try {
      const marca = toUpperTrimmed(editMarca) || null;
      const modelo = toUpperTrimmed(editModelo) || null;
      const numero_serie = editSerie.trim() || null;
      const descripcion = editDescripcion.trim() || null;
      const ubicacion_id = editUbicacionId || null;
      const { error } = await supabase
        .from('activos')
        .update({
          marca,
          modelo,
          numero_serie,
          descripcion,
          ubicacion_id,
        })
        .eq('id', activo.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Datos guardados' });
      await fetchActivo();
      if (tab === 'historial') await fetchHistorial();
    } finally {
      setSaving(false);
    }
  };

  const marcarConfiguracionCompleta = async () => {
    if (!activo?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('activos')
        .update({ estado_configuracion: 'completo' })
        .eq('id', activo.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Configuración actualizada' });
      await fetchActivo();
      if (tab === 'historial') await fetchHistorial();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!activo) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
        <p className="text-gray-600 mb-4">No se encontró el activo.</p>
        <Button variant="outline" asChild>
          <Link to="/activos">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const pendienteConfig = activo.estado_configuracion === 'pendiente';

  return (
    <>
      <Helmet>
        <title>{activo.nombre} — Activos</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" asChild className="shrink-0 mt-0.5">
              <Link to="/activos" aria-label="Volver">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                {activo.nombre}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                <Link to="/activos" className="text-blue-600 hover:underline">
                  Activos
                </Link>
                <span className="mx-1">/</span>
                <span>Detalle</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                estadoBadgeClass(activo.estado)
              )}
            >
              {ESTADO_LABELS[activo.estado] ?? activo.estado}
            </span>
            {pendienteConfig && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                Configuración pendiente
              </span>
            )}
          </div>
        </div>

        {pendienteConfig && (
          <div
            className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Activo pendiente de configuración</p>
              <p className="text-sm text-amber-900/90 mt-1">
                Completa marca, modelo, serie y ubicación según corresponda; luego marca la configuración como
                completa.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-amber-400 bg-white hover:bg-amber-100"
                disabled={saving}
                onClick={marcarConfiguracionCompleta}
              >
                Marcar configuración como completa
              </Button>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="general" className="gap-2">
              <FileText className="w-4 h-4" />
              Datos generales
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-2">
              <History className="w-4 h-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="responsivas" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Responsivas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-800 border-b pb-2">Resumen</h2>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Nombre</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{activo.nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Categoría</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {activo.categoria?.nombre ?? 'Sin categoría'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Estado operativo</dt>
                    <dd className="mt-0.5">
                      <span
                        className={cn(
                          'text-xs font-semibold px-2 py-1 rounded-full inline-flex',
                          estadoBadgeClass(activo.estado)
                        )}
                      >
                        {ESTADO_LABELS[activo.estado] ?? activo.estado}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Ubicación</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {activo.ubicacion?.nombre ?? 'Sin ubicación asignada'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Requiere mantenimiento</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {activo.requiere_mantenimiento ? 'Sí' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Estado de configuración</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {activo.estado_configuracion === 'completo' ? 'Completo' : 'Pendiente'}
                    </dd>
                  </div>
                </dl>
              </div>

              <form
                onSubmit={handleGuardarDatosGenerales}
                className="bg-white rounded-xl border shadow-sm p-6 space-y-5"
              >
                <h2 className="text-sm font-semibold text-gray-800 border-b pb-2">Editar datos</h2>
                <p className="text-xs text-gray-500">
                  Nombre, categoría y estado operativo se gestionan desde el listado de activos (formulario de alta /
                  edición rápida).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={editMarca}
                      onChange={(e) => setEditMarca(e.target.value.toUpperCase())}
                      className="mt-1 uppercase"
                      placeholder="MARCA"
                    />
                  </div>
                  <div>
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                      id="modelo"
                      value={editModelo}
                      onChange={(e) => setEditModelo(e.target.value.toUpperCase())}
                      className="mt-1 uppercase"
                      placeholder="MODELO"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="serie">Número de serie</Label>
                    <Input
                      id="serie"
                      value={editSerie}
                      onChange={(e) => setEditSerie(e.target.value)}
                      className="mt-1"
                      placeholder="Serie de fábrica o interna"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <select
                    id="ubicacion"
                    value={editUbicacionId}
                    onChange={(e) => setEditUbicacionId(e.target.value)}
                    className={cn(
                      'mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    )}
                  >
                    <option value="">Sin ubicación</option>
                    {ubicacionesOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                        {u.eliminado ? ' (inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                  {ubicacionesOptions.length === 0 && (
                    <p className="text-xs text-amber-700 mt-2">
                      No hay ubicaciones en catálogo. Crea registros en la tabla{' '}
                      <code className="text-xs">ubicaciones</code> (Supabase) para usar el desplegable.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="desc">Descripción</Label>
                  <Textarea
                    id="desc"
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    className="mt-1 min-h-[100px]"
                    placeholder="Texto libre; no se convierte a mayúsculas."
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              {histLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : historial.length === 0 ? (
                <p className="text-center text-gray-500 py-10">Sin eventos en el historial todavía.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {historial.map((h) => (
                    <li key={h.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {HISTORIAL_TIPO_LABEL[h.tipo_evento] ?? h.tipo_evento}
                        </span>
                        <span>·</span>
                        <time dateTime={h.fecha}>
                          {format(new Date(h.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                        </time>
                      </div>
                      <p className="text-sm text-gray-800 mt-1">{h.descripcion}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="responsivas" className="mt-4">
            <ResponsivasPanel
              activoId={activo.id}
              activoNombre={activo.nombre}
              requiereResponsiva={!!activo.requiere_responsiva}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
};

export default ActivoDetalle;
