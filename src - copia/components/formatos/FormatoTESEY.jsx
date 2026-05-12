import React, { useRef } from 'react';

import { Button } from '@/components/ui/button';

import { Printer } from 'lucide-react';

import { format } from 'date-fns';

import { es } from 'date-fns/locale';



const FormatoPedidoImprimible = ({ pedidoData = {}, onPrint }) => {

  const printRef = useRef();



  const items = pedidoData.items || [];



  const handleBrowserPrint = () => {

    const printContent = printRef.current;

    const w = window.open('', '_blank');



    w.document.write(`

        <html>

          <head>

            <title>Pedido ${pedidoData.folio || 'Borrador'}</title>

            <script src="https://cdn.tailwindcss.com"></script>

            <style>

              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

              body {

                padding: 40px;

                font-family: 'Inter', sans-serif;

                -webkit-print-color-adjust: exact;

                print-color-adjust: exact;

              }

              @page { size: letter; margin: 0mm; }

            </style>

          </head>

          <body>

            ${printContent.innerHTML}

            <script>

              setTimeout(() => {

                window.print();

              }, 800);

            </script>

          </body>

        </html>

      `);

    w.document.close();



    if (onPrint) onPrint();

  };



  return (

    <div className="flex flex-col items-center w-full bg-gray-100 p-6 rounded-xl">



      {/* --- 1. BARRA DE ACCIONES (Botón Naranja) --- */}

      <div className="w-full max-w-[215mm] flex justify-end mb-4">

        <Button

          onClick={handleBrowserPrint}

          className="

              bg-orange-600 hover:bg-orange-700

              text-white font-semibold

              shadow-md hover:shadow-lg hover:-translate-y-0.5

              transition-all duration-200

              flex items-center gap-2 px-5 py-2 h-auto rounded-lg

            "

        >

          <Printer className="w-4 h-4" />

          <span className="text-sm font-bold">Imprimir Formato</span>

        </Button>

      </div>



      {/* --- 2. EL FORMATO (HOJA DE PAPEL) --- */}

      <div ref={printRef} className="w-full max-w-[215mm] min-h-[279mm] bg-white p-10 shadow-xl text-black relative box-border mx-auto flex flex-col">



        {/* ENCABEZADO */}

        {/* Borde inferior naranja grueso para identidad de marca */}

        <header className="flex justify-between items-start pb-4 border-b-4 border-orange-600 mb-4">

          <div className="w-48">

            {/* ⚠️ IMPORTANTE: Asegúrate de guardar tu imagen como 'logo-tesey.png' en la carpeta public */}

            <img

              alt="Logo Empresa"

              className="h-20 w-auto object-contain"

              src="https://horizons-cdn.hostinger.com/7674e461-e42f-4074-83c5-c45e4d06ed8b/tesey-svg_imgid1-CczHO.png"

              onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/200x80?text=LOGO+TESEY"; }}

            />

          </div>

          <div className="text-right flex-1 pl-8">

            <h1 className="text-lg font-bold text-gray-900 leading-tight">Tecnomaquila y Servicios de Yucatán</h1>

            <div className="mt-1 text-xs text-gray-500 space-y-0.5">

              <p className="font-bold text-orange-600 uppercase">Pedido de Materiales</p>

              <p>Fecha de Emisión: {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>

            </div>

          </div>

        </header>



        {/* DATOS GENERALES (Compacto y limpio) */}

        <div className="bg-white rounded-lg p-2.5 mb-6 border border-gray-200 shadow-sm">

          <div className="flex justify-between items-center mb-2 border-b border-orange-100 pb-1">

            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Folio</span>

            {/* Mantenemos rojo para el folio por convención, o puedes usar text-orange-600 */}

            <span className="text-lg font-bold text-red-600">{pedidoData.folio || 'POR ASIGNAR'}</span>

          </div>



          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">

            <div className="flex flex-col">

              <span className="text-gray-500 font-semibold text-[9px]">Proyecto / Cuenta:</span>

              <span className="font-bold text-gray-900">

                {pedidoData.proyecto?.folio

                  ? `${pedidoData.proyecto.folio} - ${pedidoData.proyecto.descripcion}`

                  : (pedidoData.cuenta || 'Sin Asignar')}

              </span>

            </div>

            <div className="flex flex-col text-right">

              <span className="text-gray-500 font-semibold text-[9px]">Solicitado por:</span>

              <span className="font-medium text-gray-900 uppercase">

                {pedidoData.solicitante?.nombre_completo || 'Usuario del Sistema'}

              </span>

            </div>

            <div className="col-span-2 mt-1 pt-1 border-t border-gray-100">

              <span className="text-gray-500 font-semibold block mb-0.5 text-[9px]">Observaciones Generales:</span>

              <p className="text-gray-700 italic bg-gray-50 p-1.5 border border-gray-100 rounded leading-tight">

                {pedidoData.observaciones || "Sin observaciones adicionales."}

              </p>

            </div>

          </div>

        </div>



        {/* TABLA DE MATERIALES */}

        <div className="flex-grow">

          <table className="w-full text-xs border-collapse">

            <thead>

              {/* Encabezado Gris Oscuro (casi negro) para contraste profesional con el Naranja */}

              <tr className="bg-gray-900 text-white">

                <th className="py-2 px-3 text-center w-12 rounded-tl-md font-bold">#</th>

                <th className="py-2 px-3 text-left font-bold">Descripción del Material</th>

                <th className="py-2 px-3 text-center w-24 font-bold">Unidad</th>

                <th className="py-2 px-3 text-center w-24 rounded-tr-md font-bold">Cantidad</th>

              </tr>

            </thead>

            <tbody className="text-gray-700">

              {items.map((item, index) => (

                <tr key={index} className="border-b border-gray-200 hover:bg-orange-50 transition-colors">

                  <td className="py-3 px-3 text-center font-bold text-gray-400">{index + 1}</td>

                  <td className="py-3 px-3">

                    <p className="font-bold text-gray-900">{item.descripcion || item.material?.descripcion}</p>

                    {item.observaciones && <p className="text-[10px] text-gray-500 italic mt-0.5">Nota: {item.observaciones}</p>}

                  </td>

                  <td className="py-3 px-3 text-center text-gray-500 uppercase">{item.unidad || item.material?.unidad_compra || 'PZA'}</td>

                  <td className="py-3 px-3 text-center">

                    {/* Badge naranja suave para la cantidad */}

                    <span className="inline-block bg-orange-50 text-orange-700 font-bold px-2 py-1 rounded border border-orange-100">

                      {item.cantidad}

                    </span>

                  </td>

                </tr>

              ))}

              {items.length === 0 && (

                <tr>

                  <td colSpan="4" className="py-8 text-center text-gray-400 italic bg-gray-50 border-b">

                    No hay partidas agregadas a este pedido.

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>



        {/* ESPACIO VACÍO AUTOMÁTICO AL FINAL */}

        <div className="mt-8"></div>



        {/* PIE DE PÁGINA (Sin firmas) */}

        <footer className="mt-auto pt-4 border-t-2 border-gray-100">

          <div className="text-[9px] text-gray-400 text-center">

            TESEY - Sistema de Control Interno

          </div>

        </footer>



      </div>

    </div>

  );

};



export default FormatoPedidoImprimible;