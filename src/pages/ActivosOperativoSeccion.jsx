import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Building2, Factory, CalendarClock } from 'lucide-react';

const SECCIONES = {
  vehiculos: {
    titulo: 'Vehículos',
    descripcion:
      'Gestión dedicada de la flotilla y activos móviles. El catálogo general de activos sigue disponible mientras completamos este módulo.',
    icon: Car,
  },
  instalaciones: {
    titulo: 'Instalaciones',
    descripcion:
      'Registro y seguimiento de instalaciones como activos operativos. Pronto podrás filtrar y operar desde aquí; de momento usa el listado global.',
    icon: Building2,
  },
  maquinaria: {
    titulo: 'Maquinaria',
    descripcion:
      'Módulo en preparación. Se conectará con el registro de activos y mantenimiento de maquinaria pesada y equipos de planta.',
    icon: Factory,
  },
  mantenimiento: {
    titulo: 'Mantenimiento',
    descripcion:
      'Vista operativa de mantenimiento de activos (calendarios, órdenes y estados). En desarrollo; el catálogo de activos ya permite estados de mantenimiento y reparación.',
    icon: CalendarClock,
  },
};

const ActivosOperativoSeccion = () => {
  const { seccion } = useParams();
  if (!seccion || !SECCIONES[seccion]) {
    return <Navigate to="/activos" replace />;
  }
  const meta = SECCIONES[seccion];
  const Icon = meta.icon;

  return (
    <>
      <Helmet>
        <title>{meta.titulo} - IIHEMSA Peninsular</title>
      </Helmet>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activos operativos</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{meta.titulo}</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">En evolución</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{meta.descripcion}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/activos">Ir a catálogo de activos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ActivosOperativoSeccion;
