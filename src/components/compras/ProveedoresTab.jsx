import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { PlusCircle, Loader2, Eye, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const BANCOS = ['BBVA', 'Citibanamex', 'Banorte', 'Santander', 'HSBC', 'Scotiabank', 'Inbursa', 'Banregio', 'Banco Azteca', 'BanCoppel', 'Otro'];

const ProveedoresTab = () => {
  const { toast } = useToast();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: null,
    nombre_comercial: '',
    razon_social: '',
    rfc: '',
    contacto: '',
    telefono: '',
    email: '',
    banco: '',
    clabe: '',
    beneficiario: ''
  });
  const [usarRazonSocial, setUsarRazonSocial] = useState(false);

  const fetchProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, nombre_comercial, razon_social, rfc, contacto, telefono, email, banco, clabe, beneficiario')
        .order('nombre_comercial', { ascending: true });
      if (error) throw error;
      setProveedores(data ?? []);
    } catch (err) {
      console.error('Error fetch proveedores:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los proveedores.' });
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const resetForm = () => {
    setForm({
      id: null,
      nombre_comercial: '',
      razon_social: '',
      rfc: '',
      contacto: '',
      telefono: '',
      email: '',
      banco: '',
      clabe: '',
      beneficiario: ''
    });
    setUsarRazonSocial(false);
  };

  const handleOpenModal = () => {
    resetForm();
    setModalMode('create');
    setModalOpen(true);
  };

  const handleView = (p) => {
    setForm({
      id: p.id,
      nombre_comercial: p.nombre_comercial ?? '',
      razon_social: p.razon_social ?? '',
      rfc: p.rfc ?? '',
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      banco: p.banco ?? '',
      clabe: p.clabe ?? '',
      beneficiario: p.beneficiario ?? ''
    });
    setUsarRazonSocial(false);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleEdit = (p) => {
    setForm({
      id: p.id,
      nombre_comercial: p.nombre_comercial ?? '',
      razon_social: p.razon_social ?? '',
      rfc: p.rfc ?? '',
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      banco: p.banco ?? '',
      clabe: p.clabe ?? '',
      beneficiario: p.beneficiario ?? ''
    });
    setUsarRazonSocial(false);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar el proveedor "${p.nombre_comercial ?? ''}"? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('proveedores').delete().eq('id', p.id);
      if (error) throw error;
      toast({ title: 'Proveedor eliminado', description: 'El registro fue eliminado.' });
      fetchProveedores();
    } catch (err) {
      console.error('Error eliminar proveedor:', err);
      const msg = err?.message ?? '';
      const isFk = /foreign key|violates foreign key|ordenes_compra|orden_compra/i.test(msg);
      if (isFk) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'No se puede eliminar este proveedor porque tiene Órdenes de Compra asociadas. Cambie su estatus a Inactivo.'
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo eliminar el proveedor.' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre_comercial?.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre comercial es obligatorio.' });
      return;
    }
    const payload = {
      nombre_comercial: form.nombre_comercial.trim(),
      razon_social: form.razon_social.trim() || null,
      rfc: form.rfc.trim() || null,
      contacto: form.contacto.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      banco: form.banco.trim() || null,
      clabe: form.clabe.trim() || null,
      beneficiario: form.beneficiario.trim() || null
    };
    setSaving(true);
    try {
      if (modalMode === 'edit' && form.id) {
        const { error } = await supabase.from('proveedores').update(payload).eq('id', form.id);
        if (error) throw error;
        toast({ title: 'Proveedor actualizado', description: 'Los datos se guardaron correctamente.' });
      } else {
        const { error } = await supabase.from('proveedores').insert(payload);
        if (error) throw error;
        toast({ title: 'Proveedor creado', description: 'El proveedor se ha registrado correctamente.' });
      }
      setModalOpen(false);
      resetForm();
      fetchProveedores();
    } catch (err) {
      console.error('Error guardar proveedor:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo guardar el proveedor.' });
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = modalMode === 'view';
  const handleRazonSocialChange = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, razon_social: v }));
    if (usarRazonSocial) setForm((f) => ({ ...f, beneficiario: v }));
  };
  const handleUsarRazonSocialChange = (checked) => {
    setUsarRazonSocial(!!checked);
    if (checked) setForm((f) => ({ ...f, beneficiario: f.razon_social ?? '' }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <p className="text-sm md:text-base text-gray-600">Listado de proveedores para órdenes de compra.</p>
        <Button onClick={handleOpenModal} className="gap-1.5 h-8 px-3 text-xs md:h-10 md:px-4 md:text-sm bg-blue-600 hover:bg-blue-700 shrink-0">
          <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Nuevo Proveedor
        </Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre Comercial</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">RFC</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proveedores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-12">
                      No hay proveedores registrados. Agrega uno con «Nuevo Proveedor».
                    </td>
                  </tr>
                ) : (
                  proveedores.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.nombre_comercial ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{p.rfc ?? '—'}</td>
                      <td className="px-4 py-3">{p.telefono ?? '—'}</td>
                      <td className="px-4 py-3">{p.email ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 md:gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-blue-600" onClick={() => handleView(p)} title="Ver">
                            <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-amber-600" onClick={() => handleEdit(p)} title="Editar">
                            <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-red-600" onClick={() => handleDelete(p)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'view' ? 'Ver Proveedor' : modalMode === 'edit' ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="nombre_comercial">Nombre Comercial *</Label>
                <Input
                  id="nombre_comercial"
                  value={form.nombre_comercial}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_comercial: e.target.value }))}
                  placeholder="Ej. Ferretería López"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="razon_social">Razón Social</Label>
                <Input
                  id="razon_social"
                  value={form.razon_social}
                  onChange={handleRazonSocialChange}
                  placeholder="Ej. López y Asociados S.A. de C.V."
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  value={form.rfc}
                  onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value }))}
                  placeholder="Ej. XXX010101XXX"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="contacto">Contacto (Vendedor)</Label>
                <Input
                  id="contacto"
                  value={form.contacto}
                  onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                  placeholder="Nombre del vendedor o contacto"
                  readOnly={isReadOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={form.telefono}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    placeholder="Ej. 555 123 4567"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contacto@proveedor.com"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Banco</Label>
                  <Select value={form.banco || ''} onValueChange={(v) => setForm((f) => ({ ...f, banco: v }))} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder="Selecciona banco..." /></SelectTrigger>
                    <SelectContent>
                      {BANCOS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="clabe">Cuenta / CLABE</Label>
                  <Input
                    id="clabe"
                    value={form.clabe}
                    onChange={(e) => setForm((f) => ({ ...f, clabe: e.target.value }))}
                    placeholder="CLABE interbancaria"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    id="usar_razon_social"
                    checked={usarRazonSocial}
                    onCheckedChange={handleUsarRazonSocialChange}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="usar_razon_social" className="font-normal cursor-pointer">Usar Razón Social</Label>
                </div>
                <Label htmlFor="beneficiario">Beneficiario</Label>
                <Input
                  id="beneficiario"
                  value={form.beneficiario}
                  onChange={(e) => setForm((f) => ({ ...f, beneficiario: e.target.value }))}
                  placeholder="Nombre del beneficiario para pagos"
                  readOnly={isReadOnly || usarRazonSocial}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                {isReadOnly ? 'Cerrar' : 'Cancelar'}
              </Button>
              {!isReadOnly && (
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProveedoresTab;
