 import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CalendarDays, Plus, Save, ChevronLeft, ChevronRight, 
  CheckCircle2, XCircle, AlertTriangle, Plane, Eye, Pencil, Loader2, Clock,
  Palmtree, Stethoscope, Armchair, GraduationCap, PartyPopper, Sparkles
} from 'lucide-react';
import { format, addDays, addWeeks, differenceInYears, isSameDay, parseISO, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

// CORRECCIÓN: Rutas relativas estándar SIN extensiones
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DatePicker } from '../components/ui/date-picker';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { syncCumpleanosGoogleCalendar } from '../services/cumpleanosCalendarSync';

// Importación del formato (Ruta relativa)
import FormatoListaAsistencia from '../components/formatos/FormatoListaAsistencia';

/**
 * Días de vacaciones por Ley Federal del Trabajo (México - Reforma Vacaciones Dignas).
 * Escala: <1 año = 0; 1=12, 2=14, 3=16, 4=18, 5=20; 6-10=22; 11-15=24; +2 cada 5 años.
 */
function diasVacacionesLFT(fechaContratacion) {
  if (!fechaContratacion) return 0;
  const antiguedad = differenceInYears(new Date(), parseISO(fechaContratacion));
  if (antiguedad < 1) return 0;
  if (antiguedad === 1) return 12;
  if (antiguedad === 2) return 14;
  if (antiguedad === 3) return 16;
  if (antiguedad === 4) return 18;
  if (antiguedad === 5) return 20;
  return 20 + Math.floor((antiguedad - 1) / 5) * 2;
}

/** Días laborables entre dos fechas (excluyendo domingos) */
function diasLaborablesEntre(inicio, fin) {
  if (!inicio || !fin) return 0;
  const start = typeof inicio === 'string' ? parseISO(inicio) : inicio;
  const end = typeof fin === 'string' ? parseISO(fin) : fin;
  if (start > end) return 0;
  const dias = eachDayOfInterval({ start, end });
  return dias.filter(d => d.getDay() !== 0).length;
}

// Estado inicial del formulario de empleado (todos los campos)
const EMPLEADO_FORM_INITIAL = {
  nombre_completo: '',
  puesto: '',
  fecha_contratacion: '',
  fecha_nacimiento: '',
  nss: '',
  telefono: '',
  curp: '',
  salario_semanal: '',
  requiere_asistencia: true,
  horario_entrada: '',
  horario_comida_inicio: '',
  horario_comida_fin: '',
  horario_salida: '',
  contacto_emergencia: '',
  numero_emergencia: '',
};

/** Modal de solo lectura con todos los datos del empleado + incidencias y vacaciones LFT */
const DetalleEmpleadoModal = ({ empleado, open, onOpenChange }) => {
  const { toast } = useToast();
  const [incidencias, setIncidencias] = useState([]);
  const [loadingIncidencias, setLoadingIncidencias] = useState(false);
  const [formIncidenciaOpen, setFormIncidenciaOpen] = useState(false);
  const [formIncidencia, setFormIncidencia] = useState({
    tipo: 'VACACIONES',
    fecha_inicio: '',
    fecha_fin: '',
    dias_totales: '',
    observaciones: '',
  });
  const [savingIncidencia, setSavingIncidencia] = useState(false);
  const [faltasDesdeAsistencia, setFaltasDesdeAsistencia] = useState(0);

  const anoActual = new Date().getFullYear();
  const inicioAno = `${anoActual}-01-01`;
  const finAno = `${anoActual}-12-31`;

  useEffect(() => {
    if (!open || !empleado?.id) {
      setIncidencias([]);
      return;
    }
    const fetchIncidencias = async () => {
      setLoadingIncidencias(true);
      try {
        const { data, error } = await supabase
          .from('rh_incidencias')
          .select('*')
          .eq('empleado_id', empleado.id)
          .gte('fecha_inicio', inicioAno)
          .lte('fecha_inicio', finAno)
          .order('fecha_inicio', { ascending: false });
        if (error) throw error;
        setIncidencias(data || []);
      } catch (e) {
        console.error('Error cargando incidencias:', e);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las incidencias.' });
        setIncidencias([]);
      } finally {
        setLoadingIncidencias(false);
      }
    };
    fetchIncidencias();
  }, [open, empleado?.id, toast]);

  // Faltas totales desde tabla asistencias (año en curso), no desde rh_incidencias
  useEffect(() => {
    if (!open || !empleado?.id) {
      setFaltasDesdeAsistencia(0);
      return;
    }
    const fetchFaltasAsistencia = async () => {
      try {
        const { data, error } = await supabase
          .from('asistencias')
          .select('id')
          .eq('empleado_id', empleado.id)
          .eq('estatus', 'Falta')
          .gte('fecha', inicioAno)
          .lte('fecha', finAno);
        if (error) throw error;
        setFaltasDesdeAsistencia((data || []).length);
      } catch (e) {
        console.error('Error cargando faltas desde asistencia:', e);
        setFaltasDesdeAsistencia(0);
      }
    };
    fetchFaltasAsistencia();
  }, [open, empleado?.id, inicioAno, finAno]);

  const incidenciasAno = useMemo(() => incidencias, [incidencias]);
  const faltasTotal = faltasDesdeAsistencia;
  const incapacidadesTotal = useMemo(() =>
    incidenciasAno.filter(i => (i.tipo || '').toUpperCase() === 'INCAPACIDAD').reduce((s, i) => s + (Number(i.dias_totales) || 0), 0),
    [incidenciasAno]
  );
  const vacacionesRegistros = useMemo(() =>
    incidenciasAno.filter(i => (i.tipo || '').toUpperCase() === 'VACACIONES'),
    [incidenciasAno]
  );
  const diasDisfrutados = useMemo(() =>
    vacacionesRegistros.reduce((s, i) => s + (Number(i.dias_totales) || 0), 0),
    [vacacionesRegistros]
  );

  const diasPorLey = empleado ? diasVacacionesLFT(empleado.fecha_contratacion) : 0;
  const saldoVacaciones = Math.max(0, diasPorLey - diasDisfrutados);

  const handleOpenFormIncidencia = () => {
    setFormIncidencia({
      tipo: 'VACACIONES',
      fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
      fecha_fin: format(new Date(), 'yyyy-MM-dd'),
      dias_totales: '1',
      observaciones: '',
    });
    setFormIncidenciaOpen(true);
  };

  const handleChangeFechasIncidencia = (campo, valor) => {
    const next = { ...formIncidencia, [campo]: valor };
    if (next.fecha_inicio && next.fecha_fin) {
      const d = diasLaborablesEntre(next.fecha_inicio, next.fecha_fin);
      next.dias_totales = d > 0 ? String(d) : next.dias_totales;
    }
    setFormIncidencia(next);
  };

  const guardarIncidencia = async () => {
    if (!empleado?.id) return;
    const tipo = formIncidencia.tipo.trim();
    const dias = Number(formIncidencia.dias_totales) || 0;
    if (!formIncidencia.fecha_inicio || !formIncidencia.fecha_fin) {
      toast({ variant: 'destructive', title: 'Faltan fechas', description: 'Indica fecha de inicio y fin.' });
      return;
    }
    setSavingIncidencia(true);
    try {
      const { error } = await supabase.from('rh_incidencias').insert([{
        empleado_id: empleado.id,
        tipo,
        fecha_inicio: formIncidencia.fecha_inicio,
        fecha_fin: formIncidencia.fecha_fin,
        dias_totales: dias,
        observaciones: (formIncidencia.observaciones || '').trim() || null,
      }]);
      if (error) throw error;
      toast({ title: 'Incidencia registrada' });
      setFormIncidenciaOpen(false);
      setFormIncidencia({ tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', dias_totales: '', observaciones: '' });
      const { data, error: err2 } = await supabase
        .from('rh_incidencias')
        .select('*')
        .eq('empleado_id', empleado.id)
        .gte('fecha_inicio', inicioAno)
        .lte('fecha_inicio', finAno)
        .order('fecha_inicio', { ascending: false });
      if (!err2 && data) setIncidencias(data);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo guardar.' });
    } finally {
      setSavingIncidencia(false);
    }
  };

  if (!empleado) return null;
  const emp = empleado;
  const formatTime = (v) => (v ? String(v).slice(0, 5) : '—');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Datos personales</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 border border-gray-100">
                <div><span className="text-gray-500">Nombre:</span><br /><span className="font-medium">{emp.nombre_completo || '—'}</span></div>
                <div><span className="text-gray-500">CURP:</span><br /><span className="font-medium">{emp.curp || '—'}</span></div>
                <div><span className="text-gray-500">Teléfono:</span><br /><span className="font-medium">{emp.telefono || '—'}</span></div>
                <div><span className="text-gray-500">NSS:</span><br /><span className="font-medium">{emp.nss || '—'}</span></div>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Datos laborales</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 border border-gray-100">
                <div><span className="text-gray-500">Puesto:</span><br /><span className="font-medium">{emp.puesto || '—'}</span></div>
                <div><span className="text-gray-500">Fecha contratación:</span><br /><span className="font-medium">{emp.fecha_contratacion ? format(parseISO(emp.fecha_contratacion), 'dd/MM/yyyy') : '—'}</span></div>
                <div><span className="text-gray-500">Salario semanal:</span><br /><span className="font-medium">{emp.salario_semanal != null && emp.salario_semanal !== '' ? `$${Number(emp.salario_semanal).toLocaleString('es-MX')}` : '—'}</span></div>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Horario laboral</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 border border-gray-100">
                <div><span className="text-gray-500">Entrada:</span><br /><span className="font-medium">{formatTime(emp.horario_entrada)}</span></div>
                <div><span className="text-gray-500">Salida:</span><br /><span className="font-medium">{formatTime(emp.horario_salida)}</span></div>
                <div><span className="text-gray-500">Comida inicio:</span><br /><span className="font-medium">{formatTime(emp.horario_comida_inicio)}</span></div>
                <div><span className="text-gray-500">Comida fin:</span><br /><span className="font-medium">{formatTime(emp.horario_comida_fin)}</span></div>
              </div>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Contactos de emergencia</h4>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-100 space-y-2">
                <div><span className="text-gray-500">Contacto:</span><br /><span className="font-medium">{emp.contacto_emergencia || '—'}</span></div>
                <div><span className="text-gray-500">Número:</span><br /><span className="font-medium">{emp.numero_emergencia || '—'}</span></div>
              </div>
            </section>

            {/* Resumen de incidencias (año en curso) */}
            <Card className="bg-muted/30 border-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumen de incidencias ({anoActual})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {loadingIncidencias ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" /> Cargando incidencias...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-white/80 p-4 border border-gray-100 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Faltas totales</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{faltasTotal}</p>
                    </div>
                    <div className="rounded-lg bg-white/80 p-4 border border-gray-100 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Incapacidades (días)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{incapacidadesTotal}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Control de vacaciones (LFT) */}
            <Card className="bg-muted/30 border-muted">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Control de vacaciones (LFT)</CardTitle>
                <Button size="sm" variant="outline" className="gap-1" onClick={handleOpenFormIncidencia}>
                  <Plus className="w-4 h-4" /> Registrar Vacaciones/Incidencias
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {loadingIncidencias ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" /> Cargando vacaciones...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white/80 p-3 border border-gray-100 text-center">
                        <p className="text-xs text-muted-foreground">Días por ley (este año)</p>
                        <p className="text-xl font-bold text-blue-600">{diasPorLey}</p>
                      </div>
                      <div className="rounded-lg bg-white/80 p-3 border border-gray-100 text-center">
                        <p className="text-xs text-muted-foreground">Días disfrutados</p>
                        <p className="text-xl font-bold text-gray-900">{diasDisfrutados}</p>
                      </div>
                      <div className="rounded-lg bg-white/80 p-3 border border-gray-100 text-center">
                        <p className="text-xs text-muted-foreground">Saldo disponible</p>
                        <p className="text-xl font-bold text-green-600">{saldoVacaciones}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Historial de vacaciones ({anoActual})</p>
                      {vacacionesRegistros.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Sin registros este año.</p>
                      ) : (
                        <ul className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                          {vacacionesRegistros.map((r, idx) => (
                            <li key={r.id || idx} className="flex items-center justify-between px-3 py-2 bg-white/80 text-sm">
                              <span className="text-gray-600">
                                {r.fecha_inicio ? format(parseISO(r.fecha_inicio), 'dd/MM/yyyy') : '—'} – {r.fecha_fin ? format(parseISO(r.fecha_fin), 'dd/MM/yyyy') : '—'}
                              </span>
                              <span className="font-medium">{r.dias_totales ?? 0} días</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal hijo: Registrar incidencia */}
      <Dialog open={formIncidenciaOpen} onOpenChange={setFormIncidenciaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar incidencia</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formIncidencia.tipo}
                onChange={e => setFormIncidencia(prev => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="VACACIONES">Vacaciones</option>
                <option value="Incapacidad">Incapacidad</option>
                <option value="Permiso">Permiso</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha inicio</label>
                <DatePicker value={formIncidencia.fecha_inicio} onChange={(v) => handleChangeFechasIncidencia('fecha_inicio', v)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha fin</label>
                <DatePicker value={formIncidencia.fecha_fin} onChange={(v) => handleChangeFechasIncidencia('fecha_fin', v)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Días totales</label>
              <Input type="number" min={0} value={formIncidencia.dias_totales} onChange={e => setFormIncidencia(prev => ({ ...prev, dias_totales: e.target.value }))} placeholder="Autocalculado (sin domingos)" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Input value={formIncidencia.observaciones} onChange={e => setFormIncidencia(prev => ({ ...prev, observaciones: e.target.value }))} placeholder="Opcional" />
            </div>
            <Button onClick={guardarIncidencia} disabled={savingIncidencia} className="w-full bg-blue-600 hover:bg-blue-700">
              {savingIncidencia ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Separador para clave empleado+fecha (evita conflicto con UUID y fecha yyyy-MM-dd)
const ASIST_KEY_SEP = '|';

/** Formato de un registro de asistencia por día (estatus + horario opcional) */
const asistenciasEmptyRow = () => ({ estatus: null, hora_entrada: null, hora_comida_salida: null, hora_comida_entrada: null, hora_salida: null });

const ESTATUS_OPCIONES = [
  { value: 'Asistencia', label: 'Asistencia', acronimo: '✓' },
  { value: 'Falta', label: 'Falta (F)', acronimo: 'F' },
  { value: 'Descanso', label: 'Descanso (D)', acronimo: 'D' },
  { value: 'Día Festivo', label: 'Día Festivo (DF)', acronimo: 'DF' },
  { value: 'Incapacidad', label: 'Incapacidad (I)', acronimo: 'I' },
  { value: 'Cita Médica', label: 'Cita Médica (CM)', acronimo: 'CM' },
  { value: 'Curso', label: 'Curso (C)', acronimo: 'C' },
  { value: 'Nuevo Ingreso', label: 'Nuevo Ingreso (NI)', acronimo: 'NI' },
  { value: 'Vacaciones', label: 'Vacaciones (V)', acronimo: 'V' },
  { value: '__modificar_horario__', label: 'Modificar Horario...', acronimo: '' },
];

/** Mapeo de estatus de asistencia a ícono Lucide y color (vista web) */
const STATUS_CONFIG = {
  Falta: { icon: XCircle, color: 'text-red-500', label: 'Falta' },
  Vacaciones: { icon: Palmtree, color: 'text-teal-500', label: 'Vacaciones' },
  Incapacidad: { icon: Stethoscope, color: 'text-purple-500', label: 'Incapacidad' },
  'Cita Médica': { icon: Stethoscope, color: 'text-purple-400', label: 'Cita Médica' },
  Descanso: { icon: Armchair, color: 'text-gray-400', label: 'Descanso' },
  'Día Festivo': { icon: PartyPopper, color: 'text-amber-500', label: 'Día Festivo' },
  Curso: { icon: GraduationCap, color: 'text-blue-500', label: 'Curso' },
  'Nuevo Ingreso': { icon: Sparkles, color: 'text-amber-400', label: 'Nuevo Ingreso' },
  Permiso: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Permiso' },
};

const ModalHorarioForm = ({ hora_entrada, hora_comida_salida, hora_comida_entrada, hora_salida, onSave, onCancel }) => {
  const [e1, setE1] = useState(hora_entrada || '');
  const [cSalida, setCSalida] = useState(hora_comida_salida || '');
  const [cEntrada, setCEntrada] = useState(hora_comida_entrada || '');
  const [s1, setS1] = useState(hora_salida || '');
  useEffect(() => {
    setE1(hora_entrada || ''); setCSalida(hora_comida_salida || ''); setCEntrada(hora_comida_entrada || ''); setS1(hora_salida || '');
  }, [hora_entrada, hora_comida_salida, hora_comida_entrada, hora_salida]);
  const handleSubmit = () => onSave(e1.trim() || null, cSalida.trim() || null, cEntrada.trim() || null, s1.trim() || null);
  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs font-medium text-muted-foreground">Entrada</label><Input type="time" value={e1} onChange={e => setE1(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Salida a comida</label><Input type="time" value={cSalida} onChange={e => setCSalida(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Regreso de comida</label><Input type="time" value={cEntrada} onChange={e => setCEntrada(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Salida</label><Input type="time" value={s1} onChange={e => setS1(e.target.value)} className="mt-1" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
      </div>
    </div>
  );
};

// --- SUBCOMPONENTE: LISTA DE ASISTENCIA ---
const AsistenciaSemanal = ({ empleados, fechaReferencia, setFechaReferencia }) => {
  const { toast } = useToast();
  const [asistencias, setAsistencias] = useState({});
  const [lockedByIncidencias, setLockedByIncidencias] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState({});
  const [modalHorarioOpen, setModalHorarioOpen] = useState(false);
  const [modalHorarioContext, setModalHorarioContext] = useState(null);

  // Calcular el ciclo Viernes - Jueves
  const inicioSemana = useMemo(() => {
    const diaSemana = fechaReferencia.getDay(); 
    let diasARestar = 0;
    if (diaSemana >= 5) { // Viernes(5), Sábado(6)
       diasARestar = diaSemana - 5;
    } else { // Domingo(0) a Jueves(4)
       diasARestar = diaSemana + 2; 
    }
    return addDays(fechaReferencia, -diasARestar);
  }, [fechaReferencia]);

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(inicioSemana, i));
  }, [inicioSemana]);

  const toTimeStr = (v) => (v && String(v).trim()) ? String(v).slice(0, 5) : null;

  // Cargar asistencias existentes (con horarios) + rh_incidencias que superpongan la semana
  useEffect(() => {
    const fetchAsistencias = async () => {
      setLoading(true);
      const fechaFin = diasSemana[6];
      const weekStartStr = format(inicioSemana, 'yyyy-MM-dd');
      const weekEndStr = format(fechaFin, 'yyyy-MM-dd');
      try {
        const [asistRes, incRes] = await Promise.all([
          supabase
            .from('asistencias')
            .select('*')
            .gte('fecha', weekStartStr)
            .lte('fecha', weekEndStr),
          supabase
            .from('rh_incidencias')
            .select('empleado_id, tipo, fecha_inicio, fecha_fin')
            .lte('fecha_inicio', weekEndStr)
            .gte('fecha_fin', weekStartStr),
        ]);

        if (asistRes.error) throw asistRes.error;

        const mapa = {};
        (asistRes.data || []).forEach(a => {
          const key = `${a.empleado_id}${ASIST_KEY_SEP}${a.fecha}`;
          mapa[key] = {
            estatus: a.estatus ?? 'Asistencia',
            hora_entrada: toTimeStr(a.hora_entrada) ?? null,
            hora_comida_salida: toTimeStr(a.hora_comida_salida) ?? null,
            hora_comida_entrada: toTimeStr(a.hora_comida_entrada) ?? null,
            hora_salida: toTimeStr(a.hora_salida) ?? null,
          };
        });

        const locked = new Set();
        const normalizeTipo = (t) => {
          const u = (t || '').toUpperCase();
          if (u === 'VACACIONES') return 'Vacaciones';
          if (u === 'INCAPACIDAD') return 'Incapacidad';
          if (u === 'PERMISO') return 'Permiso';
          return null;
        };
        (incRes.data || []).forEach(inc => {
          const tipoNorm = normalizeTipo(inc.tipo);
          if (!tipoNorm || !inc.fecha_inicio || !inc.fecha_fin) return;
          const start = parseISO(inc.fecha_inicio);
          const end = parseISO(inc.fecha_fin);
          const dias = eachDayOfInterval({ start, end });
          dias.forEach(dia => {
            const dateStr = format(dia, 'yyyy-MM-dd');
            if (dateStr < weekStartStr || dateStr > weekEndStr) return;
            const key = `${inc.empleado_id}${ASIST_KEY_SEP}${dateStr}`;
            mapa[key] = { ...(mapa[key] || asistenciasEmptyRow()), estatus: tipoNorm };
            locked.add(key);
          });
        });

        setAsistencias(mapa);
        setLockedByIncidencias(locked);
      } catch (error) {
        console.error("Error al cargar asistencias:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las asistencias.' });
      } finally {
        setLoading(false);
      }
    };
    fetchAsistencias();
  }, [inicioSemana, diasSemana, toast]);

  const getKey = (empleadoId, fecha) => `${empleadoId}${ASIST_KEY_SEP}${format(fecha, 'yyyy-MM-dd')}`;

  const getRow = (empleadoId, fecha) => {
    const key = getKey(empleadoId, fecha);
    const pend = cambiosPendientes[key];
    const base = asistencias[key];
    const isDomingo = fecha.getDay() === 0;
    const estatusDefault = isDomingo ? 'Descanso' : 'Asistencia';
    return {
      estatus: pend?.estatus ?? base?.estatus ?? estatusDefault,
      hora_entrada: pend?.hora_entrada ?? base?.hora_entrada ?? null,
      hora_comida_salida: pend?.hora_comida_salida ?? base?.hora_comida_salida ?? null,
      hora_comida_entrada: pend?.hora_comida_entrada ?? base?.hora_comida_entrada ?? null,
      hora_salida: pend?.hora_salida ?? base?.hora_salida ?? null,
    };
  };

  const getEstatus = (empleadoId, fecha) => getRow(empleadoId, fecha).estatus;

  const handleEstatusChange = (empleadoId, fecha, nuevoEstatus) => {
    if (nuevoEstatus === '__modificar_horario__') {
      const emp = empleados.find(e => e.id === empleadoId);
      const row = getRow(empleadoId, fecha);
      setModalHorarioContext({
        empleadoId,
        empleado: emp,
        fecha,
        hora_entrada: row.hora_entrada || (emp?.horario_entrada ? String(emp.horario_entrada).slice(0, 5) : ''),
        hora_comida_salida: row.hora_comida_salida || (emp?.horario_comida_inicio ? String(emp.horario_comida_inicio).slice(0, 5) : ''),
        hora_comida_entrada: row.hora_comida_entrada || (emp?.horario_comida_fin ? String(emp.horario_comida_fin).slice(0, 5) : ''),
        hora_salida: row.hora_salida || (emp?.horario_salida ? String(emp.horario_salida).slice(0, 5) : ''),
      });
      setModalHorarioOpen(true);
      return;
    }
    const key = getKey(empleadoId, fecha);
    const current = getRow(empleadoId, fecha);
    setCambiosPendientes(prev => ({ ...prev, [key]: { ...current, estatus: nuevoEstatus } }));
  };

  const guardarHorarioModal = (hora_entrada, hora_comida_salida, hora_comida_entrada, hora_salida) => {
    if (!modalHorarioContext) return;
    const key = getKey(modalHorarioContext.empleadoId, modalHorarioContext.fecha);
    setCambiosPendientes(prev => ({
      ...prev,
      [key]: {
        estatus: 'Asistencia',
        hora_entrada: hora_entrada || null,
        hora_comida_salida: hora_comida_salida || null,
        hora_comida_entrada: hora_comida_entrada || null,
        hora_salida: hora_salida || null,
      },
    }));
    setModalHorarioOpen(false);
    setModalHorarioContext(null);
  };

  const guardarCambios = async () => {
    const updates = Object.entries(cambiosPendientes).map(([key, row]) => {
      const [empleado_id, fecha] = key.split(ASIST_KEY_SEP);
      const r = typeof row === 'object' && row !== null ? row : { estatus: row };
      return {
        empleado_id,
        fecha,
        estatus: r.estatus ?? 'Asistencia',
        hora_entrada: r.hora_entrada || null,
        hora_comida_salida: r.hora_comida_salida || null,
        hora_comida_entrada: r.hora_comida_entrada || null,
        hora_salida: r.hora_salida || null,
      };
    });

    if (updates.length === 0) return;

    setLoading(true);
    console.log("Payload a guardar:", updates);
    try {
      const { error } = await supabase.from('asistencias').upsert(updates, { onConflict: 'empleado_id,fecha' });
      if (error) {
        console.error("🔥 Error de Supabase al guardar asistencia:", error);
        toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
      } else {
        toast({ title: 'Asistencias guardadas', description: 'Se han actualizado los registros correctamente.' });
        setCambiosPendientes({});
        setLockedByIncidencias(new Set());
        window.location.reload();
      }
    } catch (err) {
      console.error("🔥 Error de Supabase al guardar asistencia:", err);
      toast({ variant: 'destructive', title: 'Error al guardar', description: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const acronimoEstatus = (estatus) => {
    const o = ESTATUS_OPCIONES.find(x => x.value === estatus);
    if (o?.acronimo) return o.acronimo;
    if (estatus === 'Vacaciones') return 'V';
    if (estatus === 'Incapacidad') return 'I';
    return (estatus || '—').slice(0, 2);
  };

  const asistenciasMerged = useMemo(() => {
    const m = { ...asistencias };
    Object.entries(cambiosPendientes).forEach(([k, v]) => {
      m[k] = typeof v === 'object' && v !== null ? { ...(m[k] || asistenciasEmptyRow()), ...v } : { ...(m[k] || asistenciasEmptyRow()), estatus: v };
    });
    return m;
  }, [asistencias, cambiosPendientes]);

  return (
    <div className="space-y-4">
      {/* --- BARRA DE CONTROL (oculta al imprimir) --- */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm border gap-4 print:hidden">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <Button variant="outline" size="sm" onClick={() => setFechaReferencia(addWeeks(fechaReferencia, -1))}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
          </Button>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Semana</p>
            <p className="text-sm font-bold capitalize">
              {format(diasSemana[0], "d MMM", { locale: es })} - {format(diasSemana[6], "d MMM", { locale: es })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFechaReferencia(addWeeks(fechaReferencia, 1))}>
             Siguiente <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <FormatoListaAsistencia
            empleados={empleados}
            fechaInicio={diasSemana[0]}
            asistencias={asistenciasMerged}
          />
          {Object.keys(cambiosPendientes).length > 0 && (
            <Button onClick={guardarCambios} disabled={loading} className="bg-blue-600 hover:bg-blue-700 animate-pulse text-white gap-2">
              <Save className="w-4 h-4" /> Guardar ({Object.keys(cambiosPendientes).length})
            </Button>
          )}
        </div>
      </div>

      {/* Modal: Modificar horario del día */}
      <Dialog open={modalHorarioOpen} onOpenChange={setModalHorarioOpen}>
        <DialogContent className="max-w-md print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Modificar horario</DialogTitle>
          </DialogHeader>
          {modalHorarioContext && (
            <ModalHorarioForm
              hora_entrada={modalHorarioContext.hora_entrada}
              hora_comida_salida={modalHorarioContext.hora_comida_salida}
              hora_comida_entrada={modalHorarioContext.hora_comida_entrada}
              hora_salida={modalHorarioContext.hora_salida}
              onSave={guardarHorarioModal}
              onCancel={() => { setModalHorarioOpen(false); setModalHorarioContext(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Tabla: vista web = 1 celda + ícono; vista impresión = E | S | E | S */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto print:border-black">
        <table className="w-full min-w-[700px] text-sm text-left border-collapse print:border print:border-black">
          <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs print:bg-gray-200 print:border-black print:text-black">
            <tr>
              <th className="p-2 min-w-[180px] sticky left-0 bg-gray-100 z-10 border border-gray-300 print:border-black">Empleado</th>
              {/* Un th por día: web = nombre + fecha; impresión = nombre + fecha y debajo E | S | E | S */}
              {diasSemana.map(dia => (
                <th key={dia.toString()} className={cn("p-0 text-center border border-gray-300 min-w-[72px] print:border-black print:p-1", isSameDay(dia, new Date()) && "bg-blue-100 text-blue-800")}>
                  <div className="p-2 print:p-1">
                    <div className="print:hidden">{format(dia, 'EEEE', { locale: es })}</div>
                    <div className="text-[10px] opacity-70 print:hidden">{format(dia, 'dd/MMM')}</div>
                    {/* Vista impresión: día y debajo fila E S E S */}
                    <div className="hidden print:block">
                      <div className="text-[9px]">{format(dia, 'EEEE', { locale: es })} {format(dia, 'dd/MMM')}</div>
                      <div className="grid grid-cols-4 text-[8px] font-normal mt-0.5 divide-x divide-black">
                        <span>E</span><span>S</span><span>E</span><span>S</span>
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y print:border-black">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50 print:border-b print:border-black">
                <td className="p-2 font-medium sticky left-0 bg-white z-10 border-r border-gray-300 print:border-black print:text-black">
                  {emp.nombre_completo}
                  <div className="text-xs text-gray-400 font-normal print:text-gray-700">{emp.puesto}</div>
                </td>
                {diasSemana.map(dia => {
                  const key = getKey(emp.id, dia);
                  const row = getRow(emp.id, dia);
                  const estatus = row.estatus;
                  const bloqueadoPorIncidencia = lockedByIncidencias.has(key);
                  const isAsistencia = estatus === 'Asistencia';
                  const hasHorarioModificado = isAsistencia && (row.hora_entrada || row.hora_comida_salida || row.hora_comida_entrada || row.hora_salida);
                  const e1 = isAsistencia ? (row.hora_entrada || (emp?.horario_entrada ? String(emp.horario_entrada).slice(0, 5) : '—')) : acronimoEstatus(estatus);
                  const s1 = isAsistencia ? (row.hora_comida_salida || (emp?.horario_comida_inicio ? String(emp.horario_comida_inicio).slice(0, 5) : '—')) : acronimoEstatus(estatus);
                  const e2 = isAsistencia ? (row.hora_comida_entrada || (emp?.horario_comida_fin ? String(emp.horario_comida_fin).slice(0, 5) : '—')) : acronimoEstatus(estatus);
                  const s2 = isAsistencia ? (row.hora_salida || (emp?.horario_salida ? String(emp.horario_salida).slice(0, 5) : '—')) : acronimoEstatus(estatus);
                  const config = STATUS_CONFIG[estatus];
                  const iconoWeb = (() => {
                    if (hasHorarioModificado) {
                      return (
                        <span className="text-xs font-medium text-blue-600 flex items-center justify-center gap-1" aria-label="Horario modificado">
                          <Clock className="w-5 h-5 shrink-0" />
                          <span>{row.hora_entrada || '—'}</span>
                        </span>
                      );
                    }
                    if (config) {
                      const Icon = config.icon;
                      return <Icon className={cn('w-6 h-6 shrink-0', config.color)} aria-label={config.label} />;
                    }
                    return <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" aria-label="Asistencia" />;
                  })();
                  return (
                    <td key={dia.toString()} className="p-0 align-middle border-l border-gray-200 min-w-[72px] print:border-black print:min-w-0">
                      {/* Contenedor 1: Vista web — un solo ícono centrado */}
                      <div className="relative flex items-center justify-center p-2 min-h-[2.5rem] print:hidden w-full h-full">
                        {iconoWeb}
                        <select
                          className={cn("absolute inset-0 w-full h-full opacity-0 cursor-pointer", bloqueadoPorIncidencia && "cursor-not-allowed")}
                          value={estatus}
                          onChange={(e) => handleEstatusChange(emp.id, dia, e.target.value)}
                          disabled={bloqueadoPorIncidencia}
                          title={bloqueadoPorIncidencia ? "Registrado por incidencia" : undefined}
                        >
                          {ESTATUS_OPCIONES.filter(o => o.value !== '__modificar_horario__').map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                          <option value="__modificar_horario__">Modificar Horario...</option>
                        </select>
                      </div>
                      {/* Contenedor 2: Vista impresión — 4 posiciones E, S, E, S */}
                      <div className="hidden print:grid print:grid-cols-4 w-full min-h-[2rem] items-center justify-items-center text-[10px] divide-x divide-black print:border-black">
                        <span className="w-full text-center py-0.5">{e1}</span>
                        <span className="w-full text-center py-0.5">{s1}</span>
                        <span className="w-full text-center py-0.5">{e2}</span>
                        <span className="w-full text-center py-0.5">{s2}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- SUBCOMPONENTE: GESTIÓN DE EMPLEADOS ---
const GestionEmpleados = ({ empleados, onReload }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [nuevoEmp, setNuevoEmp] = useState({ ...EMPLEADO_FORM_INITIAL });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [previewEmpleado, setPreviewEmpleado] = useState(null);
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);

  const calcularVacaciones = (fechaContratacion) => {
    if (!fechaContratacion) return 0;
    const anios = differenceInYears(new Date(), parseISO(fechaContratacion));
    if (anios < 1) return 0;
    if (anios === 1) return 12;
    if (anios === 2) return 14;
    if (anios === 3) return 16;
    if (anios === 4) return 18;
    if (anios === 5) return 20;
    if (anios >= 6 && anios <= 10) return 22;
    return 24 + (Math.floor((anios - 11) / 5) * 2);
  };

  const abrirParaEditar = (emp) => {
    setEditingEmployee(emp);
    setNuevoEmp({
      nombre_completo: emp.nombre_completo ?? '',
      puesto: emp.puesto ?? '',
      fecha_contratacion: emp.fecha_contratacion ? String(emp.fecha_contratacion).slice(0, 10) : '',
      fecha_nacimiento: emp.fecha_nacimiento ? String(emp.fecha_nacimiento).slice(0, 10) : '',
      nss: emp.nss ?? '',
      telefono: emp.telefono ?? '',
      curp: emp.curp ?? '',
      salario_semanal: emp.salario_semanal != null && emp.salario_semanal !== '' ? String(emp.salario_semanal) : '',
      horario_entrada: emp.horario_entrada ? String(emp.horario_entrada).slice(0, 5) : '',
      horario_comida_inicio: emp.horario_comida_inicio ? String(emp.horario_comida_inicio).slice(0, 5) : '',
      horario_comida_fin: emp.horario_comida_fin ? String(emp.horario_comida_fin).slice(0, 5) : '',
      horario_salida: emp.horario_salida ? String(emp.horario_salida).slice(0, 5) : '',
      requiere_asistencia: emp.requiere_asistencia !== false,
      contacto_emergencia: emp.contacto_emergencia ?? '',
      numero_emergencia: emp.numero_emergencia ?? '',
    });
    setIsOpen(true);
  };

  const cerrarFormulario = () => {
    setIsOpen(false);
    setEditingEmployee(null);
    setNuevoEmp({ ...EMPLEADO_FORM_INITIAL });
  };

  const guardarEmpleado = async () => {
    if (!nuevoEmp.nombre_completo || !nuevoEmp.fecha_contratacion) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El nombre y fecha de contratación son obligatorios." });
      return;
    }
    if (editingEmployee) {
      setConfirmUpdateOpen(true);
      return;
    }
    await ejecutarGuardado();
  };

  const ejecutarGuardado = async () => {
    setConfirmUpdateOpen(false);
    const payload = {
      nombre_completo: nuevoEmp.nombre_completo.trim(),
      puesto: nuevoEmp.puesto.trim() || null,
      fecha_contratacion: nuevoEmp.fecha_contratacion || null,
      fecha_nacimiento: nuevoEmp.fecha_nacimiento?.trim() || null,
      nss: nuevoEmp.nss.trim() || null,
      telefono: nuevoEmp.telefono.trim() || null,
      curp: nuevoEmp.curp.trim() || null,
      salario_semanal: nuevoEmp.salario_semanal !== '' ? Number(nuevoEmp.salario_semanal) : null,
      horario_entrada: nuevoEmp.horario_entrada || null,
      horario_comida_inicio: nuevoEmp.horario_comida_inicio || null,
      horario_comida_fin: nuevoEmp.horario_comida_fin || null,
      horario_salida: nuevoEmp.horario_salida || null,
      requiere_asistencia: nuevoEmp.requiere_asistencia !== false,
      contacto_emergencia: nuevoEmp.contacto_emergencia.trim() || null,
      numero_emergencia: nuevoEmp.numero_emergencia.trim() || null,
    };
    try {
      if (editingEmployee) {
        const { error } = await supabase.from('empleados').update(payload).eq('id', editingEmployee.id);
        if (error) throw error;
        toast({ title: "Colaborador actualizado", description: "Los datos se han guardado correctamente." });
      } else {
        const { data: inserted, error } = await supabase.from('empleados').insert([{ ...payload, activo: true }]).select('id, nombre_completo, fecha_nacimiento').single();
        if (error) throw error;
        toast({ title: "Empleado guardado" });
        if (inserted?.fecha_nacimiento) {
          try {
            await syncCumpleanosGoogleCalendar([{ id: inserted.id, nombre_completo: inserted.nombre_completo, fecha_nacimiento: inserted.fecha_nacimiento, google_calendar_cumple_id: null }]);
          } catch (e) {
            console.warn('Sincronización de cumpleaños tras alta:', e);
          }
        }
      }
      cerrarFormulario();
      onReload();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const [syncingCumple, setSyncingCumple] = useState(false);
  const handleSyncCumpleanos = async () => {
    setSyncingCumple(true);
    try {
      const res = await syncCumpleanosGoogleCalendar(empleados);
      toast({
        title: 'Cumpleaños sincronizados',
        description: `Creados: ${res.creados}, eliminados: ${res.eliminados}${res.errores ? `, errores: ${res.errores}` : ''}.`,
      });
      onReload();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e?.message || 'No se pudo sincronizar cumpleaños con Google Calendar.' });
    } finally {
      setSyncingCumple(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Directorio Activo</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSyncCumpleanos} disabled={syncingCumple}>
            {syncingCumple ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>🎂 Sincronizar Cumpleaños del Año</span>
          </Button>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) cerrarFormulario(); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 gap-2 text-white hover:bg-blue-700" onClick={() => { setEditingEmployee(null); setNuevoEmp({ ...EMPLEADO_FORM_INITIAL }); }}><Plus className="w-4 h-4"/> Nuevo Empleado</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Editar colaborador' : 'Registrar Nuevo Colaborador'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Datos personales */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Datos personales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Nombre completo</label>
                    <Input value={nuevoEmp.nombre_completo} onChange={e => setNuevoEmp({ ...nuevoEmp, nombre_completo: e.target.value })} placeholder="Ej. Juan Pérez" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CURP</label>
                    <Input value={nuevoEmp.curp} onChange={e => setNuevoEmp({ ...nuevoEmp, curp: e.target.value })} placeholder="18 caracteres" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input value={nuevoEmp.telefono} onChange={e => setNuevoEmp({ ...nuevoEmp, telefono: e.target.value })} placeholder="Ej. 5512345678" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha de nacimiento</label>
                    <DatePicker
                      value={nuevoEmp.fecha_nacimiento}
                      onChange={(v) => setNuevoEmp({ ...nuevoEmp, fecha_nacimiento: v })}
                      placeholder="Seleccionar fecha"
                      aria-label="Fecha de nacimiento para cumpleaños en el calendario"
                    />
                  </div>
                </div>
              </div>
              {/* Datos laborales */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Datos laborales</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Puesto</label>
                    <Input value={nuevoEmp.puesto} onChange={e => setNuevoEmp({ ...nuevoEmp, puesto: e.target.value })} placeholder="Ej. Oficial Albañil" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha contratación</label>
                    <DatePicker value={nuevoEmp.fecha_contratacion} onChange={(v) => setNuevoEmp({ ...nuevoEmp, fecha_contratacion: v })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">NSS</label>
                    <Input value={nuevoEmp.nss} onChange={e => setNuevoEmp({ ...nuevoEmp, nss: e.target.value })} placeholder="Número de Seguro Social" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Salario semanal</label>
                    <Input type="number" min={0} step={0.01} value={nuevoEmp.salario_semanal} onChange={e => setNuevoEmp({ ...nuevoEmp, salario_semanal: e.target.value })} placeholder="0.00" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 mb-4">
                  <Checkbox
                    id="requiere_asistencia"
                    checked={nuevoEmp.requiere_asistencia !== false}
                    onCheckedChange={(checked) => setNuevoEmp({ ...nuevoEmp, requiere_asistencia: checked === true })}
                  />
                  <label htmlFor="requiere_asistencia" className="text-sm font-medium cursor-pointer">
                    Aplica para toma de asistencia (Pasa lista)
                  </label>
                </div>
              </div>
              {/* Horario */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Horario</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Entrada</label>
                    <Input type="time" value={nuevoEmp.horario_entrada} onChange={e => setNuevoEmp({ ...nuevoEmp, horario_entrada: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comida inicio</label>
                    <Input type="time" value={nuevoEmp.horario_comida_inicio} onChange={e => setNuevoEmp({ ...nuevoEmp, horario_comida_inicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comida fin</label>
                    <Input type="time" value={nuevoEmp.horario_comida_fin} onChange={e => setNuevoEmp({ ...nuevoEmp, horario_comida_fin: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Salida</label>
                    <Input type="time" value={nuevoEmp.horario_salida} onChange={e => setNuevoEmp({ ...nuevoEmp, horario_salida: e.target.value })} />
                  </div>
                </div>
              </div>
              {/* Contactos de emergencia */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Contactos de emergencia</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre del contacto</label>
                    <Input value={nuevoEmp.contacto_emergencia} onChange={e => setNuevoEmp({ ...nuevoEmp, contacto_emergencia: e.target.value })} placeholder="Ej. María López" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Número de emergencia</label>
                    <Input value={nuevoEmp.numero_emergencia} onChange={e => setNuevoEmp({ ...nuevoEmp, numero_emergencia: e.target.value })} placeholder="Teléfono" />
                  </div>
                </div>
              </div>
              <div className={cn("flex gap-2", editingEmployee ? "justify-between" : "justify-end")}>
                {editingEmployee ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      if (!window.confirm('¿Estás seguro de dar de baja a este colaborador? Su historial se conservará pero desaparecerá de las listas activas.')) return;
                      (async () => {
                        try {
                          const { error } = await supabase.from('empleados').update({ activo: false }).eq('id', editingEmployee.id);
                          if (error) throw error;
                          toast({ title: 'Colaborador dado de baja', description: 'Ya no aparecerá en el directorio activo.' });
                          cerrarFormulario();
                          onReload();
                        } catch (e) {
                          toast({ variant: 'destructive', title: 'Error', description: e?.message || 'No se pudo dar de baja.' });
                        }
                      })();
                    }}
                  >
                    Dar de Baja
                  </Button>
                ) : null}
                <Button onClick={guardarEmpleado} className="bg-blue-600 text-white hover:bg-blue-700">
                  {editingEmployee ? 'Guardar cambios' : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <DetalleEmpleadoModal empleado={previewEmpleado} open={!!previewEmpleado} onOpenChange={(open) => !open && setPreviewEmpleado(null)} />

      <AlertDialog open={confirmUpdateOpen} onOpenChange={setConfirmUpdateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Actualizar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas actualizar los datos de este colaborador?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={ejecutarGuardado} className="bg-blue-600 hover:bg-blue-700">Sí, actualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empleados.map(emp => {
          const diasVacaciones = calcularVacaciones(emp.fecha_contratacion);
          const aniosAntiguedad = emp.fecha_contratacion ? differenceInYears(new Date(), parseISO(emp.fecha_contratacion)) : 0;

          return (
            <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between hover:shadow-md transition-shadow relative">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {(emp.nombre_completo || '?').charAt(0)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); setPreviewEmpleado(emp); }} title="Ver detalle">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-amber-600 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); abrirParaEditar(emp); }} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Switch
                      title="Aplica para asistencia"
                      checked={emp.requiere_asistencia !== false}
                      onCheckedChange={async (checked) => {
                        try {
                          const { error } = await supabase.from('empleados').update({ requiere_asistencia: !!checked }).eq('id', emp.id);
                          if (error) throw error;
                          onReload();
                        } catch (e) {
                          toast({ variant: 'destructive', title: 'Error', description: e?.message || 'No se pudo actualizar.' });
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    <span className={cn("px-2 py-0.5 rounded-full text-xs border font-medium", emp.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                      {emp.activo ? 'Activo' : 'Baja'}
                    </span>
                  </div>
                </div>
                <h4 className="font-bold text-gray-800 mt-3 truncate" title={emp.nombre_completo}>{emp.nombre_completo}</h4>
                <p className="text-sm text-gray-500">{emp.puesto || 'Sin puesto'}</p>
                <div className="mt-4 space-y-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                    <span className="text-gray-500">Antigüedad:</span>
                    <span className="font-medium text-gray-900">{aniosAntiguedad} años</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                    <span className="text-gray-500">Vacaciones Ley:</span>
                    <span className="font-bold text-blue-600">{diasVacaciones} días/año</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ingreso:</span>
                    <span className="text-gray-900">{emp.fecha_contratacion ? format(parseISO(emp.fecha_contratacion), 'dd/MM/yyyy') : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const ControlPersonal = () => {
  const [empleados, setEmpleados] = useState([]);
  const [fechaReferencia, setFechaReferencia] = useState(new Date());

  const fetchEmpleados = async () => {
    try {
      const { data, error } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre_completo');
      if (error) throw error;
      if (data) setEmpleados(data);
    } catch (error) {
      console.error("Error fetching empleados:", error);
    }
  };

  useEffect(() => {
    fetchEmpleados();
  }, []);

  return (
    <>
      <div className="space-y-6 p-6 pb-20"> 
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Control de Personal</h2>
          <p className="text-gray-600">Gestión de asistencia semanal y expedientes de empleados.</p>
        </div>

        <Tabs defaultValue="asistencia" className="w-full">
          <TabsList className="mb-4 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="asistencia" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"><CalendarDays className="w-4 h-4"/> Lista de Asistencia</TabsTrigger>
            <TabsTrigger value="empleados" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"><Users className="w-4 h-4"/> Empleados y Vacaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="asistencia" className="space-y-4">
            <AsistenciaSemanal 
              empleados={empleados.filter((e) => e.requiere_asistencia !== false)} 
              fechaReferencia={fechaReferencia} 
              setFechaReferencia={setFechaReferencia} 
            />
          </TabsContent>
          <TabsContent value="empleados" className="space-y-4">
            <GestionEmpleados empleados={empleados} onReload={fetchEmpleados} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ControlPersonal;