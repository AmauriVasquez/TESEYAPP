import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Users, Package, FileText, ShoppingCart, Truck, PieChart, LogOut, Menu, X, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' }, 
  { to: '/clientes', icon: Users, label: 'Clientes' }, 
  { to: '/cotizaciones', icon: FileText, label: 'Cotizaciones' }, 
  { to: '/proyectos', icon: FileText, label: 'Proyectos' }, 
  { to: '/materiales', icon: Package, label: 'Materiales' }, 
  { to: '/compras', icon: ShoppingCart, label: 'Compras' }, 
  { to: '/entregas', icon: Truck, label: 'Entregas' }, 
  { to: '/herramientas', icon: Wrench, label: 'Herramienta y Equipo' },
  { to: '/reportes', icon: PieChart, label: 'Reportes' },
  {to: '/personal', icon: Users,label: 'Control de Personal'},
];

const Sidebar = ({ isSidebarOpen, setSidebarOpen }) => {
  const { signOut } = useAuth();
  const location = useLocation();

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <NavLink 
        to={to} 
        className={`flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors duration-200 ${isActive ? 'bg-blue-600 text-white' : ''}`} 
        onClick={() => isSidebarOpen && window.innerWidth < 768 && setSidebarOpen(false)}
      >
        <Icon className="w-5 h-5 mr-4" />
        <span className="font-medium">{label}</span>
      </NavLink>
    );
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 bg-gray-800 text-white transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:w-64 transition-transform duration-300 ease-in-out flex flex-col`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* CORRECCIÓN: class -> className */}
          <img className="h-10" alt="IHEM5A Logo" src="https://horizons-cdn.hostinger.com/7674e461-e42f-4074-83c5-c45e4d06ed8b/tesey-svg_imgid1-CczHO.png" />
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map(item => <NavItem key={item.to} {...item} />)}
      </nav>
      <div className="px-4 py-4 border-t border-gray-700 space-y-2">
        <button onClick={signOut} className="w-full flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors duration-200">
          <LogOut className="w-5 h-5 mr-4" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

const Layout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setSidebarOpen(false)} 
            className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          />
        )}
      </AnimatePresence>

      <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm md:hidden flex items-center justify-between px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          {/* CORRECCIÓN: class -> className */}
          <img className="h-8" alt="IHEM5A Logo" src="https://horizons-cdn.hostinger.com/7674e461-e42f-4074-83c5-c45e4d06ed8b/tesey-svg_imgid1-CczHO.png" />
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
          {/* CORRECCIÓN: Se agrega className="w-full" y ajustes de transición */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={location.pathname} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              transition={{ duration: 0.15 }}
              className="w-full" 
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;