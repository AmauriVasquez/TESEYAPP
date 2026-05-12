 import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CalendarDays, Plus, Save, ChevronLeft, ChevronRight, 
  CheckCircle2, XCircle, AlertTriangle, Plane 
} from 'lucide-react';
import { format, addDays, addWeeks, differenceInYears, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// CORRECCIÓN: Rutas relativas estándar SIN extensiones
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { cn } from '../lib/utils';

// Importación del formato (Ruta relativa)
import FormatoListaAsistencia from '../components/formatos/FormatoListaAsistencia';

// --- SUBCOMPONENTE: LISTA DE ASISTENCIA ---
const AsistenciaSemanal = ({ empleados, fechaReferencia, setFechaReferencia }) => {
  const { toast } = useToast();
  const [asistencias, setAsistencias] = useState({});
  const [loading, setLoading] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState({});

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

  // Cargar asistencias existentes
  useEffect(() => {
    const fetchAsistencias = async () => {
      setLoading(true);
      const fechaFin = diasSemana[6];
      try {
        const { data, error } = await supabase
          .from('asistencias')
          .select('*')
          .gte('fecha', format(inicioSemana, 'yyyy-MM-dd'))
          .lte('fecha', format(fechaFin, 'yyyy-MM-dd'));

        if (error) throw error;

        if (data) {
          const mapa = {};
          data.forEach(a => {
            mapa[`${a.empleado_id}-${a.fecha}`] = a.estatus;
          });
          setAsistencias(mapa);
        }
      } catch (error) {
        console.error("Error al cargar asistencias:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las asistencias.' });
      } finally {
        setLoading(false);
      }
    };
    fetchAsistencias();
  }, [inicioSemana, diasSemana, toast]);

  const getEstatus = (empleadoId, fecha) => {
    const key = `${empleadoId}-${format(fecha, 'yyyy-MM-dd')}`;
    return cambiosPendientes[key] || asistencias[key] || 'Asistencia';
  };

  const handleEstatusChange = (empleadoId, fecha, nuevoEstatus) => {
    const key = `${empleadoId}-${format(fecha, 'yyyy-MM-dd')}`;
    setCambiosPendientes(prev => ({ ...prev, [key]: nuevoEstatus }));
  };

  const guardarCambios = async () => {
    setLoading(true);
    const updates = Object.entries(cambiosPendientes).map(([key, estatus]) => {
      const [empleado_id, fecha] = key.split('-');
      return { empleado_id, fecha, estatus };
    });

    if (updates.length === 0) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('asistencias').upsert(updates, { onConflict: 'empleado_id,fecha' });

    if (error) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } else {
      toast({ title: 'Asistencias guardadas', description: 'Se han actualizado los registros correctamente.' });
      setCambiosPendientes({});
      window.location.reload(); 
    }
    setLoading(false);
  };

  const iconosEstatus = {
    'Asistencia': <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />,
    'Falta': <XCircle className="w-5 h-5 text-red-500 mx-auto" />,
    'Permiso': <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto" />,
    'Vacaciones': <Plane className="w-5 h-5 text-blue-500 mx-auto" />,
    'Incapacidad': <span className="text-xs font-bold text-purple-600">INC</span>,
    'Retardo': <span className="text-xs font-bold text-orange-600">RET</span>
  };

  return (
    <div className="space-y-4">
      {/* --- BARRA DE CONTROL --- */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm border gap-4">
        
        {/* Navegación Semanal */}
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

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            
            {/* --- BOTÓN DE IMPRIMIR --- */}
            <FormatoListaAsistencia 
                empleados={empleados} 
                fechaInicio={diasSemana[0]} 
                asistencias={{...asistencias, ...cambiosPendientes}} 
            />

            {Object.keys(cambiosPendientes).length > 0 && (
            <Button onClick={guardarCambios} disabled={loading} className="bg-blue-600 hover:bg-blue-700 animate-pulse text-white gap-2">
                <Save className="w-4 h-4" /> Guardar ({Object.keys(cambiosPendientes).length})
            </Button>
            )}
        </div>
      </div>

      {/* Tabla de Asistencia en Pantalla */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs">
            <tr>
              <th className="p-4 min-w-[200px] sticky left-0 bg-gray-100 z-10">Empleado</th>
              {diasSemana.map(dia => (
                <th key={dia.toString()} className={cn("p-2 text-center min-w-[80px]", isSameDay(dia, new Date()) && "bg-blue-100 text-blue-800")}>
                  <div>{format(dia, 'EEEE', { locale: es })}</div>
                  <div className="text-[10px] opacity-70">{format(dia, 'dd/MMM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r">
                  {emp.nombre_completo}
                  <div className="text-xs text-gray-400 font-normal">{emp.puesto}</div>
                </td>
                {diasSemana.map(dia => {
                  const estatus = getEstatus(emp.id, dia);
                  return (
                    <td key={dia.toString()} className="p-2 text-center border-l relative group">
                      <div className="cursor-pointer hover:scale-110 transition-transform flex justify-center">
                        {iconosEstatus[estatus]}
                      </div>
                      {/* Menú de selección invisible sobre la celda */}
                      <select 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={estatus}
                        onChange={(e) => handleEstatusChange(emp.id, dia, e.target.value)}
                      >
                        <option value="Asistencia">Asistencia</option>
                        <option value="Falta">Falta</option>
                        <option value="Retardo">Retardo</option>
                        <option value="Permiso">Permiso</option>
                        <option value="Vacaciones">Vacaciones</option>
                        <option value="Incapacidad">Incapacidad</option>
                      </select>
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
  const [nuevoEmp, setNuevoEmp] = useState({ nombre_completo: '', puesto: '', fecha_contratacion: '', nss: '', telefono: '' });

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

  const guardarEmpleado = async () => {
    if (!nuevoEmp.nombre_completo || !nuevoEmp.fecha_contratacion) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El nombre y fecha de contratación son obligatorios." });
      return;
    }
    try {
      const { error } = await supabase.from('empleados').insert([nuevoEmp]);
      if (error) throw error;
      
      toast({ title: "Empleado guardado" });
      setIsOpen(false);
      setNuevoEmp({ nombre_completo: '', puesto: '', fecha_contratacion: '', nss: '', telefono: '' });
      onReload();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Directorio Activo</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 gap-2 text-white hover:bg-blue-700"><Plus className="w-4 h-4"/> Nuevo Empleado</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Nuevo Colaborador</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label>Nombre Completo</label>
                <Input value={nuevoEmp.nombre_completo} onChange={e => setNuevoEmp({...nuevoEmp, nombre_completo: e.target.value})} placeholder="Ej. Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label>Puesto</label>
                  <Input value={nuevoEmp.puesto} onChange={e => setNuevoEmp({...nuevoEmp, puesto: e.target.value})} placeholder="Ej. Oficial Albañil" />
                </div>
                <div className="space-y-2">
                  <label>Fecha Contratación</label>
                  <Input type="date" value={nuevoEmp.fecha_contratacion} onChange={e => setNuevoEmp({...nuevoEmp, fecha_contratacion: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label>NSS</label>
                  <Input value={nuevoEmp.nss} onChange={e => setNuevoEmp({...nuevoEmp, nss: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label>Teléfono</label>
                  <Input value={nuevoEmp.telefono} onChange={e => setNuevoEmp({...nuevoEmp, telefono: e.target.value})} />
                </div>
              </div>
              <Button onClick={guardarEmpleado} className="bg-blue-600 text-white w-full hover:bg-blue-700">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empleados.map(emp => {
          const diasVacaciones = calcularVacaciones(emp.fecha_contratacion);
          const aniosAntiguedad = differenceInYears(new Date(), parseISO(emp.fecha_contratacion));

          return (
            <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {emp.nombre_completo.charAt(0)}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${emp.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {emp.activo ? 'Activo' : 'Baja'}
                  </span>
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
                    <span className="text-gray-900">{format(parseISO(emp.fecha_contratacion), 'dd/MM/yyyy')}</span>
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
              empleados={empleados} 
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