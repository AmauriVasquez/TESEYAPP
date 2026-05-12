
import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  isWithinInterval, 
  parseISO, 
  isValid,
  startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { EstatusBadge } from '@/config/proyectosConfig';

const ProyectosCalendar = ({ proyectos }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: es });
    const endDate = endOfWeek(monthEnd, { locale: es });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Calculate active projects for each day
  const dailyWorkload = useMemo(() => {
    const workload = {};
    
    // Initialize map for the displayed days to avoid undefined checks later
    calendarDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      workload[dayKey] = [];
    });

    (proyectos ?? []).forEach(proyecto => {
      if (!proyecto.fecha_inicio || !proyecto.fecha_fin) return;

      const start = parseISO(proyecto.fecha_inicio);
      const end = parseISO(proyecto.fecha_fin);

      if (!isValid(start) || !isValid(end)) return;

      // Optimization: Only check overlap with current view range to avoid iterating all days for all projects
      const viewStart = calendarDays[0];
      const viewEnd = calendarDays[calendarDays.length - 1];
      
      // Check if project overlaps with current calendar view
      if (start > viewEnd || end < viewStart) return;

      // Check each day in current view
      calendarDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        // Using startOfDay to ensure clean comparison ignoring time
        if (isWithinInterval(startOfDay(day), { start: startOfDay(start), end: startOfDay(end) })) {
          if (!workload[dayKey]) workload[dayKey] = [];
          workload[dayKey].push(proyecto);
        }
      });
    });

    return workload;
  }, [calendarDays, proyectos]);

  const getIntensityClass = (count) => {
    if (count === 0) return 'bg-white hover:bg-gray-50 text-gray-400';
    if (count <= 2) return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 font-medium';
    if (count <= 5) return 'bg-emerald-200 hover:bg-emerald-300 text-emerald-900 border-emerald-300 font-semibold';
    return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm';
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const projectsForDay = dailyWorkload[dayKey] || [];
    
    if (projectsForDay.length > 0) {
      setSelectedDate(day);
      setIsDialogOpen(true);
    }
  };

  const selectedProjects = selectedDate 
    ? (dailyWorkload[format(selectedDate, 'yyyy-MM-dd')] || [])
    : [];

  const weekDays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  return (
    <div className="flex flex-col space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="font-medium mr-2 hidden sm:inline">Carga de Trabajo:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></div>
            <span className="text-xs">Baja (1-2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300"></div>
            <span className="text-xs">Media (3-5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600"></div>
            <span className="text-xs">Alta (5+)</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {weekDays.map((day) => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days Body */}
        <div className="grid grid-cols-7 auto-rows-[100px]">
          {calendarDays.map((day, dayIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const projects = dailyWorkload[dayKey] || [];
            const count = projects.length;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "relative border-b border-r p-2 transition-all duration-200 flex flex-col justify-between group",
                  !isCurrentMonth && "bg-gray-50/50 text-gray-300",
                  isCurrentMonth && "bg-white",
                  count > 0 && "cursor-pointer hover:z-10"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isToday 
                      ? "bg-blue-600 text-white shadow-md" 
                      : (isCurrentMonth ? "text-gray-700" : "text-gray-400")
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                {count > 0 && (
                  <div className={cn(
                    "mt-2 p-1 rounded-md border text-xs text-center transition-colors flex flex-col items-center justify-center h-full max-h-[50px]",
                    getIntensityClass(count)
                  )}>
                    <span className="text-lg font-bold leading-none">{count}</span>
                    <span className="text-[10px] opacity-90 leading-none mt-1 truncate w-full px-1">
                      {count === 1 ? 'Proyecto' : 'Proyectos'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Proyectos del {selectedDate && format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
            </DialogTitle>
            <DialogDescription>
              Hay {selectedProjects.length} proyectos activos programados para este día.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4 mt-2">
            <div className="space-y-3">
              {selectedProjects.map((proyecto) => (
                <div key={proyecto.id} className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {proyecto.folio}
                    </span>
                    <EstatusBadge estatus={proyecto.estatus} />
                  </div>
                  <h4 className="font-medium text-sm text-gray-900 mb-1">{proyecto.descripcion}</h4>
                  <div className="text-xs text-gray-500 flex flex-col gap-1">
                    <span>Cliente: <span className="font-medium text-gray-700">{proyecto.cliente_nombre}</span></span>
                    <span>Resp: <span className="font-medium text-gray-700">{proyecto.responsable_nombre}</span></span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 border-t pt-1">
                       <span>Inicia: {proyecto.fecha_inicio || 'N/A'}</span>
                       <span>•</span>
                       <span>Termina: {proyecto.fecha_fin || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex justify-end mt-4">
            <DialogClose asChild>
              <Button variant="secondary">Cerrar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProyectosCalendar;
