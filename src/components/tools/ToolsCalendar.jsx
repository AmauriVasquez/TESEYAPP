import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Activity } from 'lucide-react';

const ToolsCalendar = ({ tools }) => {

  const calculateStatus = (tool) => {
    let status = { color: 'bg-green-50 border-green-200', text: 'En Regla', urgency: 0, badge: 'default' }; 

    if (tool.criterio_mantenimiento === 'TIEMPO') {
      if (!tool.fecha_prox_mantenimiento) return { color: 'bg-gray-50', text: 'Sin Fecha', urgency: -1, badge: 'secondary' };
      const diffDays = Math.ceil((new Date(tool.fecha_prox_mantenimiento) - new Date()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) status = { color: 'bg-red-50 border-red-200', text: `Vencido (${Math.abs(diffDays)} días)`, urgency: 3, badge: 'destructive' };
      else if (diffDays <= 7) status = { color: 'bg-yellow-50 border-yellow-200', text: `Próximo (${diffDays} días)`, urgency: 2, badge: 'warning' }; // Warning custom style or secondary
      else status = { color: 'bg-white', text: `${diffDays} días restantes`, urgency: 1, badge: 'outline' };

    } else {
      const uso = (tool.contador_actual || 0) - (tool.contador_ultimo_mantenimiento || 0);
      const limite = tool.frecuencia_mantenimiento || 999999;
      const restante = limite - uso;

      if (restante <= 0) status = { color: 'bg-red-50 border-red-200', text: 'VENCIDO (Límite excedido)', urgency: 3, badge: 'destructive' };
      else if (restante <= (limite * 0.1)) status = { color: 'bg-yellow-50 border-yellow-200', text: `Alerta (${restante} rest.)`, urgency: 2, badge: 'secondary' };
      else status = { color: 'bg-white', text: `OK (${restante} rest.)`, urgency: 1, badge: 'outline' };
    }
    return status;
  };

  const sortedTools = [...tools].sort((a, b) => calculateStatus(b).urgency - calculateStatus(a).urgency);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Semáforo de Mantenimiento</h2>
        <p className="text-sm text-muted-foreground">Estado de salud de la maquinaria y equipo.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedTools.map(tool => {
          const info = calculateStatus(tool);
          return (
            <Card key={tool.id} className={`border shadow-sm ${info.color}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {tool.codigo}
                </CardTitle>
                {tool.criterio_mantenimiento === 'TIEMPO' ? <CalendarClock className="h-4 w-4 text-muted-foreground"/> : <Activity className="h-4 w-4 text-muted-foreground"/>}
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold truncate">{tool.nombre}</div>
                <p className="text-xs text-muted-foreground mb-4">
                  {tool.criterio_mantenimiento}: {tool.criterio_mantenimiento === 'TIEMPO' ? tool.fecha_prox_mantenimiento : `${tool.contador_actual} / ${tool.frecuencia_mantenimiento}`}
                </p>
                <div className="flex justify-between items-center">
                  <Badge variant={info.badge}>{info.text}</Badge>
                  {info.urgency >= 2 && (
                    <Button size="sm" variant="secondary" onClick={() => alert("Función programar servicio")}>
                      Programar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsCalendar;