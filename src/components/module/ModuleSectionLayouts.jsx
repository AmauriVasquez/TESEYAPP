import React from 'react';
import { Helmet } from 'react-helmet';
import { Outlet } from 'react-router-dom';
import { ModuleSubnavLayout } from '@/components/module/ModuleSubnavLayout';
import PedidosMateriales from '@/pages/PedidosMateriales';
import ProveedoresTab from '@/components/compras/ProveedoresTab';
import OrdenesCompraTab from '@/components/compras/OrdenesCompraTab';
import {
  Users,
  UserPlus,
  FileText,
  Kanban,
  ClipboardList,
  Package,
  Boxes,
  FolderKanban,
  Truck,
  Cuboid,
  Wrench,
  Car,
  Building2,
  Factory,
  CalendarClock,
  LayoutDashboard,
  Coins,
  ListChecks,
} from 'lucide-react';

export function ComprasModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="compras"
      title="Compras"
      items={[
        { to: '/compras/proveedores', label: 'Proveedores', icon: Users },
        { to: '/compras/pedidos', label: 'Pedidos de Materiales', icon: ClipboardList, end: true },
        { to: '/compras/ordenes', label: 'Órdenes de Compra', icon: FileText },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

export function ComprasPedidosPage() {
  return (
    <>
      <Helmet>
        <title>Pedidos de materiales - IIHEMSA Peninsular</title>
      </Helmet>
      <PedidosMateriales isEmbedded />
    </>
  );
}

export function ComprasProveedoresPage() {
  return (
    <>
      <Helmet>
        <title>Proveedores - IIHEMSA Peninsular</title>
      </Helmet>
      <ProveedoresTab />
    </>
  );
}

export function ComprasOrdenesPage() {
  return (
    <>
      <Helmet>
        <title>Órdenes de compra - IIHEMSA Peninsular</title>
      </Helmet>
      <OrdenesCompraTab />
    </>
  );
}

export function VentasModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="ventas"
      title="Ventas"
      items={[
        { to: '/ventas/dashboard', label: 'Dashboard Ventas', icon: LayoutDashboard, end: true },
        { to: '/ventas/prospectos', label: 'Prospectos', icon: UserPlus },
        { to: '/ventas/clientes',   label: 'Clientes',   icon: Users },
        { to: '/ventas/cotizaciones', label: 'Cotizaciones', icon: FileText },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

export function AlmacenModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="almacen"
      title="Almacén"
      items={[
        { to: '/almacen/materiales', label: 'Materiales', icon: Package },
        { to: '/almacen/inventario', label: 'Inventario', icon: Boxes },
        { to: '/almacen/costos', label: 'Costos', icon: Coins },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

export function OperacionesModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="operaciones"
      title="Operaciones"
      items={[
        {
          to: '/operaciones/proyectos',
          label: 'Proyectos',
          icon: FolderKanban,
          isActive: (p) => p.startsWith('/operaciones/proyectos'),
        },
        { to: '/operaciones/tareas', label: 'Tareas', icon: ListChecks },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

export function LogisticaModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="logistica"
      title="Logística"
      items={[{ to: '/logistica/entregas', label: 'Entregas', icon: Truck, end: true }]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

function ActivosOperativosIntro() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/90 p-8 text-center text-sm text-muted-foreground">
      Selecciona un submódulo en el panel izquierdo.
    </div>
  );
}

const ACTIVOS_CATALOGO_ACTIVE = (p) => p === '/activos' || (p.startsWith('/activos/') && !p.startsWith('/activos-operativos'));

export function ActivosOperativosModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="activos-operativos"
      title="Activos operativos"
      items={[
        { to: '/activos', label: 'Catálogo de activos', icon: Cuboid, isActive: ACTIVOS_CATALOGO_ACTIVE },
        { to: '/herramientas', label: 'Herramientas y equipos', icon: Wrench, end: true },
        { to: '/activos-operativos/vehiculos', label: 'Vehículos', icon: Car, end: true },
        { to: '/activos-operativos/instalaciones', label: 'Instalaciones', icon: Building2, end: true },
        { to: '/activos-operativos/maquinaria', label: 'Maquinaria', icon: Factory, end: true },
        { to: '/activos-operativos/mantenimiento', label: 'Mantenimiento', icon: CalendarClock, end: true },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}

export function ActivosOperativosIndexPage() {
  return (
    <>
      <Helmet>
        <title>Activos operativos - IIHEMSA Peninsular</title>
      </Helmet>
      <ActivosOperativosIntro />
    </>
  );
}
