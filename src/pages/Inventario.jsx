import React from 'react';
import { Helmet } from 'react-helmet';
import { Boxes } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Inventario = () => (
  <>
    <Helmet>
      <title>Inventario - IIHEMSA Peninsular</title>
      <meta name="description" content="Consulta y control de inventario de almacén." />
    </Helmet>
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <Boxes className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inventario</h1>
          <p className="text-sm text-muted-foreground">Almacén · módulo en preparación</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximamente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aquí se integrará el control de existencias, movimientos y ajustes de inventario vinculado a
          materiales y almacén. Mientras tanto puedes gestionar catálogo y existencias desde{' '}
          <span className="font-medium text-foreground">Materiales</span>.
        </CardContent>
      </Card>
    </div>
  </>
);

export default Inventario;
