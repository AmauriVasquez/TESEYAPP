# Catálogo de Productos por Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir guardar piezas específicas por cliente (código del cliente + código interno propio) con su precio de referencia, cargarlas directo al armar una cotización, y consultar en qué cotizaciones se ha usado cada pieza.

**Architecture:** Tabla nueva `catalogo_productos_cliente` (una fila por pieza, ligada a `clientes`), columna nueva `producto_cliente_id` en `cotizaciones_items` para trazabilidad. Nueva pestaña "Productos por Cliente" en la pantalla de Catálogo (reutiliza el patrón de `CatalogoServicios.jsx`). El modal de cotización (`CotizacionDialog.jsx`) filtra y ofrece esas piezas junto al catálogo general de servicios cuando la cotización tiene cliente ligado.

**Tech Stack:** React 19 + Vite, Supabase (Postgres + PostgREST + RLS), Tailwind. Este repo no tiene framework de pruebas automatizadas (sin Jest/Vitest) — la verificación de cada tarea es manual: consultas SQL de control y prueba en el navegador (`npm run dev` / preview), siguiendo el mismo patrón que el resto del código existente.

**Referencia:** spec en `docs/superpowers/specs/2026-07-22-catalogo-productos-cliente-design.md`.

---

### Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/2026-07-22_catalogo_productos_cliente.sql`

- [ ] **Step 1: Escribir el SQL de la migración**

```sql
-- supabase/migrations/2026-07-22_catalogo_productos_cliente.sql
-- Catálogo de piezas específicas por cliente: código del cliente + código
-- interno propio (iniciales + consecutivo) + precio de referencia, para
-- dejar de escribir la descripción a mano y cobrar siempre lo mismo por
-- la misma pieza. producto_cliente_id en cotizaciones_items da trazabilidad
-- (historial de uso por pieza) sin depender de que el catálogo siga vivo.

CREATE TABLE public.catalogo_productos_cliente (
  id serial PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_cliente text,
  codigo_interno text NOT NULL,
  descripcion text NOT NULL,
  unidad text,
  precio_unitario numeric(12,2),
  material_id integer REFERENCES public.materiales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_productos_cliente_codigo_interno_key UNIQUE (codigo_interno)
);

CREATE INDEX idx_catalogo_productos_cliente_cliente_id
  ON public.catalogo_productos_cliente (cliente_id);

ALTER TABLE public.catalogo_productos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpc_select ON public.catalogo_productos_cliente
  FOR SELECT USING (true);

CREATE POLICY cpc_write ON public.catalogo_productos_cliente
  FOR ALL
  USING (public.tiene_permiso('cotizaciones', 'editar'))
  WITH CHECK (public.tiene_permiso('cotizaciones', 'editar'));

ALTER TABLE public.cotizaciones_items
  ADD COLUMN producto_cliente_id integer
    REFERENCES public.catalogo_productos_cliente(id) ON DELETE SET NULL;

CREATE INDEX idx_cotizaciones_items_producto_cliente_id
  ON public.cotizaciones_items (producto_cliente_id)
  WHERE producto_cliente_id IS NOT NULL;
```

- [ ] **Step 2: Aplicar la migración**

Este proyecto bloquea `apply_migration` directo a producción (ver convención
del repo) — el dueño del proyecto pega el SQL manualmente en el SQL Editor de
Supabase (proyecto `czbmqzimjlwwgcglubey`). Entregar el contenido del archivo
para que lo pegue y ejecute ahí. No usar `apply_migration` ni `execute_sql`
para este paso.

- [ ] **Step 3: Verificar que la migración quedó aplicada**

Correr (vía MCP de Supabase, `execute_sql`, proyecto `czbmqzimjlwwgcglubey`):

```sql
select column_name, data_type from information_schema.columns
where table_name = 'catalogo_productos_cliente'
order by ordinal_position;

select column_name from information_schema.columns
where table_name = 'cotizaciones_items' and column_name = 'producto_cliente_id';
```

Expected: la primera consulta regresa las 9 columnas definidas arriba; la
segunda regresa una fila (`producto_cliente_id`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-22_catalogo_productos_cliente.sql
git commit -m "feat(db): agrega catalogo_productos_cliente y cotizaciones_items.producto_cliente_id"
```

---

### Task 2: Componente de historial por pieza

**Files:**
- Create: `src/components/cotizaciones/HistorialProductoClienteDialog.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const HistorialProductoClienteDialog = ({ producto, open, onOpenChange }) => {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    if (!open || !producto) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('cotizaciones_items')
        .select('cantidad, precio_unitario, cotizacion:cotizacion_id(folio, fecha, estatus)')
        .eq('producto_cliente_id', producto.id)
        .order('id', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Error cargando historial:', error);
        setRegistros([]);
      } else {
        setRegistros(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, producto]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de {producto?.codigo_interno} — {producto?.descripcion}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Precio cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length > 0 ? (
                registros.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.cotizacion?.folio || '-'}</TableCell>
                    <TableCell>{r.cotizacion?.fecha || '-'}</TableCell>
                    <TableCell>{r.cotizacion?.estatus || '-'}</TableCell>
                    <TableCell className="text-center">{r.cantidad}</TableCell>
                    <TableCell className="text-right">${Number(r.precio_unitario).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Esta pieza aún no se ha usado en ninguna cotización.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HistorialProductoClienteDialog;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build termina sin errores (el componente aún no se usa en ningún
lado, así que solo valida sintaxis/imports).

- [ ] **Step 3: Commit**

```bash
git add src/components/cotizaciones/HistorialProductoClienteDialog.jsx
git commit -m "feat(cotizaciones): agrega modal de historial por pieza de cliente"
```

---

### Task 3: Catálogo CRUD de productos por cliente

**Files:**
- Create: `src/components/cotizaciones/ProductosCliente.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Edit, Trash2, Loader2, History } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Combobox } from '@/components/ui/combobox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import HistorialProductoClienteDialog from './HistorialProductoClienteDialog';

function generarPrefijo(nombre) {
  const soloLetras = (nombre || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  return soloLetras.slice(0, 3) || 'GEN';
}

const emptyForm = { codigo_cliente: '', codigo_interno: '', descripcion: '', unidad: '', precio_unitario: '', material_id: '' };

const ProductosCliente = () => {
  const { toast } = useToast();
  const [clientes, setClientes] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [clienteId, setClienteId] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentProducto, setCurrentProducto] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [historialProducto, setHistorialProducto] = useState(null);

  useEffect(() => {
    (async () => {
      const [clientesRes, materialesRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre, razon_social').order('nombre'),
        supabase.from('materiales').select('id, descripcion').order('descripcion'),
      ]);
      if (clientesRes.error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
      } else {
        setClientes(clientesRes.data || []);
      }
      if (!materialesRes.error) setMateriales(materialesRes.data || []);
    })();
  }, [toast]);

  const fetchProductos = async (idCliente) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('catalogo_productos_cliente')
      .select('*')
      .eq('cliente_id', idCliente)
      .order('codigo_interno');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los productos.' });
      setProductos([]);
    } else {
      setProductos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!clienteId) { setProductos([]); return; }
    fetchProductos(clienteId);
  }, [clienteId]);

  const clientesOptions = clientes.map((c) => ({ value: c.id.toString(), label: c.nombre }));
  const materialesById = useMemo(() => Object.fromEntries(materiales.map((m) => [m.id, m.descripcion])), [materiales]);

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return productos;
    const term = searchTerm.toLowerCase();
    return productos.filter((p) => (
      p.descripcion.toLowerCase().includes(term)
      || (p.codigo_cliente && p.codigo_cliente.toLowerCase().includes(term))
      || (p.codigo_interno && p.codigo_interno.toLowerCase().includes(term))
    ));
  }, [productos, searchTerm]);

  const handleAddNew = () => {
    if (!clienteId) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    const prefijo = generarPrefijo(cliente?.razon_social || cliente?.nombre);
    const consecutivo = String(productos.length + 1).padStart(3, '0');
    setCurrentProducto(null);
    setFormData({ ...emptyForm, codigo_interno: `${prefijo}-${consecutivo}` });
    setIsDialogOpen(true);
  };

  const handleEdit = (producto) => {
    setCurrentProducto(producto);
    setFormData({
      codigo_cliente: producto.codigo_cliente || '',
      codigo_interno: producto.codigo_interno,
      descripcion: producto.descripcion,
      unidad: producto.unidad || '',
      precio_unitario: producto.precio_unitario ?? '',
      material_id: producto.material_id ? producto.material_id.toString() : '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este producto del catálogo del cliente?')) return;
    const { error } = await supabase.from('catalogo_productos_cliente').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el producto.' });
      return;
    }
    setProductos((prev) => prev.filter((p) => p.id !== id));
    toast({ title: 'Producto eliminado' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.descripcion || !formData.codigo_interno || !formData.precio_unitario) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Código interno, descripción y precio son obligatorios.' });
      return;
    }
    setIsSaving(true);
    const payload = {
      cliente_id: clienteId,
      codigo_cliente: formData.codigo_cliente || null,
      codigo_interno: formData.codigo_interno,
      descripcion: formData.descripcion,
      unidad: formData.unidad || null,
      precio_unitario: parseFloat(formData.precio_unitario),
      material_id: formData.material_id ? parseInt(formData.material_id, 10) : null,
    };
    try {
      if (currentProducto) {
        const { data, error } = await supabase
          .from('catalogo_productos_cliente')
          .update(payload)
          .eq('id', currentProducto.id)
          .select()
          .single();
        if (error) throw error;
        setProductos((prev) => prev.map((p) => (p.id === currentProducto.id ? data : p)));
        toast({ title: 'Producto actualizado' });
      } else {
        const { data, error } = await supabase
          .from('catalogo_productos_cliente')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setProductos((prev) => [...prev, data]);
        toast({ title: 'Producto creado' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      const duplicado = error.code === '23505';
      toast({
        variant: 'destructive',
        title: duplicado ? 'Código duplicado' : 'Error',
        description: duplicado ? 'Ese código interno ya existe, elige otro.' : 'Ocurrió un error al guardar el producto.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <Label>Cliente</Label>
        <Combobox
          options={clientesOptions}
          value={clienteId ? clienteId.toString() : ''}
          onChange={(v) => setClienteId(v ? parseInt(v, 10) : null)}
          placeholder="Selecciona un cliente..."
          searchPlaceholder="Buscar cliente..."
          notFoundMessage="No se encontró el cliente"
        />
      </div>

      {clienteId && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar por código, descripción..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleAddNew} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
            </Button>
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[120px]">Código Interno</TableHead>
                    <TableHead className="w-[150px]">Código Cliente</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px]">Unidad</TableHead>
                    <TableHead className="w-[150px]">Material</TableHead>
                    <TableHead className="text-right w-[110px]">Precio</TableHead>
                    <TableHead className="w-[130px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductos.length > 0 ? (
                    filteredProductos.map((producto) => (
                      <TableRow key={producto.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm font-medium text-gray-600">{producto.codigo_interno}</TableCell>
                        <TableCell className="font-mono text-sm">{producto.codigo_cliente || '-'}</TableCell>
                        <TableCell className="font-medium">{producto.descripcion}</TableCell>
                        <TableCell>{producto.unidad || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{producto.material_id ? (materialesById[producto.material_id] || '-') : '-'}</TableCell>
                        <TableCell className="text-right font-mono">${Number(producto.precio_unitario).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setHistorialProducto(producto)} className="h-8 w-8 text-gray-500 hover:text-blue-600" title="Ver historial">
                              <History className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(producto)} className="h-8 w-8 text-gray-500 hover:text-blue-600" title="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(producto.id)} className="h-8 w-8 text-gray-500 hover:text-red-600" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-gray-500">Este cliente no tiene productos registrados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{currentProducto ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo_interno">Código Interno <span className="text-red-500">*</span></Label>
                <Input id="codigo_interno" value={formData.codigo_interno} onChange={(e) => setFormData({ ...formData, codigo_interno: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo_cliente">Código del Cliente</Label>
                <Input id="codigo_cliente" value={formData.codigo_cliente} onChange={(e) => setFormData({ ...formData, codigo_cliente: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción <span className="text-red-500">*</span></Label>
              <Input id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unidad">Unidad</Label>
                <Input id="unidad" value={formData.unidad} onChange={(e) => setFormData({ ...formData, unidad: e.target.value })} placeholder="Ej. pza" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio">Precio Unitario <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input id="precio" type="number" step="0.01" className="pl-7" value={formData.precio_unitario} onChange={(e) => setFormData({ ...formData, precio_unitario: e.target.value })} required />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="material">Material (opcional)</Label>
              <Select value={formData.material_id} onValueChange={(v) => setFormData({ ...formData, material_id: v })}>
                <SelectTrigger id="material"><SelectValue placeholder="Sin material asignado" /></SelectTrigger>
                <SelectContent>
                  {materiales.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {currentProducto ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <HistorialProductoClienteDialog
        producto={historialProducto}
        open={!!historialProducto}
        onOpenChange={(open) => { if (!open) setHistorialProducto(null); }}
      />
    </div>
  );
};

export default ProductosCliente;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build termina sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/cotizaciones/ProductosCliente.jsx
git commit -m "feat(cotizaciones): agrega catalogo CRUD de productos por cliente"
```

---

### Task 4: Agregar la pestaña "Productos por Cliente"

**Files:**
- Modify: `src/components/cotizaciones/CatalogoServicios.jsx`

- [ ] **Step 1: Importar el componente nuevo**

En `src/components/cotizaciones/CatalogoServicios.jsx`, junto al import existente de `CatalogoUnidades` (línea 39):

```jsx
import CatalogoUnidades from './CatalogoUnidades';
import ProductosCliente from './ProductosCliente';
```

- [ ] **Step 2: Agregar el TabsTrigger y el TabsContent**

Reemplazar el bloque de `TabsList` (líneas 230-234):

```jsx
  return (
    <Tabs defaultValue="servicios" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="servicios">Listado de Servicios</TabsTrigger>
        <TabsTrigger value="productos-cliente">Productos por Cliente</TabsTrigger>
        <TabsTrigger value="unidades">Configuración de Unidades</TabsTrigger>
      </TabsList>
```

Y agregar el `TabsContent` correspondiente justo antes del `<TabsContent value="unidades">` (línea 405):

```jsx
      <TabsContent value="productos-cliente">
        <ProductosCliente />
      </TabsContent>

      <TabsContent value="unidades">
        <CatalogoUnidades />
      </TabsContent>
```

- [ ] **Step 3: Verificar en el navegador**

Run: `npm run dev` (o usar el preview del navegador).
Ir a la pantalla de Cotizaciones → Catálogo de Servicios. Confirmar que
aparece la pestaña "Productos por Cliente", que al abrirla pide seleccionar
un cliente, y que al elegir uno se puede crear un producto nuevo (el código
interno se precarga como `XXX-001`).

- [ ] **Step 4: Commit**

```bash
git add src/components/cotizaciones/CatalogoServicios.jsx
git commit -m "feat(cotizaciones): integra pestaña de productos por cliente en el catálogo"
```

---

### Task 5: Cargar productos del cliente en el modal de cotización

**Files:**
- Modify: `src/components/cotizaciones/CotizacionDialog.jsx`

- [ ] **Step 1: Agregar estado y carga de productos del cliente**

Junto al estado de catálogos (línea 38-39):

```jsx
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [unidadesCatalogo, setUnidadesCatalogo] = useState([]);
  const [productosCliente, setProductosCliente] = useState([]);
```

Después del `useEffect` que llama a `fetchData` (línea 195-205), agregar un
nuevo `useEffect` que recarga los productos cada vez que cambia el cliente
seleccionado:

```jsx
  useEffect(() => {
    if (!open || !formData?.cliente_id) {
      setProductosCliente([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('catalogo_productos_cliente')
        .select('*')
        .eq('cliente_id', formData.cliente_id)
        .order('descripcion');
      if (cancelled) return;
      if (error) {
        console.error('Error cargando productos del cliente:', error);
        setProductosCliente([]);
      } else {
        setProductosCliente(data || []);
      }
    })();
    return () => { cancelled = true; };
  }, [open, formData?.cliente_id]);
```

- [ ] **Step 2: Agregar `producto_cliente_id` al estado de la partida en edición**

En el estado inicial de `newItem` (línea 48-54):

```jsx
  const [newItem, setNewItem] = useState({
    descripcion: '',
    cantidad: '',
    precio_unitario: '',
    unidad: 'pza',
    observaciones: '',
    producto_cliente_id: null,
  });
```

En el mismo archivo, el `useEffect` que resetea el formulario al cerrar el
diálogo (línea 195-205) también construye un `newItem` vacío — agregarle el
mismo campo para que quede consistente:

```jsx
  useEffect(() => {
    if(open) {
        fetchData();
    } else {
        setFormData(null);
        setNextFolio('');
        setItems([]);
        setNewItem({ descripcion: '', cantidad: '', precio_unitario: '', unidad: 'pza', observaciones: '', producto_cliente_id: null });
        setSelectedServiceId('');
    }
  }, [open, fetchData]);
```

- [ ] **Step 3: Cambiar `handleServiceSelect` para distinguir producto de cliente vs servicio del catálogo general**

Reemplazar `handleServiceSelect` (líneas 253-266) por:

```jsx
  const handleServiceSelect = (optionValue) => {
      setSelectedServiceId(optionValue);
      if (!optionValue) return;
      const [tipo, rawId] = optionValue.split(':');
      if (tipo === 'pc') {
          const producto = productosCliente.find(p => p.id.toString() === rawId);
          if (producto) {
              setNewItem(prev => ({
                  ...prev,
                  descripcion: producto.descripcion,
                  precio_unitario: producto.precio_unitario,
                  unidad: producto.unidad || prev.unidad,
                  cantidad: prev.cantidad || '1',
                  producto_cliente_id: producto.id,
              }));
          }
      } else if (tipo === 'sv') {
          const service = serviciosCatalogo.find(s => s.id.toString() === rawId);
          if (service) {
              setNewItem(prev => ({
                  ...prev,
                  descripcion: service.descripcion,
                  precio_unitario: service.precio_unitario,
                  unidad: service.unidad,
                  cantidad: prev.cantidad || '1',
                  producto_cliente_id: null,
              }));
          }
      }
  };
```

- [ ] **Step 4: Actualizar `handleDescriptionChange` para el nuevo formato de valor**

Reemplazar `handleDescriptionChange` (líneas 269-279) por:

```jsx
  const handleDescriptionChange = (val) => {
      setNewItem(prev => ({ ...prev, descripcion: val }));
      if (selectedServiceId) {
          const [tipo, rawId] = selectedServiceId.split(':');
          const current = tipo === 'pc'
              ? productosCliente.find(p => p.id.toString() === rawId)
              : serviciosCatalogo.find(s => s.id.toString() === rawId);
          if (current && current.descripcion !== val) {
              setSelectedServiceId('');
          }
      }
  };
```

- [ ] **Step 5: Actualizar `handleAddItem` y `handleEditItem` para conservar `producto_cliente_id`**

En `handleAddItem` (línea 224-233), al limpiar el formulario después de
agregar, incluir el campo nuevo:

```jsx
  const handleAddItem = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precio_unitario) {
        toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor ingresa descripción, cantidad y precio.' });
        return;
    }

    setItems(prev => [...prev, { ...newItem, id: Date.now() }]);
    setNewItem({ descripcion: '', cantidad: '', precio_unitario: '', unidad: 'pza', observaciones: '', producto_cliente_id: null });
    setSelectedServiceId('');
  };
```

En `handleEditItem` (línea 239-251), incluir `producto_cliente_id` al
restaurar la partida al formulario:

```jsx
  const handleEditItem = (indexToEdit) => {
    const item = items[indexToEdit];
    if (!item) return;
    setNewItem({
      descripcion: item.descripcion ?? '',
      cantidad: String(item.cantidad ?? ''),
      precio_unitario: String(item.precio_unitario ?? ''),
      unidad: item.unidad ?? 'pza',
      observaciones: item.observaciones ?? '',
      producto_cliente_id: item.producto_cliente_id ?? null,
    });
    setItems(prev => prev.filter((_, i) => i !== indexToEdit));
    setSelectedServiceId('');
  };
```

- [ ] **Step 6: Fusionar las opciones del combo y ajustar el prefijo de `serviciosOptions`**

Reemplazar la construcción de `serviciosOptions` (línea 407-410) por:

```jsx
  const productosClienteOptions = productosCliente.map(p => ({
      value: `pc:${p.id}`,
      label: `${p.codigo_interno}${p.codigo_cliente ? ' / ' + p.codigo_cliente : ''} - ${p.descripcion}`,
  }));

  const serviciosOptions = serviciosCatalogo.map(s => ({
      value: `sv:${s.id}`,
      label: s.codigo ? `${s.codigo} - ${s.descripcion}` : s.descripcion
  }));

  const catalogoOptions = [...productosClienteOptions, ...serviciosOptions];
```

- [ ] **Step 7: Usar `catalogoOptions` en el Combobox y agregar el aviso de precio distinto**

Reemplazar el `Combobox` de "Cargar del Catálogo" (líneas 559-568):

```jsx
                             <Label className="text-xs font-semibold text-blue-600">Cargar del Catálogo (Opcional)</Label>
                             <Combobox
                                options={catalogoOptions}
                                value={selectedServiceId}
                                onChange={handleServiceSelect}
                                placeholder="Buscar por código o descripción..."
                                searchPlaceholder="Buscar..."
                                notFoundMessage="No encontrado en catálogo"
                                className="w-full"
                             />
```

(sin más cambios aquí; el `div` que lo envuelve queda igual). Justo después
del `Input` de "Precio Unitario" (dentro del `div` de la línea 604-612),
agregar el aviso no bloqueante:

```jsx
                            <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs">Precio Unitario</Label>
                                <Input
                                    type="number"
                                    value={newItem.precio_unitario}
                                    onChange={e => setNewItem({...newItem, precio_unitario: e.target.value})}
                                    placeholder="$0.00"
                                />
                                {productoClienteSeleccionado && precioDistintoDelCatalogo && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Precio distinto al catálogo (${Number(productoClienteSeleccionado.precio_unitario).toFixed(2)})
                                    </p>
                                )}
                            </div>
```

- [ ] **Step 8: Calcular `productoClienteSeleccionado` y `precioDistintoDelCatalogo`**

Junto a `serviciosOptions`/`catalogoOptions` (después del Step 6, antes del
`return`), agregar:

```jsx
  const productoClienteSeleccionado = selectedServiceId?.startsWith('pc:')
      ? productosCliente.find(p => p.id.toString() === selectedServiceId.split(':')[1]) || null
      : null;

  const precioDistintoDelCatalogo = productoClienteSeleccionado
      && parseFloat(newItem.precio_unitario || 0) !== parseFloat(productoClienteSeleccionado.precio_unitario || 0);
```

- [ ] **Step 9: Verificar que compila**

Run: `npm run build`
Expected: build termina sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/components/cotizaciones/CotizacionDialog.jsx
git commit -m "feat(cotizaciones): ofrece productos del cliente al armar una cotización"
```

---

### Task 6: Guardar `producto_cliente_id` al crear/editar la cotización

**Files:**
- Modify: `src/components/cotizaciones/CotizacionDialog.jsx`

- [ ] **Step 1: Incluir el campo en el insert de partidas**

En `handleSubmit`, el mapeo de `itemsToInsert` (línea 347-354):

```jsx
    const itemsToInsert = items.map(item => ({
        cotizacion_id: cotizacionId,
        descripcion: item.descripcion,
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        unidad: item.unidad,
        observaciones: item.observaciones,
        producto_cliente_id: item.producto_cliente_id ?? null,
    }));
```

- [ ] **Step 2: Verificar guardado end-to-end (manual)**

Con `npm run dev`:
1. Ir a Catálogo → "Productos por Cliente", elegir un cliente real, crear un
   producto (ej. descripción "Soporte L", precio $150).
2. Crear una cotización nueva para ese mismo cliente, abrir "Cargar del
   Catálogo", buscar el producto recién creado — debe aparecer primero, con
   su código interno.
3. Seleccionarlo, confirmar que se llenan descripción/unidad/precio, agregar
   la partida y guardar la cotización.
4. Confirmar en Supabase (`execute_sql`) que la fila de `cotizaciones_items`
   quedó con `producto_cliente_id` apuntando al producto creado:
   ```sql
   select id, descripcion, producto_cliente_id from cotizaciones_items
   order by id desc limit 1;
   ```
5. Volver a "Productos por Cliente", abrir "Ver historial" de esa pieza —
   debe listar la cotización recién creada con el precio cobrado.

- [ ] **Step 3: Commit**

```bash
git add src/components/cotizaciones/CotizacionDialog.jsx
git commit -m "feat(cotizaciones): liga las partidas al producto del cliente usado"
```

---

### Task 7: Build y despliegue

**Files:** ninguno nuevo — solo build y publicación manual (convención del repo).

- [ ] **Step 1: Build de producción**

Run: `npm run build`
Expected: genera `dist/` sin errores.

- [ ] **Step 2: Commit del build**

```bash
git add dist
git commit -m "build: catalogo de productos por cliente"
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Recordatorio de publicación manual**

Este repo no tiene despliegue automático. Avisar al usuario que falta subir
el contenido de `dist/` al hosting (Hostinger) para que el cambio quede
visible en producción — igual que en cada entrega anterior.
