import React, { useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  BarChart3,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShoppingCart,
  Warehouse,
  Briefcase,
  MapPin,
  Layers,
  PieChart,
  LogOut,
  Menu,
  X,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { getLogoByMarca } from '@/lib/brandLogos';
import { cn } from '@/lib/utils';

/**
 * @typedef {{ to: string, icon: React.ComponentType<{ className?: string }>, label: string, matchPrefix?: boolean, end?: boolean, isActive?: (pathname: string) => boolean }} NavEntry
 */

/** @type {NavEntry[]} */
const mainNavItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard', end: true },
  { to: '/calendario', icon: Calendar, label: 'Calendario' },
  { to: '/finanzas', icon: DollarSign, label: 'Finanzas' },
  {
    to: '/ventas',
    icon: TrendingUp,
    label: 'Ventas',
    isActive: (p) => p === '/ventas' || p.startsWith('/ventas/') || p.startsWith('/clientes') || p.startsWith('/cotizaciones'),
  },
  { to: '/compras', icon: ShoppingCart, label: 'Compras', matchPrefix: true },
  {
    to: '/almacen',
    icon: Warehouse,
    label: 'Almacén',
    isActive: (p) => p === '/almacen' || p.startsWith('/almacen/') || p.startsWith('/materiales') || p.startsWith('/inventario'),
  },
  {
    to: '/operaciones',
    icon: Briefcase,
    label: 'Operaciones',
    isActive: (p) => p === '/operaciones' || p.startsWith('/operaciones/') || p.startsWith('/proyectos'),
  },
  {
    to: '/logistica',
    icon: MapPin,
    label: 'Logística',
    isActive: (p) => p === '/logistica' || p.startsWith('/logistica/') || p.startsWith('/entregas'),
  },
  {
    to: '/activos-operativos',
    icon: Layers,
    label: 'Activos Operativos',
    isActive: (p) =>
      p === '/activos-operativos' ||
      p.startsWith('/activos-operativos/') ||
      p.startsWith('/activos') ||
      p === '/herramientas',
  },
  { to: '/reportes', icon: PieChart, label: 'Reportes' },
  { to: '/personal', icon: UserCog, label: 'Control de Personal' },
];

function entryIsActive(pathname, entry) {
  if (entry.isActive) return entry.isActive(pathname);
  if (entry.end) return pathname === entry.to;
  if (entry.matchPrefix) return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
  return pathname === entry.to;
}

const Sidebar = ({
  isSidebarOpen,
  setSidebarOpen,
  isCollapsed,
  setIsCollapsed,
  isHoveredGlobal,
  setIsHoveredGlobal,
  isSidebarExpanded,
}) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const closeMobileIfNeeded = useCallback(() => {
    if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [isSidebarOpen, setSidebarOpen]);

  return (
    <aside
      onMouseEnter={() => setIsHoveredGlobal(true)}
      onMouseLeave={() => setIsHoveredGlobal(false)}
      className={cn(
        'fixed top-0 left-0 z-50 flex h-screen flex-col overflow-hidden bg-gray-800 text-white transition-all duration-300 ease-in-out',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0',
        isSidebarExpanded ? 'w-64 max-w-[85vw] md:w-64 md:max-w-none md:shadow-2xl' : 'w-64 max-w-[85vw] md:w-20 md:max-w-none'
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-gray-700',
          isSidebarExpanded ? 'justify-between px-6 py-4' : 'px-2 py-4'
        )}
      >
        <div className={cn('flex min-w-0 items-center', isSidebarExpanded ? 'gap-3' : 'flex-1 justify-center')}>
          {isSidebarExpanded && (
            <img className="h-10 w-auto object-contain" alt="IIHEMSA Peninsular" src={getLogoByMarca('iihemsa_peninsular')} />
          )}
          {!isSidebarExpanded && (
            <img className="h-8 w-auto object-contain" alt="IIHEMSA Peninsular" src={getLogoByMarca('iihemsa_peninsular')} />
          )}
        </div>
        <button type="button" onClick={() => setSidebarOpen(false)} className="shrink-0 text-gray-400 hover:text-white md:hidden">
          <X className="h-6 w-6" />
        </button>
      </div>

      <nav
        className={cn(
          'min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain py-4',
          isSidebarExpanded ? 'px-3' : 'px-2'
        )}
      >
        {mainNavItems.map((entry) => {
          const Icon = entry.icon;
          const isActive = entryIsActive(pathname, entry);
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              title={!isSidebarExpanded ? entry.label : undefined}
              className={cn(
                'flex items-center rounded-lg py-3 text-gray-300 transition-colors duration-200 hover:bg-gray-700 hover:text-white',
                isSidebarExpanded ? 'px-4' : 'justify-center px-2',
                isActive && 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white'
              )}
              onClick={closeMobileIfNeeded}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isSidebarExpanded && 'mr-4')} />
              <span
                className={cn(
                  'min-w-0 font-medium whitespace-nowrap',
                  isSidebarExpanded ? 'block overflow-hidden' : 'hidden'
                )}
              >
                {entry.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className={cn('shrink-0 space-y-2 border-t border-gray-700', isSidebarExpanded ? 'px-4 py-4' : 'px-2 py-4')}>
        <button
          type="button"
          onClick={signOut}
          title={!isSidebarExpanded ? 'Cerrar Sesión' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg py-3 text-gray-300 transition-colors duration-200 hover:bg-gray-700 hover:text-white',
            isSidebarExpanded ? 'px-4' : 'justify-center px-2'
          )}
        >
          <LogOut className={cn('h-5 w-5 shrink-0', isSidebarExpanded && 'mr-4')} />
          <span className={cn('min-w-0 font-medium whitespace-nowrap', isSidebarExpanded ? 'block overflow-hidden' : 'hidden')}>
            Cerrar Sesión
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden w-full items-center justify-center rounded-lg py-2 text-gray-400 transition-colors hover:text-white md:flex"
          title={isCollapsed ? 'Expandir menú (fijar)' : 'Minimizar menú'}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
};

const Layout = () => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [isHoveredGlobal, setIsHoveredGlobal] = React.useState(false);
  const location = useLocation();

  const isSidebarExpanded = isHoveredGlobal || !isCollapsed;

  return (
    <div className="flex h-screen bg-gray-100">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isHoveredGlobal={isHoveredGlobal}
        setIsHoveredGlobal={setIsHoveredGlobal}
        isSidebarExpanded={isSidebarExpanded}
      />

      <div className="ml-0 flex w-full flex-1 flex-col overflow-hidden md:ml-20">
        <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm md:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-gray-600" aria-label="Abrir menú">
            <Menu className="h-6 w-6" />
          </button>
          <img className="h-8 w-auto object-contain" alt="IIHEMSA Peninsular" src={getLogoByMarca('iihemsa_peninsular')} />
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>
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
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default Layout;
