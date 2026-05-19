import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2, ShieldOff } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { PermissionsProvider, usePermissions } from '@/contexts/PermissionsContext';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clientes from '@/pages/Clientes';
import Cotizaciones from '@/pages/Cotizaciones';
import Prospectos from '@/pages/Prospectos';
import CRM from '@/pages/CRM';
import Proyectos from '@/pages/Proyectos';
import ProyectoDetalle from '@/pages/ProyectoDetalle';
import Calendario from '@/pages/Calendario';
import Materiales from '@/pages/Materiales';
import Entregas from '@/pages/Entregas';
import Activos from '@/pages/Activos';
import ActivoDetalle from '@/pages/ActivoDetalle';
import Reportes from '@/pages/Reportes';
import Finanzas from '@/pages/Finanzas';
import ControlPersonal from './pages/ControlPersonal';
import AdminUsuarios from '@/pages/AdminUsuarios';
import Inventario from '@/pages/Inventario';
import ActivosOperativoSeccion from '@/pages/ActivosOperativoSeccion';
import ToolsManager from '@/components/tools/ToolsManager';
import {
  ComprasModuleLayout,
  ComprasPedidosPage,
  ComprasProveedoresPage,
  ComprasOrdenesPage,
  VentasModuleLayout,
  AlmacenModuleLayout,
  OperacionesModuleLayout,
  LogisticaModuleLayout,
  ActivosOperativosModuleLayout,
  ActivosOperativosIndexPage,
} from '@/components/module/ModuleSectionLayouts';
import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AccessDenied = () => {
  const navigate = useNavigate();
  const { userRole } = usePermissions();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3 pb-2">
          <ShieldOff className="h-12 w-12 text-red-500" />
          <CardTitle className="text-xl">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No tienes permiso para ver esta sección.
          </p>
          <p className="text-xs text-gray-500">
            Tu rol actual: {userRole ?? 'Sin rol'}
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { loading, can } = usePermissions();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    requiredPermission &&
    !can(
      requiredPermission.modulo,
      requiredPermission.accion,
      requiredPermission.submodulo
    )
  ) {
    return <AccessDenied />;
  }

  return children;
};

function App() {
  return (
    <>
      <Helmet>
        <title>Sistema de Control de Proyectos IIHEMSA Peninsular</title>
        <meta name="description" content="Sistema integral de gestión de proyectos metalmecánicos con control de materiales, cotizaciones, compras y entregas" />
      </Helmet>
      <AuthProvider>
        <PermissionsProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="calendario" element={<Calendario />} />
              <Route
                path="finanzas"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'finanzas', accion: 'ver' }}>
                    <Finanzas />
                  </ProtectedRoute>
                }
              />

              <Route path="ventas" element={<VentasModuleLayout />}>
                <Route index element={<Navigate to="clientes" replace />} />
                <Route
                  path="clientes"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'clientes', accion: 'ver' }}>
                      <Clientes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="cotizaciones"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'cotizaciones', accion: 'ver' }}>
                      <Cotizaciones />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="prospectos"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
                      <Prospectos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="crm"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
                      <CRM />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route
                path="clientes"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'clientes', accion: 'ver' }}>
                    <Clientes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cotizaciones"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'cotizaciones', accion: 'ver' }}>
                    <Cotizaciones />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prospectos"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
                    <Prospectos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="crm"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
                    <CRM />
                  </ProtectedRoute>
                }
              />

              <Route
                path="compras"
                element={
                  <ProtectedRoute
                    requiredPermission={{ modulo: 'compras', accion: 'ver', submodulo: 'pedidos' }}
                  >
                    <ComprasModuleLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="pedidos" replace />} />
                <Route
                  path="pedidos"
                  element={
                    <ProtectedRoute
                      requiredPermission={{ modulo: 'compras', accion: 'ver', submodulo: 'pedidos' }}
                    >
                      <ComprasPedidosPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="proveedores" element={<ComprasProveedoresPage />} />
                <Route
                  path="ordenes"
                  element={
                    <ProtectedRoute
                      requiredPermission={{ modulo: 'compras', accion: 'ver', submodulo: 'ordenes' }}
                    >
                      <ComprasOrdenesPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/compras/pedidos" replace />} />
              </Route>

              <Route path="almacen" element={<AlmacenModuleLayout />}>
                <Route index element={<Navigate to="materiales" replace />} />
                <Route
                  path="materiales"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'materiales', accion: 'ver' }}>
                      <Materiales />
                    </ProtectedRoute>
                  }
                />
                <Route path="inventario" element={<Inventario />} />
              </Route>
              <Route
                path="materiales"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'materiales', accion: 'ver' }}>
                    <Materiales />
                  </ProtectedRoute>
                }
              />
              <Route path="inventario" element={<Inventario />} />

              <Route path="operaciones" element={<OperacionesModuleLayout />}>
                <Route index element={<Navigate to="proyectos" replace />} />
                <Route
                  path="proyectos"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'proyectos', accion: 'ver' }}>
                      <Proyectos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="proyectos/:id"
                  element={
                    <ProtectedRoute requiredPermission={{ modulo: 'proyectos', accion: 'ver' }}>
                      <ProyectoDetalle />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route
                path="proyectos"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'proyectos', accion: 'ver' }}>
                    <Proyectos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="proyectos/:id"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'proyectos', accion: 'ver' }}>
                    <ProyectoDetalle />
                  </ProtectedRoute>
                }
              />

              <Route path="logistica" element={<LogisticaModuleLayout />}>
                <Route index element={<Navigate to="entregas" replace />} />
                <Route path="entregas" element={<Entregas />} />
              </Route>
              <Route path="entregas" element={<Entregas />} />

              <Route path="activos-operativos" element={<ActivosOperativosModuleLayout />}>
                <Route index element={<ActivosOperativosIndexPage />} />
                <Route path=":seccion" element={<ActivosOperativoSeccion />} />
              </Route>

              <Route path="herramientas" element={<ToolsManager />} />
              <Route
                path="activos"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'activos', accion: 'ver' }}>
                    <Activos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="activos/:id"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'activos', accion: 'ver' }}>
                    <ActivoDetalle />
                  </ProtectedRoute>
                }
              />
              <Route path="reportes" element={<Reportes />} />
              <Route
                path="personal"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'personal', accion: 'ver' }}>
                    <ControlPersonal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/usuarios"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'admin', accion: 'ver' }}>
                    <AdminUsuarios />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </Router>
        <Toaster />
        </PermissionsProvider>
      </AuthProvider>
    </>
  );
}

export default App;
