import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLogoByMarca } from '@/lib/brandLogos';

// Mismo separador que en ControlPersonal (lista de asistencia) para clave empleado+fecha
const ASIST_KEY_SEP = '|';

const FormatoListaAsistencia = ({ empleados = [], fechaInicio, asistencias = {} }) => {
  const printRef = useRef();

  // 1. Generamos los 7 días del ciclo (de Viernes a Jueves)
  // Si fechaInicio no viene definida, usamos hoy como fallback
  const start = fechaInicio || new Date();
  const diasSemana = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  
  // 2. CÁLCULO DE SEMANA: Basado en el último día (Jueves)
  const fechaFinSemana = diasSemana[6]; 
  const numeroSemana = format(fechaFinSemana, 'w');

  const toTime = (v) => (v && String(v).trim()) ? String(v).slice(0, 5) : null;
  const acronimo = (estatus) => {
    const map = { 'Falta': 'F', 'Descanso': 'D', 'Día Festivo': 'DF', 'Incapacidad': 'I', 'Cita Médica': 'CM', 'Curso': 'C', 'Nuevo Ingreso': 'NI', 'Vacaciones': 'V', 'Permiso': 'P' };
    return map[estatus] || (estatus || '—').slice(0, 2);
  };

  // 3. Renderizar 4 celdas por día (E, S, E, S). Sin colSpan: cada celda muestra hora o acrónimo.
  const renderDiaCells = (emp, fecha) => {
    const key = `${emp.id}${ASIST_KEY_SEP}${format(fecha, 'yyyy-MM-dd')}`;
    const row = typeof asistencias[key] === 'object' && asistencias[key] !== null ? asistencias[key] : { estatus: asistencias[key] };
    const isDomingo = fecha.getDay() === 0;
    const estatus = row?.estatus ?? (isDomingo ? 'Descanso' : 'Asistencia');

    const cellClass = "border border-gray-400 px-0.5 py-1 text-[7px] text-center h-full align-middle print:border-black print:text-black";
    const base = (v) => (v && String(v).trim()) ? String(v).slice(0, 5) : '';

    if (estatus === 'Asistencia') {
      const e1 = toTime(row?.hora_entrada) || base(emp?.horario_entrada) || '—';
      const s1 = toTime(row?.hora_comida_salida) || base(emp?.horario_comida_inicio) || '—';
      const e2 = toTime(row?.hora_comida_entrada) || base(emp?.horario_comida_fin) || '—';
      const s2 = toTime(row?.hora_salida) || base(emp?.horario_salida) || '—';
      return (
        <>
          <td className={cellClass}>{e1}</td>
          <td className={cellClass}>{s1}</td>
          <td className={cellClass}>{e2}</td>
          <td className={cellClass}>{s2}</td>
        </>
      );
    }

    const letra = acronimo(estatus);
    const styleMap = {
      Falta: { backgroundColor: '#fef2f2', color: '#dc2626' },
      Descanso: { backgroundColor: '#f3f4f6', color: '#374151' },
      'Día Festivo': { backgroundColor: '#fffbeb', color: '#b45309' },
      Incapacidad: { backgroundColor: '#faf5ff', color: '#7e22ce' },
      'Cita Médica': { backgroundColor: '#f0f9ff', color: '#0369a1' },
      Curso: { backgroundColor: '#f0fdfa', color: '#0f766e' },
      'Nuevo Ingreso': { backgroundColor: '#ecfdf5', color: '#047857' },
      Vacaciones: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
      Permiso: { backgroundColor: '#fefce8', color: '#a16207' },
    };
    const style = { fontWeight: 'bold', fontSize: '10px', ...(styleMap[estatus] || {}) };

    return (
      <>
        <td className={cellClass} style={style}>{letra}</td>
        <td className={cellClass} style={style}>{letra}</td>
        <td className={cellClass} style={style}>{letra}</td>
        <td className={cellClass} style={style}>{letra}</td>
      </>
    );
  };

  const handleBrowserPrint = () => {
      const printContent = printRef.current;
      const w = window.open('', '_blank');
      
      w.document.write(`
        <html>
          <head>
            <title>Lista Asistencia Sem ${numeroSemana}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body { 
                font-family: 'Inter', sans-serif; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                background-color: white;
              }
              /* CONFIGURACIÓN: CARTA HORIZONTAL */
              @page { size: letter landscape; margin: 5mm; }
              
              table { border-collapse: collapse; width: 100%; table-layout: fixed; }
              th, td { border: 1px solid black !important; }
              .print\\:border-black { border-color: black !important; }
              .print\\:text-black { color: black !important; }
              
              /* CLASES FORZADAS PARA IMPRESIÓN */
              .bg-tesey-dark { background-color: #111827 !important; color: white !important; }
              .bg-tesey-header { background-color: #f3f4f6 !important; color: #111827 !important; }
              .border-tesey { border-color: #ea580c !important; }
              
              /* Asegura que los fondos se vean */
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              setTimeout(() => { window.print(); }, 800);
            </script>
          </body>
        </html>
      `);
      w.document.close();
  };

  return (
    <>
      <Button 
        onClick={handleBrowserPrint} 
        variant="outline"
        className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 print:hidden"
      >
        <Printer className="w-4 h-4" /> Imprimir Lista
      </Button>

      {/* --- LIENZO DE DISEÑO (OCULTO EN PANTALLA, SE LLENA AL IMPRIMIR) --- */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="w-full mx-auto p-2">
            
            {/* 1. ENCABEZADO INSTITUCIONAL TESEY */}
            {/* Usamos style inline para asegurar bordes de color al imprimir */}
            <header className="flex justify-between items-center pb-2 mb-2" style={{ borderBottom: '4px solid #ea580c' }}>
                <div className="w-40">
                    <img
                        alt="IIHEMSA Peninsular"
                        className="h-16 w-auto object-contain"
                        src={getLogoByMarca('iihemsa_peninsular')}
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/200x80?text=IIHEMSA+Peninsular"; }}
                    />
                </div>
                <div className="text-right flex-1 pl-4">
                    <h1 className="text-lg font-bold text-gray-900 leading-none">Tecnomaquila y Servicios de Yucatán</h1>
                    <div className="mt-1 text-xs text-gray-500 flex justify-end gap-6 items-center">
                        <span className="font-bold text-orange-600 uppercase" style={{ color: '#ea580c' }}>Lista de Asistencia Semanal</span>
                        {/* Semana basada en el Jueves (fechaFinSemana) */}
                        <span className="bg-gray-100 px-2 py-0.5 rounded" style={{ backgroundColor: '#f3f4f6' }}>Semana: <b className="text-black text-sm">{numeroSemana}</b></span>
                        <span>Del <b className="text-black">{format(diasSemana[0], "dd/MMM", { locale: es })}</b> al <b className="text-black">{format(diasSemana[6], "dd/MMM/yyyy", { locale: es })}</b></span>
                    </div>
                </div>
            </header>

            {/* 2. TABLA COMPLEJA (ESTILO EXCEL / TESEY) */}
            <table className="w-full text-center text-[8px]">
                {/* Estructura de Columnas */}
                <colgroup><col style={{ width: '2%' }} /><col style={{ width: '12%' }} />{diasSemana.map(d => (<React.Fragment key={d}><col style={{ width: '2.5%' }} /><col style={{ width: '2.5%' }} /><col style={{ width: '2.5%' }} /><col style={{ width: '2.5%' }} /></React.Fragment>))}<col style={{ width: '8%' }} /></colgroup>

                <thead>
                    {/* FILA 1: DÍAS DE LA SEMANA */}
                    <tr className="header-dark text-white uppercase h-6 bg-tesey-dark" style={{ backgroundColor: '#111827', color: 'white' }}>
                        <th rowSpan={3} className="border border-gray-500">No.</th>
                        <th rowSpan={3} className="border border-gray-500">Nombre del Empleado</th>
                        {diasSemana.map(dia => (
                            <th key={dia.toString()} colSpan={4} className="border border-gray-500 py-1">
                                {format(dia, 'EEEE dd/MMM', { locale: es })}
                            </th>
                        ))}
                        <th rowSpan={3} className="border border-gray-500">Firma</th>
                    </tr>
                    
                    {/* FILA 2: HORARIO COMIDA (VISUAL) */}
                    <tr className="bg-gray-100 text-[6px] text-gray-500 uppercase h-4" style={{ backgroundColor: '#f3f4f6' }}>
                         {diasSemana.map(dia => (
                            <th key={dia} colSpan={4} className="border border-gray-400 font-normal">
                                Horario Comida
                            </th>
                        ))}
                    </tr>

                    {/* FILA 3: ENTRADA / SALIDA */}
                    <tr className="sub-header h-5 bg-tesey-header" style={{ backgroundColor: '#e5e7eb', color: '#111827' }}>
                        {diasSemana.map(dia => (
                            <React.Fragment key={dia}>
                                <th className="border border-gray-400">E</th>
                                <th className="border border-gray-400">S</th>
                                <th className="border border-gray-400">E</th>
                                <th className="border border-gray-400">S</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>

                <tbody className="text-gray-800">
                    {empleados.map((emp, index) => (
                        <tr key={emp.id} className="h-7 hover:bg-gray-50">
                            <td className="font-bold bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>{index + 1}</td>
                            <td className="text-left px-1 font-bold uppercase truncate border-r-2 border-gray-300">
                                {emp.nombre_completo}
                            </td>
                            {/* Celdas de días dinámicas (Horarios o Símbolos) */}
                            {diasSemana.map(dia => (
                                <React.Fragment key={dia.toString()}>
                                    {renderDiaCells(emp, dia)}
                                </React.Fragment>
                            ))}
                            {/* Firma */}
                            <td></td>
                        </tr>
                    ))}
                    
                    {/* Mensaje si no hay empleados */}
                    {empleados.length === 0 && (
                        <tr>
                            <td colSpan={31} className="py-4 text-center italic text-gray-400">
                                No hay empleados activos registrados para este periodo.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* 3. PIE DE PÁGINA */}
            <div className="mt-4 grid grid-cols-2 gap-8 text-[9px]">
                {/* Simbología / Notas */}
                <div>
                    <p className="font-bold uppercase mb-1">Observaciones:</p>
                    <div className="border border-gray-300 h-10 mb-2" style={{ backgroundColor: '#f9fafb' }}></div>
                    <p className="text-[8px] text-gray-500">
                        * E = Entrada, S = Salida. Horario Comida intermedio.
                        <br/>
                        <span className="font-bold text-black" style={{ marginTop: '4px', display: 'inline-block' }}>
                            Simbología: F=Falta, D=Descanso, DF=Día Festivo, I=Incapacidad, CM=Cita Médica, C=Curso, NI=Nuevo Ingreso, V=Vacaciones, P=Permiso
                        </span>
                    </p>
                </div>

                {/* Firmas Autorización */}
                <div className="flex justify-end gap-8 pt-4">
                    <div className="text-center w-32 border-t border-black pt-1">
                        <p className="font-bold uppercase">Supervisor</p>
                    </div>
                    <div className="text-center w-32 border-t border-black pt-1">
                        <p className="font-bold uppercase">Recursos Humanos</p>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </>
  );
};

export default FormatoListaAsistencia;