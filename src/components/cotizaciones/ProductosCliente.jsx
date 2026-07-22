import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Trash2, Loader2, History } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Combobox } from '@/components/ui/combobox';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import HistorialProductoClienteDialog from './HistorialProductoClienteDialog';

function generarPrefijo(nombre) {
  const soloLetras = (nombre || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  return soloLetras.slice(0, 3) || 'GEN';
}

const emptyForm = { codigo_cliente: '', codigo_interno: '', descripcion: '', observaciones: '', unidad: '', precio_unitario: '', material_ids: [], servicio_ids: [] };

const ProductosCliente = () => {
  const { toast } = useToast();
  const [clientes, setClientes] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [servicios, setServicios] = useState([]);
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
      const [clientesRes, materialesRes, serviciosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre, razon_social').order('nombre'),
        supabase.from('materiales').select('id, clave, descripcion').order('descripcion'),
        supabase.from('catalogo_servicios').select('id, codigo, descripcion').order('descripcion'),
      ]);
      if (clientesRes.error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
      } else {
        setClientes(clientesRes.data || []);
      }
      if (!materialesRes.error) setMateriales(materialesRes.data || []);
      if (!serviciosRes.error) setServicios(serviciosRes.data || []);
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
  const materialLabel = (m) => (m.clave ? `${m.clave} - ${m.descripcion}` : m.descripcion);
  const servicioLabel = (s) => (s.codigo ? `${s.codigo} - ${s.descripcion}` : s.descripcion);
  const materialesOptions = materiales.map((m) => ({ value: m.id.toString(), label: materialLabel(m) }));
  const serviciosOptions = servicios.map((s) => ({ value: s.id.toString(), label: servicioLabel(s) }));
  const materialesById = useMemo(() => Object.fromEntries(materiales.map((m) => [m.id, materialLabel(m)])), [materiales]);
  const serviciosById = useMemo(() => Object.fromEntries(servicios.map((s) => [s.id, servicioLabel(s)])), [servicios]);

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
      observaciones: producto.observaciones || '',
      unidad: producto.unidad || '',
      precio_unitario: producto.precio_unitario ?? '',
      material_ids: (producto.material_ids || []).map((id) => id.toString()),
      servicio_ids: (producto.servicio_ids || []).map((id) => id.toString()),
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
      observaciones: formData.observaciones || null,
      unidad: formData.unidad || null,
      precio_unitario: parseFloat(formData.precio_unitario),
      material_ids: formData.material_ids.map((id) => parseInt(id, 10)),
      servicio_ids: formData.servicio_ids.map((id) => parseInt(id, 10)),
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
                    <TableHead className="w-[150px]">Servicio</TableHead>
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
                        <TableCell className="font-medium">
                          {producto.descripcion}
                          {producto.observaciones && <div className="text-xs text-gray-500 italic mt-1">Obs: {producto.observaciones}</div>}
                        </TableCell>
                        <TableCell>{producto.unidad || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{(producto.material_ids || []).map((id) => materialesById[id]).filter(Boolean).join(', ') || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600">{(producto.servicio_ids || []).map((id) => serviciosById[id]).filter(Boolean).join(', ') || '-'}</TableCell>
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
                      <TableCell colSpan={8} className="text-center py-12 text-gray-500">Este cliente no tiene productos registrados.</TableCell>
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
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea id="observaciones" value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Cualquier comentario sobre esta pieza..." rows={2} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Materiales (opcional)</Label>
                <MultiCombobox
                  options={materialesOptions}
                  values={formData.material_ids}
                  onChange={(v) => setFormData({ ...formData, material_ids: v })}
                  placeholder="Sin material asignado"
                  searchPlaceholder="Buscar material..."
                  notFoundMessage="No se encontró el material"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servicio">Servicios (opcional)</Label>
                <MultiCombobox
                  options={serviciosOptions}
                  values={formData.servicio_ids}
                  onChange={(v) => setFormData({ ...formData, servicio_ids: v })}
                  placeholder="Sin servicio asignado"
                  searchPlaceholder="Buscar servicio..."
                  notFoundMessage="No se encontró el servicio"
                />
              </div>
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
