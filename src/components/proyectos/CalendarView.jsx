import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProyectosPathPrefix } from '@/hooks/useProyectosPathPrefix';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import ReactCalendar from 'react-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { addDays, parseISO, isValid } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-calendar/dist/Calendar.css';
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: es }),
  getDay,
  locales: { es },
});

/** Estatus que se pueden filtrar (excluidos Terminado/Entregado) */
const ESTATUS_ACTIVOS = [
  'Por Iniciar',
  'Planeación',
  'En Proceso',
  'Detallado',
  'Revisión',
];

/** Diccionario centralizado: estatus → color (sidebar + barras del calendario) */
const STATUS_COLORS = {
  'Por Iniciar': '#6b7280',
  'Planeación': '#10b981',
  'En Proceso': '#f59e0b',
  'Detallado': '#8b5cf6',
  'Revisión': '#3b82f6',
  'Terminado': '#22c55e',
  'Entregado': '#16a34a',
  'Cancelado': '#94a3b8',
};

/** Color para eventos de cumpleaños (solo visual en calendario interno) */
const CUMBLE_COLOR = '#db2777';

/** Color para citas CRM con prospectos */
const CRM_COLOR = '#6366f1'; // indigo-500

const eventStyleGetter = (event) => {
  if (event?.resource?.tipo === 'cumpleanos') {
    return {
      style: { backgroundColor: CUMBLE_COLOR, borderRadius: '4px', border: 'none', color: 'white' },
    };
  }
  if (event?.resource?.tipo === 'cita_crm') {
    return {
      style: { backgroundColor: CRM_COLOR, borderRadius: '4px', border: 'none', color: 'white' },
    };
  }
  const estatus = event?.resource?.estatus;
  const backgroundColor = STATUS_COLORS[estatus] ?? '#3174ad';
  return {
    style: { backgroundColor, borderRadius: '4px', border: 'none', color: 'white' },
  };
};

const CustomEvent = ({ event }) => {
  const raw = event?.title || '';
  const parts = raw.split(' - ');
  const main = parts[0] || '';
  const sub = parts.slice(1).join(' - ') || '';
  return (
    <div className="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] leading-tight min-h-0">
      <span className="font-bold shrink-0">{main}</span>
      {sub ? (
        <>
          <span className="shrink-0">-</span>
          <span className="truncate opacity-95 min-w-0">{sub}</span>
        </>
      ) : null}
    </div>
  );
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
        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border-0 rounded-md text-sm font-medium text-gray-800 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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

/** Solo inyectar cumpleaños si la fecha del año en curso es hoy o futuro */
function getCumpleAnoActual(fechaNacimiento) {
  const raw = String(fechaNacimiento || '').trim();
  if (!raw) return null;
  const datePart = raw.split('T')[0];
  const parts = datePart.split('-');
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!m || !d || m < 1 || m > 12) return null;
  const year = new Date().getFullYear();
  const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const date = new Date(dateStr + 'T12:00:00');
  return { date, dateStr };
}

/**
 * Vista de calendario tipo Google Calendar: sidebar (mini-calendario + filtros por estatus) y grid principal.
 * Acepta proyectos y empleados (activos) para mostrar cumpleaños del año en curso (hoy o futuro).
 */
const CalendarView = ({ proyectos, empleados = [], citas = [], onSelectCita }) => {
  const navigate = useNavigate();
  const proyectosBase = useProyectosPathPrefix();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState('month');
  const [activeStatuses, setActiveStatuses] = useState([
    'Por Iniciar',
    'Planeación',
    'En Proceso',
    'Detallado',
    'Revisión',
  ]);

  const handleMiniCalendarChange = useCallback((value) => {
    setDate(value instanceof Date ? value : new Date(value));
  }, []);

  const toggleStatus = useCallback((estatus) => {
    setActiveStatuses((prev) =>
      prev.includes(estatus)
        ? prev.filter((s) => s !== estatus)
        : [...prev, estatus]
    );
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const events = useMemo(() => {
    const closed = ['Terminado', 'Entregado'];
    const list = (proyectos || []).filter(
      (p) =>
        p.fecha_inicio &&
        p.fecha_fin &&
        p.estatus &&
        !closed.includes(p.estatus) &&
        activeStatuses.includes(p.estatus)
    );
    const projectEvents = list.map((proyecto) => {
      const start = parseISO(proyecto.fecha_inicio);
      const end = parseISO(proyecto.fecha_fin);
      const startDate = isValid(start) ? start : null;
      const endDate = isValid(end) ? addDays(end, 1) : null;
      if (!startDate || !endDate) return null;
      const title = `${proyecto.folio || 'Sin folio'} - ${proyecto.descripcion || 'Sin descripción'}`;
      return {
        id: proyecto.id,
        title,
        start: startDate,
        end: endDate,
        resource: { ...proyecto, estatus: proyecto.estatus },
      };
    }).filter(Boolean);

    const cumpleEvents = (empleados || [])
      .filter((emp) => emp.fecha_nacimiento)
      .map((emp) => {
        const cumple = getCumpleAnoActual(emp.fecha_nacimiento);
        if (!cumple || cumple.dateStr < todayStr) return null;
        const startDate = cumple.date;
        const endDate = addDays(startDate, 1);
        const title = `🎂 Cumpleaños de ${emp.nombre_completo || 'Colaborador'}`;
        return {
          id: `cumple-${emp.id}`,
          title,
          start: startDate,
          end: endDate,
          resource: { tipo: 'cumpleanos', empleadoId: emp.id },
        };
      })
      .filter(Boolean);

    const TIPO_LABEL = { llamada: 'Llamada', whatsapp: 'WhatsApp', visita: 'Visita' };
    const citaEvents = (citas || [])
      .filter((c) => c.fecha_hora_programada)
      .map((c) => {
        const start = new Date(c.fecha_hora_programada);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
        const tipoLabel = TIPO_LABEL[c.tipo] || c.tipo;
        const nombreProspecto = c.prospecto?.nombre || 'Prospecto';
        return {
          id: `cita-${c.id}`,
          title: `${tipoLabel} — ${nombreProspecto}`,
          start,
          end,
          resource: { tipo: 'cita_crm', citaId: c.id, prospecto: c.prospecto },
        };
      });

    return [...projectEvents, ...cumpleEvents, ...citaEvents];
  }, [proyectos, activeStatuses, empleados, todayStr, citas]);

  const handleSelectEvent = (event) => {
    if (event?.resource?.tipo === 'cumpleanos') return;
    if (event?.resource?.tipo === 'cita_crm') {
      if (onSelectCita && event.resource.prospecto) {
        onSelectCita(event.resource.prospecto);
      }
      return;
    }
    if (event?.resource?.id) {
      navigate(`${proyectosBase}/${event.resource.id}`);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full h-full min-h-[500px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Sidebar izquierdo */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 overflow-y-auto bg-white rounded-t-2xl lg:rounded-tr-none lg:rounded-l-2xl">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Mini calendario</h3>
          <ReactCalendar
            onChange={handleMiniCalendarChange}
            value={date}
            locale="es-ES"
            className="react-calendar-sidebar border-0 w-full"
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Proyectos activos</h3>
          <p className="text-xs text-gray-500 mb-2">Mostrar por estatus:</p>
          <div className="flex flex-col gap-0.5">
            {ESTATUS_ACTIVOS.map((status) => (
              <label
                key={status}
                className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:bg-gray-50 p-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={activeStatuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                <span
                  className="w-3 h-3 rounded-sm shadow-sm shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[status] ?? '#3174ad' }}
                  aria-hidden
                />
                <span className="truncate">{status}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">CRM</h3>
          <div className="flex items-center gap-2 text-sm text-gray-700 p-1">
            <span
              className="w-3 h-3 rounded-sm shadow-sm shrink-0"
              style={{ backgroundColor: CRM_COLOR }}
              aria-hidden
            />
            <span>Citas con prospectos</span>
          </div>
        </div>
      </aside>

      {/* Área del calendario principal */}
      <main className="w-full flex-1 min-h-[500px] md:min-h-[700px] bg-white rounded-lg shadow p-2 md:p-4 overflow-x-auto flex flex-col min-w-0">
        <div className="flex-1 flex flex-col min-h-0" style={{ height: '100%', minHeight: 400 }}>
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
            eventPropGetter={eventStyleGetter}
            components={{
              toolbar: CustomToolbar,
              event: CustomEvent,
            }}
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
              event: 'Evento',
              noEventsInRange: 'No hay proyectos en este rango de fechas.',
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default CalendarView;
