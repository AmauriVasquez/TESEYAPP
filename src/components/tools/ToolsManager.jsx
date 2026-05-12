import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, CalendarRange } from 'lucide-react'; // <-- Importamos iconos
import ToolsInventory from './ToolsInventory';
import ToolsCalendar from './ToolsCalendar';
import NuevoEquipoDialog from './NuevoEquipoDialog';

const ToolsManager = () => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTools = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipos')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) console.error('Error:', error);
    else setTools(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTools();
  }, []);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Herramientas y Equipos</h2>
          <p className="text-muted-foreground">
            Control de inventario, salidas a obra y mantenimientos preventivos.
          </p>
        </div>
        <NuevoEquipoDialog onToolAdded={fetchTools} />
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {/* Icono minimalista */}
            Inventario y Salidas
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> {/* Icono minimalista */}
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {loading ? <p>Cargando datos...</p> : <ToolsInventory tools={tools} />}
        </TabsContent>
        
        <TabsContent value="calendar" className="space-y-4">
          {loading ? <p>Cargando datos...</p> : <ToolsCalendar tools={tools} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ToolsManager;