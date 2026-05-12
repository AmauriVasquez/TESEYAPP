import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

const FormatoListaAsistencia = ({ empleados = [], fechaInicio, asistencias = {} }) => {
  const printRef = useRef();

  // 1. Generamos los 7 días del ciclo (de Viernes a Jueves)
  // Si fechaInicio no viene definida, usamos hoy como fallback
  const start = fechaInicio || new Date();
  const diasSemana = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  
  // 2. CÁLCULO DE SEMANA: Basado en el último día (Jueves)
  const fechaFinSemana = diasSemana[6]; 
  const numeroSemana = format(fechaFinSemana, 'w');

  // 3. Función para renderizar las celdas de un día (4 columnas: E, S, E, S)
  const renderDiaCells = (empleadoId, fecha) => {
    const key = `${empleadoId}-${format(fecha, 'yyyy-MM-dd')}`;
    const estatus = asistencias[key] || 'Asistencia';

    // Estilo base de celda
    const cellClass = "border border-gray-400 px-0.5 py-1 text-[7px] text-center h-full align-middle";
    
    // CASO 1: Asistencia Normal -> Llenamos con horarios estándar
    if (estatus === 'Asistencia') {
      return (
        <>
          <td className={cellClass}>09:00</td>
          <td className={cellClass}>14:00</td>
          <td className={cellClass}>15:00</td>
          <td className={cellClass}>18:00</td>
        </>
      );
    }
    
    // CASO 2: Otros Estatus -> Unimos celdas y mostramos el SÍMBOLO GRANDE con estilo específico
    // NOTA: Usamos estilos en línea (style) para garantizar que se impriman los colores
    let texto = '';
    let style = {};
    
    switch(estatus) {
        case 'Falta': 
            texto = 'X'; 
            style = { backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 'bold', fontSize: '14px' }; // Rojo
            break;
        case 'Permiso': 
            texto = 'P'; 
            style = { backgroundColor: '#fefce8', color: '#a16207', fontWeight: 'bold', fontSize: '14px' }; // Amarillo
            break;
        case 'Retardo': 
            texto = 'R'; 
            style = { backgroundColor: '#fff7ed', color: '#ea580c', fontWeight: 'bold', fontSize: '14px' }; // Naranja
            break;
        case 'Vacaciones': 
            texto = 'VAC'; 
            style = { backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 'bold', fontSize: '10px' }; // Azul
            break;
        case 'Incapacidad': 
            texto = 'INC'; 
            style = { backgroundColor: '#faf5ff', color: '#7e22ce', fontWeight: 'bold', fontSize: '10px' }; // Morado
            break;
        default: 
            texto = '-';
    }

    return (
      <td colSpan={4} className={cellClass} style={style}>
        {texto}
      </td>
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
              th, td { border: 1px solid #9ca3af; }
              
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
        className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
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
                        alt="Logo TESEY"
                        className="h-16 w-auto object-contain"
                        src="https://horizons-cdn.hostinger.com/7674e461-e42f-4074-83c5-c45e4d06ed8b/tesey-svg_imgid1-CczHO.png"
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/200x80?text=LOGO+TESEY"; }}
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
                                    {renderDiaCells(emp.id, dia)}
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
                            Simbología: 
                            <span style={{ color: '#dc2626', marginLeft: '4px' }}>X=Falta</span>, 
                            <span style={{ color: '#a16207', marginLeft: '4px' }}>P=Permiso</span>, 
                            <span style={{ color: '#ea580c', marginLeft: '4px' }}>R=Retardo</span>, 
                            <span style={{ color: '#1d4ed8', marginLeft: '4px' }}>VAC=Vacaciones</span>, 
                            <span style={{ color: '#7e22ce', marginLeft: '4px' }}>INC=Incapacidad</span>
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