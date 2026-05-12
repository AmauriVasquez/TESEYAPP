import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clientes from '@/pages/Clientes';
import Cotizaciones from '@/pages/Cotizaciones';
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

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
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
              <Route path="finanzas" element={<Finanzas />} />

              <Route path="ventas" element={<VentasModuleLayout />}>
                <Route index element={<Navigate to="clientes" replace />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="cotizaciones" element={<Cotizaciones />} />
              </Route>
              <Route path="clientes" element={<Clientes />} />
              <Route path="cotizaciones" element={<Cotizaciones />} />

              <Route path="compras" element={<ComprasModuleLayout />}>
                <Route index element={<Navigate to="pedidos" replace />} />
                <Route path="pedidos" element={<ComprasPedidosPage />} />
                <Route path="proveedores" element={<ComprasProveedoresPage />} />
                <Route path="ordenes" element={<ComprasOrdenesPage />} />
                <Route path="*" element={<Navigate to="/compras/pedidos" replace />} />
              </Route>

              <Route path="almacen" element={<AlmacenModuleLayout />}>
                <Route index element={<Navigate to="materiales" replace />} />
                <Route path="materiales" element={<Materiales />} />
                <Route path="inventario" element={<Inventario />} />
              </Route>
              <Route path="materiales" element={<Materiales />} />
              <Route path="inventario" element={<Inventario />} />

              <Route path="operaciones" element={<OperacionesModuleLayout />}>
                <Route index element={<Navigate to="proyectos" replace />} />
                <Route path="proyectos" element={<Proyectos />} />
                <Route path="proyectos/:id" element={<ProyectoDetalle />} />
              </Route>
              <Route path="proyectos" element={<Proyectos />} />
              <Route path="proyectos/:id" element={<ProyectoDetalle />} />

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
              <Route path="activos" element={<Activos />} />
              <Route path="activos/:id" element={<ActivoDetalle />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="personal" element={<ControlPersonal />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </>
  );
}

export default App;
