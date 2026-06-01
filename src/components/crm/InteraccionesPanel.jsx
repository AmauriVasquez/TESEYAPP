import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import CitaForm from '@/components/crm/CitaForm';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: es }),
  getDay,
  locales: { es },
});

const TIPO_LABEL = { llamada: 'Llamada', whatsapp: 'WhatsApp', visita: 'Visita' };

/** Colores por estado de la interacción */
const COLOR_PENDIENTE = '#6366f1'; // indigo-500
const COLOR_REALIZADA = '#9ca3af'; // gray-400

const eventPropGetter = (event) => {
  const pendiente = event?.resource?.programada;
  const backgroundColor = pendiente ? COLOR_PENDIENTE : COLOR_REALIZADA;
  return {
    style: { backgroundColor, borderRadius: '4px', border: 'none', color: 'white' },
  };
};

const CustomToolbar = ({ label, onNavigate, onView, view, views }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onNavigate('TODAY')}
        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
      >
        Hoy
      </button>
      <button
        type="button"
        onClick={() => onNavigate('PREV')}
        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        aria-label="Anterior"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => onNavigate('NEXT')}
        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        aria-label="Siguiente"
      >
        ›
      </button>
    </div>
    <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
    <div>
      <select
        value={view}
        onChange={(e) => onView(e.target.value)}
        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border-0 rounded-md text-sm font-medium text-gray-800 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        {views.map((v) => (
          <option key={v} value={v}>
            {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Día' : v === 'agenda' ? 'Agenda' : v}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default function InteraccionesPanel({ onRefetchProspectos }) {
  const { toast } = useToast();
  const [interacciones, setInteracciones] = useState([]);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState('month');
  const [editOpen, setEditOpen] = useState(false);
  const [sel, setSel] = useState(null);

  const fetchInteracciones = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_interacciones')
      .select(
        'id, tipo, descripcion, fecha, fecha_hora_programada, programada, prospecto_id, marca_origen, prospecto:prospecto_id(id, nombre)'
      )
      .eq('eliminado', false)
      .not('prospecto_id', 'is', null);

    if (error) {
      toast({
        title: 'Error al cargar interacciones',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    // Solo citas: filas con fecha_hora_programada no nula
    setInteracciones((data || []).filter((row) => row.fecha_hora_programada));
  }, [toast]);

  useEffect(() => {
    fetchInteracciones();
  }, [fetchInteracciones]);

  const events = useMemo(
    () =>
      interacciones.map((row) => {
        const start = new Date(row.fecha_hora_programada);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1h
        const tipoLabel = TIPO_LABEL[row.tipo] || row.tipo;
        const nombre = row.prospecto?.nombre || 'Prospecto';
        return {
          id: row.id,
          title: `${tipoLabel} — ${nombre}`,
          start,
          end,
          resource: row,
        };
      }),
    [interacciones]
  );

  const openEdit = useCallback((row) => {
    setSel(row);
    setEditOpen(true);
  }, []);

  const handleSelectEvent = useCallback(
    (event) => {
      if (event?.resource) openEdit(event.resource);
    },
    [openEdit]
  );

  const handleSave = useCallback(() => {
    fetchInteracciones();
    onRefetchProspectos?.();
  }, [fetchInteracciones, onRefetchProspectos]);

  // Interacciones del día seleccionado, ordenadas por hora
  const delDia = useMemo(() => {
    return interacciones
      .filter((row) => isSameDay(new Date(row.fecha_hora_programada), date))
      .sort(
        (a, b) =>
          new Date(a.fecha_hora_programada).getTime() -
          new Date(b.fecha_hora_programada).getTime()
      );
  }, [interacciones, date]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Calendario */}
      <div className="flex-1 min-h-[520px] bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-4 flex flex-col">
        <div className="flex-1 min-h-[460px]" style={{ minHeight: 460 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            date={date}
            onNavigate={setDate}
            onSelectEvent={handleSelectEvent}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            view={view}
            onView={setView}
            culture="es"
            popup
            eventPropGetter={eventPropGetter}
            components={{ toolbar: CustomToolbar }}
            messages={{
              today: 'Hoy',
              previous: 'Anterior',
              next: 'Siguiente',
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Interacción',
              noEventsInRange: 'No hay citas en este rango de fechas.',
            }}
          />
        </div>
        {/* Leyenda */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: COLOR_PENDIENTE }}
              aria-hidden
            />
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: COLOR_REALIZADA }}
              aria-hidden
            />
            <span>Realizada</span>
          </div>
        </div>
      </div>

      {/* Lista lateral del día */}
      <aside className="w-full lg:w-80 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          {format(date, "EEEE d 'de' MMMM", { locale: es })}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          {delDia.length === 0
            ? 'Sin citas este día'
            : `${delDia.length} cita${delDia.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {delDia.map((row) => {
            const tipoLabel = TIPO_LABEL[row.tipo] || row.tipo;
            const nombre = row.prospecto?.nombre || 'Prospecto';
            const color = row.programada ? COLOR_PENDIENTE : COLOR_REALIZADA;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => openEdit(row)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {format(new Date(row.fecha_hora_programada), 'HH:mm')}
                    <span className="text-gray-400 font-normal"> · </span>
                    {tipoLabel}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{nombre}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <CitaForm
        open={editOpen}
        onOpenChange={setEditOpen}
        prospectoId={sel?.prospecto_id}
        marcaOrigen={sel?.marca_origen}
        cita={sel}
        onSave={handleSave}
      />
    </div>
  );
}
