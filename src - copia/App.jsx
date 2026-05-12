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
import Materiales from '@/pages/Materiales';
import Compras from '@/pages/Compras';
import Entregas from '@/pages/Entregas';
import Reportes from '@/pages/Reportes';
import ControlPersonal from './pages/ControlPersonal';
import ToolsManager from '@/components/tools/ToolsManager';
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

  // NOTE: The role check is disabled for now.
  // if (requiredRole && user.rol !== requiredRole) {
  //   return <Navigate to="/" />; // Redirect to dashboard if the user doesn't have the required role
  // }
  
  return children;
};

function App() {
  return (
    <>
      <Helmet>
        <title>Sistema de Control de Proyectos TESEY</title>
        <meta name="description" content="Sistema integral de gestión de proyectos metalmecánicos con control de materiales, cotizaciones, compras y entregas" />
      </Helmet>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="cotizaciones" element={<Cotizaciones />} />
              <Route path="proyectos" element={<Proyectos />} />
              <Route path="proyectos/:id" element={<ProyectoDetalle />} />
              <Route path="herramientas" element={<ToolsManager />} />
              <Route path="materiales" element={<Materiales />} />
              <Route path="compras" element={<Compras />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="/personal" element={<ControlPersonal />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </>
  );
}

export default App;