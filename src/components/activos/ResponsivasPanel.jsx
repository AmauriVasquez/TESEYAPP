import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Plus, ExternalLink, Upload, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function sanitizeFilename(filename) {
  return String(filename || 'documento').replace(/[^a-zA-Z0-9-_.]/g, '_');
}

const ESTATUS_LABEL = {
  activa: 'Activa',
  cerrada: 'Cerrada',
};

function estatusBadgeClass(estatus) {
  switch (estatus) {
    case 'activa':
      return 'bg-emerald-100 text-emerald-900';
    case 'cerrada':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function toDatetimeLocalValue(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s) {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * @param {object} props
 * @param {string} props.activoId
 * @param {string} props.activoNombre
 * @param {boolean} props.requiereResponsiva
 * @param {() => void} [props.onCambio] — p. ej. refrescar historial en el padre
 */
const ResponsivasPanel = ({ activoId, activoNombre, requiereResponsiva, onCambio }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [empleadoId, setEmpleadoId] = useState('');
  const [fechaAsignacion, setFechaAsignacion] = useState(() => toDatetimeLocalValue(new Date()));
  const [fechaEntregaReal, setFechaEntregaReal] = useState('');
  const [fechaDevolucionPrev, setFechaDevolucionPrev] = useState(() =>
    toDatetimeLocalValue(new Date())
  );
  const [confirmDevolucion, setConfirmDevolucion] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);

  const [entregaDialog, setEntregaDialog] = useState({
    open: false,
    responsivaId: null,
    existed: false,
  });
  const [fechaEntregaEdit, setFechaEntregaEdit] = useState('');
  const [savingEntrega, setSavingEntrega] = useState(false);

  const [docUploadId, setDocUploadId] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fetchLista = useCallback(async () => {
    if (!activoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('responsivas')
      .select(
        'id, activo_id, empleado_id, fecha_asignacion, fecha_devolucion, fecha_entrega_real, estatus, documento_url, devolucion_validada, created_at'
      )
      .eq('activo_id', activoId)
      .order('fecha_asignacion', { ascending: false });

    if (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setLista([]);
    } else {
      setLista(data ?? []);
    }
    setLoading(false);
  }, [activoId, toast]);

  const fetchEmpleados = useCallback(async () => {
    const { data, error } = await supabase
      .from('empleados')
      .select('id, nombre_completo')
      .eq('activo', true)
      .order('nombre_completo');
    if (error) {
      console.error(error);
      setEmpleados([]);
      return;
    }
    setEmpleados(data ?? []);
  }, []);

  useEffect(() => {
    fetchLista();
    fetchEmpleados();
  }, [fetchLista, fetchEmpleados]);

  const responsivaActiva = useMemo(() => lista.find((r) => r.estatus === 'activa') ?? null, [lista]);

  const empleadoNombre = useCallback(
    (eid) => empleados.find((e) => e.id === eid)?.nombre_completo ?? '—',
    [empleados]
  );

  const openGenerarDialog = () => {
    setEmpleadoId('');
    setFechaAsignacion(toDatetimeLocalValue(new Date()));
    setFechaEntregaReal('');
    setFechaDevolucionPrev(toDatetimeLocalValue(new Date()));
    setConfirmDevolucion(false);
    setPdfFile(null);
    setDialogOpen(true);
  };

  const subirPdf = async (file) => {
    const safe = sanitizeFilename(file.name);
    if (!String(file.type || '').includes('pdf') && !safe.toLowerCase().endsWith('.pdf')) {
      throw new Error('Solo se permiten archivos PDF.');
    }
    const path = `responsivas/${activoId}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage
      .from('proyecto_archivos')
      .upload(path, file, { contentType: file.type || 'application/pdf' });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from('proyecto_archivos').getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleGuardarResponsiva = async (e) => {
    e.preventDefault();
    if (!empleadoId) {
      toast({ variant: 'destructive', title: 'Falta empleado', description: 'Selecciona al responsable.' });
      return;
    }
    if (responsivaActiva && !confirmDevolucion) {
      toast({
        variant: 'destructive',
        title: 'Confirmación requerida',
        description: 'Debes validar la devolución del responsable anterior antes de reasignar.',
      });
      return;
    }

    setSaving(true);
    try {
      let documentoUrl = null;
      if (pdfFile) {
        documentoUrl = await subirPdf(pdfFile);
      }

      const { data: newId, error } = await supabase.rpc('activos_reasignar_responsiva', {
        p_activo_id: activoId,
        p_empleado_id: empleadoId,
        p_fecha_asignacion: fromDatetimeLocalValue(fechaAsignacion),
        p_fecha_entrega_real: fechaEntregaReal || null,
        p_documento_url: documentoUrl,
        p_fecha_devolucion_prev: responsivaActiva ? fromDatetimeLocalValue(fechaDevolucionPrev) : null,
        p_confirmar_devolucion: responsivaActiva ? confirmDevolucion : true,
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('CONFIRMACION_DEVOLUCION')) {
          toast({
            variant: 'destructive',
            title: 'Confirmación requerida',
            description: 'Debes validar la devolución del responsable anterior.',
          });
          return;
        }
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Responsiva registrada', description: newId ? `Folio interno: ${newId}` : undefined });
      setDialogOpen(false);
      await fetchLista();
      onCambio?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const abrirEntrega = (row) => {
    setFechaEntregaEdit(row.fecha_entrega_real || '');
    setEntregaDialog({ open: true, responsivaId: row.id, existed: !!row.fecha_entrega_real });
  };

  const guardarEntregaReal = async (e) => {
    e.preventDefault();
    if (!entregaDialog.responsivaId || !fechaEntregaEdit) {
      toast({ variant: 'destructive', title: 'Indica la fecha de entrega real.' });
      return;
    }
    setSavingEntrega(true);
    try {
      const { error } = await supabase
        .from('responsivas')
        .update({ fecha_entrega_real: fechaEntregaEdit })
        .eq('id', entregaDialog.responsivaId);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Entrega real registrada' });
      setEntregaDialog({ open: false, responsivaId: null, existed: false });
      await fetchLista();
      onCambio?.();
    } finally {
      setSavingEntrega(false);
    }
  };

  const guardarDocumentoEnFila = async (row) => {
    if (!docFile || docUploadId !== row.id) return;
    setUploadingDoc(true);
    try {
      const url = await subirPdf(docFile);
      const { error } = await supabase.from('responsivas').update({ documento_url: url }).eq('id', row.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Documento guardado' });
      setDocFile(null);
      setDocUploadId(null);
      await fetchLista();
      onCambio?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Responsivas</h2>
            <p className="text-sm text-gray-600 mt-1">
              Control de asignación formal del activo <span className="font-medium">{activoNombre}</span>.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
              <span className="font-medium">Requiere responsiva:</span>
              <span
                className={cn(
                  'font-semibold px-2 py-0.5 rounded-full',
                  requiereResponsiva ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                )}
              >
                {requiereResponsiva ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
          <Button type="button" className="gap-2 shrink-0" onClick={openGenerarDialog}>
            <Plus className="w-4 h-4" />
            Generar responsiva
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : lista.length === 0 ? (
          <p className="text-center text-gray-500 py-10 text-sm">
            No hay responsivas registradas. Usa &quot;Generar responsiva&quot; para la primera asignación.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
            {lista.map((r) => (
              <li key={r.id} className="p-4 bg-white hover:bg-gray-50/80 transition-colors">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <span
                    className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', estatusBadgeClass(r.estatus))}
                  >
                    {ESTATUS_LABEL[r.estatus] ?? r.estatus}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{empleadoNombre(r.empleado_id)}</span>
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Asignación</dt>
                    <dd>
                      {format(new Date(r.fecha_asignacion), "dd MMM yyyy, HH:mm", { locale: es })}
                    </dd>
                  </div>
                  {r.fecha_devolucion ? (
                    <div>
                      <dt className="text-gray-500">Devolución</dt>
                      <dd>{format(new Date(r.fecha_devolucion), "dd MMM yyyy, HH:mm", { locale: es })}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-gray-500">Entrega real</dt>
                    <dd>
                      {r.fecha_entrega_real
                        ? format(new Date(r.fecha_entrega_real), 'dd MMM yyyy', { locale: es })
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Devolución validada</dt>
                    <dd>{r.estatus === 'cerrada' ? (r.devolucion_validada ? 'Sí' : 'No') : '—'}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.documento_url ? (
                    <Button variant="outline" size="sm" className="gap-1" asChild>
                      <a href={r.documento_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver PDF
                      </a>
                    </Button>
                  ) : null}
                  {r.estatus === 'activa' ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => abrirEntrega(r)}>
                      <CalendarDays className="w-3.5 h-3.5" />
                      {r.fecha_entrega_real ? 'Editar entrega real' : 'Registrar entrega real'}
                    </Button>
                  ) : null}
                  {r.estatus === 'activa' && !r.documento_url ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="max-w-[200px] h-8 text-xs"
                        onChange={(ev) => {
                          const f = ev.target.files?.[0];
                          setDocUploadId(r.id);
                          setDocFile(f || null);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!docFile || docUploadId !== r.id || uploadingDoc}
                        className="gap-1"
                        onClick={() => guardarDocumentoEnFila(r)}
                      >
                        {uploadingDoc ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Subir PDF
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Nueva responsiva
            </DialogTitle>
            <DialogDescription>
              {responsivaActiva
                ? 'Se cerrará la responsiva activa actual y se abrirá una nueva. Confirma la devolución del custodio anterior.'
                : 'Registra la primera asignación formal del activo a un empleado.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGuardarResponsiva} className="space-y-4">
            {responsivaActiva ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="font-medium">Responsable actual</p>
                <p className="mt-1">
                  {empleadoNombre(responsivaActiva.empleado_id)} — desde{' '}
                  {format(new Date(responsivaActiva.fecha_asignacion), 'dd MMM yyyy, HH:mm', { locale: es })}
                </p>
              </div>
            ) : null}

            {responsivaActiva ? (
              <>
                <div>
                  <Label htmlFor="fecha_dev">Fecha / hora de devolución (cierre anterior)</Label>
                  <Input
                    id="fecha_dev"
                    type="datetime-local"
                    className="mt-1"
                    value={fechaDevolucionPrev}
                    onChange={(e) => setFechaDevolucionPrev(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="conf_dev"
                    checked={confirmDevolucion}
                    onCheckedChange={(v) => setConfirmDevolucion(!!v)}
                  />
                  <Label htmlFor="conf_dev" className="text-sm font-normal leading-snug cursor-pointer">
                    Confirmo que el activo fue devuelto o liberado por el responsable anterior (validación de
                    devolución).
                  </Label>
                </div>
              </>
            ) : null}

            <div>
              <Label htmlFor="emp">Empleado asignado</Label>
              <select
                id="emp"
                required
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className={cn(
                  'mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                )}
              >
                <option value="">Seleccionar…</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre_completo}
                  </option>
                ))}
              </select>
              {empleados.length === 0 ? (
                <p className="text-xs text-amber-700 mt-2">
                  No hay empleados activos en el catálogo. Alta en Control de personal / empleados.
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="fecha_asig">Fecha y hora de asignación</Label>
              <Input
                id="fecha_asig"
                type="datetime-local"
                className="mt-1"
                value={fechaAsignacion}
                onChange={(e) => setFechaAsignacion(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="fecha_ent">Fecha de entrega real (opcional)</Label>
              <Input
                id="fecha_ent"
                type="date"
                className="mt-1"
                value={fechaEntregaReal}
                onChange={(e) => setFechaEntregaReal(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="pdf">Documento PDF (opcional)</Label>
              <Input
                id="pdf"
                type="file"
                accept="application/pdf,.pdf"
                className="mt-1"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={entregaDialog.open}
        onOpenChange={(open) => !open && setEntregaDialog({ open: false, responsivaId: null, existed: false })}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {entregaDialog.existed ? 'Editar fecha de entrega real' : 'Registrar entrega real'}
            </DialogTitle>
            <DialogDescription>Fecha en que el activo quedó físicamente entregado al responsable.</DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarEntregaReal} className="space-y-4">
            <div>
              <Label htmlFor="fe_entrega">Fecha de entrega real</Label>
              <Input
                id="fe_entrega"
                type="date"
                required
                className="mt-1"
                value={fechaEntregaEdit}
                onChange={(e) => setFechaEntregaEdit(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEntrega} className="gap-2">
                {savingEntrega ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResponsivasPanel;
