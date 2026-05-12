import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, X } from 'lucide-react';

const ToolsInventory = ({ tools }) => {
  const [selectedTools, setSelectedTools] = useState([]);
  const [showExitTicket, setShowExitTicket] = useState(false);
  const componentRef = useRef();

  const handlePrint = useReactToPrint({ content: () => componentRef.current });

  const toggleSelect = (tool) => {
    if (selectedTools.find(t => t.id === tool.id)) {
      setSelectedTools(selectedTools.filter(t => t.id !== tool.id));
    } else {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Disponible': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Disponible</Badge>;
      case 'En Uso': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">En Uso</Badge>;
      case 'Mantenimiento': return <Badge variant="destructive">Mantenimiento</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado de la Sección */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Inventario General</h2>
          <p className="text-sm text-muted-foreground">Gestiona y selecciona equipos para salida.</p>
        </div>
        {selectedTools.length > 0 && (
          <Button onClick={() => setShowExitTicket(true)}>
            Generar Vale ({selectedTools.length})
          </Button>
        )}
      </div>

      {/* Tabla Estilizada */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Sel.</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Marca / Serie</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ubicación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map(tool => (
              <TableRow key={tool.id}>
                <TableCell>
                  <Checkbox 
                    checked={!!selectedTools.find(t => t.id === tool.id)}
                    onCheckedChange={() => toggleSelect(tool)}
                    disabled={tool.estado !== 'Disponible'}
                  />
                </TableCell>
                <TableCell className="font-medium">{tool.codigo}</TableCell>
                <TableCell>{tool.nombre}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tool.marca} <br/> <span className="text-xs">{tool.numero_serie}</span>
                </TableCell>
                <TableCell>{getStatusBadge(tool.estado)}</TableCell>
                <TableCell>{tool.ubicacion_actual}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Vista Previa del Vale (Modal en Pantalla Completa o Condicional) */}
      {showExitTicket && (
        <Card className="mt-8 border-2 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between bg-slate-50">
            <div>
              <CardTitle>Vista Previa del Vale</CardTitle>
              <CardDescription>Listo para imprimir</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handlePrint}><Printer className="h-4 w-4"/></Button>
              <Button variant="ghost" size="icon" onClick={() => setShowExitTicket(false)}><X className="h-4 w-4"/></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* AREA DE IMPRESIÓN */}
            <div ref={componentRef} className="p-8 font-sans bg-white text-black min-h-[500px]">
              <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold">IIHEMSA Peninsular</h1>
                <h3 className="text-xl tracking-widest">VALE DE SALIDA DE EQUIPO</h3>
                <p className="text-sm mt-2">Fecha: {new Date().toLocaleDateString()} | Folio: {Date.now().toString().slice(-6)}</p>
              </div>

              <table className="w-full border-collapse border border-black mb-12 text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-black p-2 w-16">CANT</th>
                    <th className="border border-black p-2">CÓDIGO</th>
                    <th className="border border-black p-2">DESCRIPCIÓN</th>
                    <th className="border border-black p-2">MARCA / SERIE</th>
                    <th className="border border-black p-2">ESTADO SALIDA</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTools.map(t => (
                    <tr key={t.id}>
                      <td className="border border-black p-2 text-center">1</td>
                      <td className="border border-black p-2 font-bold">{t.codigo}</td>
                      <td className="border border-black p-2">{t.nombre}</td>
                      <td className="border border-black p-2">{t.marca} - {t.numero_serie}</td>
                      <td className="border border-black p-2 text-center">BUENO</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between mt-24 px-10">
                <div className="border-t border-black w-5/12 text-center pt-2">
                  <p className="font-bold">ENTREGA (ALMACÉN)</p>
                  <p className="text-xs mt-8">Nombre y Firma</p>
                </div>
                <div className="border-t border-black w-5/12 text-center pt-2">
                  <p className="font-bold">RECIBE (RESPONSABLE)</p>
                  <p className="text-xs mt-8">Nombre y Firma</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ToolsInventory;