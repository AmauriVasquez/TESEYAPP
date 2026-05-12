import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Cuboid, ToyBrick, Building2, Wrench } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/components/ui/use-toast";
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';

const ESTRUCTURA_CATALOGO = {
  Materiales: [
    { nombre: 'Láminas', prefijo: 'MAT-LAM' },
    { nombre: 'Tubería y Conexiones', prefijo: 'MAT-TUB' },
    { nombre: 'Aceros y Perfiles', prefijo: 'MAT-ACE' },
    { nombre: 'Tornillería y Sujeción', prefijo: 'MAT-TOR' },
    { nombre: 'Herrajes y Accesorios', prefijo: 'MAT-HER' },
    { nombre: 'Eléctrico y Control', prefijo: 'MAT-ELE' },
    { nombre: 'Maderas y Carpintería', prefijo: 'MAT-MAD' },
  ],
  Consumibles: [
    { nombre: 'Abrasivos', prefijo: 'CON-ABR' },
    { nombre: 'Herramienta de Corte', prefijo: 'CON-COR' },
    { nombre: 'Soldadura y Aportes', prefijo: 'CON-SOL' },
    { nombre: 'Gases Industriales', prefijo: 'CON-GAS' },
    { nombre: 'Consumibles Láser', prefijo: 'CON-LAS' },
    { nombre: 'Refacciones de Herramienta', prefijo: 'CON-REF' },
    { nombre: 'Pinturas y Químicos', prefijo: 'CON-PIN' },
    { nombre: 'Lubricantes y Fluidos', prefijo: 'CON-LUB' },
    { nombre: 'Empaque y Embalaje', prefijo: 'CON-EMP' },
    { nombre: 'EPP y Seguridad', prefijo: 'CON-EPP' },
    { nombre: 'Herramienta General', prefijo: 'CON-HRA' },
  ],
  Activos: [],
  Edificio: [
    { nombre: 'Limpieza', prefijo: 'EDI-LIM' },
    { nombre: 'Mantenimiento de Nave', prefijo: 'EDI-MTO' },
    { nombre: 'Papelería e Impresión', prefijo: 'EDI-PAP' },
  ],
  Servicios: [
    { nombre: 'Servicios Básicos', prefijo: 'SER-BAS' },
    { nombre: 'Servicios Profesionales', prefijo: 'SER-PRO' },
    { nombre: 'Logística y Operación', prefijo: 'SER-LOG' },
    { nombre: 'Mantenimiento', prefijo: 'SER-MNT' },
  ],
};

const MaterialDialog = ({ open, onOpenChange, onSave, material }) => {
  const { toast } = useToast();
  const isEditing = !!material?.id;
  const materialTieneClave = isEditing && material && (material.clave != null && String(material.clave).trim() !== '');

  const getInitialFormData = () => ({
    categoria: 'Materiales',
    clave: '',
    familia: '',
    descripcion: '',
    unidad_compra: '',
    costo_compra: 0,
    unidad_uso: '',
    factor_conversion: 1,
    costo_unitario: 0,
    peso_teorico: 0,
    es_acero: false,
    existencias: 0,
    stock_min: 0,
    stock_max: 0,
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [claveLoading, setClaveLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (material && material.id) {
        setFormData(() => ({
          ...getInitialFormData(),
          ...material,
          categoria: material.categoria || 'Materiales',
          familia: material.familia ?? '',
          clave: material.clave ?? '',
          descripcion: material.descripcion ?? '',
          unidad_compra: material.unidad_compra ?? '',
          costo_compra: material.costo_compra ?? 0,
          unidad_uso: material.unidad_uso ?? '',
          factor_conversion: material.factor_conversion ?? 1,
          costo_unitario: material.costo_unitario ?? 0,
          peso_teorico: material.peso_teorico ?? 0,
          es_acero: Boolean(material.es_acero),
          existencias: material.existencias ?? 0,
          stock_min: material.stock_min ?? 0,
          stock_max: material.stock_max ?? 0,
        }));
      } else {
        setFormData(getInitialFormData());
      }
    }
  }, [material, open]);

  // Motor de autogeneración: solo cuando clave está vacía y categoria + familia tienen valor (nuevo o migración)
  useEffect(() => {
    if (!open) return;
    const claveActual = formData.clave != null ? String(formData.clave).trim() : '';
    if (claveActual !== '') return;

    const categoria = formData.categoria;
    const familia = formData.familia;
    if (!categoria || !familia) {
      setFormData((prev) => (prev.clave ? { ...prev, clave: '' } : prev));
      return;
    }
    const familias = ESTRUCTURA_CATALOGO[categoria] || [];
    const config = familias.find((f) => f.nombre === familia);
    const prefijo = config?.prefijo;
    if (!prefijo) return;

    let cancelled = false;
    setClaveLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('materiales')
          .select('clave')
          .ilike('clave', `${prefijo}-%`)
          .order('clave', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (error) throw error;
        let numero = 1;
        if (data && data.length > 0 && data[0].clave) {
          const ultimaClave = String(data[0].clave);
          const ultimosTres = ultimaClave.slice(-3);
          const n = parseInt(ultimosTres, 10);
          numero = (Number.isNaN(n) ? 0 : n) + 1;
        }
        const nuevoNumero = String(numero).padStart(3, '0');
        setFormData((prev) => ({ ...prev, clave: `${prefijo}-${nuevoNumero}` }));
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setFormData((prev) => ({ ...prev, clave: `${prefijo}-001` }));
        }
      } finally {
        if (!cancelled) setClaveLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, formData.categoria, formData.familia, formData.clave]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCategoryChange = (value) => {
    setFormData((prev) => ({ ...prev, categoria: value, familia: '', clave: '' }));
  };

  const handleFamiliaChange = (e) => {
    setFormData((prev) => ({ ...prev, familia: e.target.value }));
  };

  const costoUnitarioCalculado = useMemo(() => {
    const costoCompra = Number(formData.costo_compra) || 0;
    const factor = Number(formData.factor_conversion) || 0;
    if (!factor) return 0;
    const valor = costoCompra / factor;
    return Number.isFinite(valor) ? valor : 0;
  }, [formData.costo_compra, formData.factor_conversion]);

  const handleEsAceroChange = (checked) => {
    setFormData((prev) => ({ ...prev, es_acero: !!checked }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const familia = (formData.familia ?? '').trim();
    const descripcion = (formData.descripcion ?? '').trim();
    const unidadCompra = (formData.unidad_compra ?? '').trim();
    const unidadUso = (formData.unidad_uso ?? '').trim();
    const costoCompra = Number(formData.costo_compra) || 0;
    const factor = Number(formData.factor_conversion) || 0;

    if (!familia) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una familia.' });
      return;
    }
    if (!descripcion) {
      toast({ variant: 'destructive', title: 'Error', description: 'La descripción es requerida.' });
      return;
    }
    if (!unidadCompra) {
      toast({ variant: 'destructive', title: 'Error', description: 'La unidad de compra es requerida.' });
      return;
    }
    if (!unidadUso) {
      toast({ variant: 'destructive', title: 'Error', description: 'La unidad de uso es requerida.' });
      return;
    }
    if (Number.isNaN(costoCompra) || costoCompra < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'El costo de compra debe ser >= 0.' });
      return;
    }

    const costoUnitario = costoUnitarioCalculado;
    onSave({
      ...formData,
      familia,
      descripcion,
      unidad_compra: unidadCompra,
      costo_compra: costoCompra,
      unidad_uso: unidadUso,
      factor_conversion: factor,
      costo_unitario: costoUnitario,
      es_acero: Boolean(formData.es_acero),
      peso_teorico: Number(formData.peso_teorico) || 0,
      existencias: Number(formData.existencias) || 0,
      stock_min: Number(formData.stock_min) || 0,
      stock_max: Number(formData.stock_max) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar Material: ${material.id}` : 'Nuevo Material'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
          
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Datos Generales</h3>
            <Tabs value={formData.categoria} onValueChange={handleCategoryChange} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="Materiales" className="gap-2" disabled={materialTieneClave}><Package className="w-4 h-4"/>Materiales</TabsTrigger>
                <TabsTrigger value="Consumibles" className="gap-2" disabled={materialTieneClave}><ToyBrick className="w-4 h-4" />Consumibles</TabsTrigger>
                <TabsTrigger value="Activos" className="gap-2" disabled={materialTieneClave}><Cuboid className="w-4 h-4"/>Activos</TabsTrigger>
                <TabsTrigger value="Edificio" className="gap-2" disabled={materialTieneClave}><Building2 className="w-4 h-4"/>Edificio</TabsTrigger>
                <TabsTrigger value="Servicios" className="gap-2" disabled={materialTieneClave}><Wrench className="w-4 h-4"/>Servicios</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="familia">Familia *</Label>
                <select
                  id="familia"
                  value={formData.familia}
                  onChange={handleFamiliaChange}
                  disabled={materialTieneClave}
                  className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1',
                    materialTieneClave && 'bg-gray-100 cursor-not-allowed opacity-80'
                  )}
                  required
                >
                  <option value="">Seleccione familia</option>
                  {(ESTRUCTURA_CATALOGO[formData.categoria] || []).map((f) => (
                    <option key={f.prefijo} value={f.nombre}>{f.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="clave">Clave del Sistema</Label>
                <Input
                  id="clave"
                  readOnly
                  value={claveLoading ? 'Generando...' : (formData.clave || '')}
                  className="mt-1 bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Input
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Ej. Placa de Acero 1/4"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" /> Costeo y Conversión *
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unidad_compra">Unidad de Compra</Label>
                <Input
                  id="unidad_compra"
                  name="unidad_compra"
                  value={formData.unidad_compra}
                  onChange={handleChange}
                  placeholder='Ej. "Placa 4x10", "Tramo 6m"'
                  required
                />
              </div>

              <div>
                <Label htmlFor="costo_compra">Costo de Compra ($)</Label>
                <Input
                  id="costo_compra"
                  name="costo_compra"
                  type="number"
                  value={formData.costo_compra}
                  onChange={handleChange}
                  step="any"
                  min="0"
                  required
                />
              </div>

              <div>
                <Label htmlFor="unidad_uso">Unidad de Uso</Label>
                <Input
                  id="unidad_uso"
                  name="unidad_uso"
                  value={formData.unidad_uso}
                  onChange={handleChange}
                  placeholder='Ej. "M2", "ML", "KG", "PZA"'
                  required
                />
              </div>

              <div>
                <Label htmlFor="factor_conversion">Factor de Conversión</Label>
                <Input
                  id="factor_conversion"
                  name="factor_conversion"
                  type="number"
                  value={formData.factor_conversion}
                  onChange={handleChange}
                  step="any"
                  min="0"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <Label htmlFor="costo_unitario">Costo Unitario (solo lectura)</Label>
                    <Input
                      id="costo_unitario"
                      readOnly
                      value={costoUnitarioCalculado ? costoUnitarioCalculado.toFixed(4) : '0'}
                      className="mt-1 bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-1 text-xs text-gray-500">
                    = Costo de compra / Factor
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Propiedades Físicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
                <div className="space-y-1">
                  <Label htmlFor="es_acero">Es Acero</Label>
                  <p className="text-xs text-gray-500">
                    Si se marca, su peso sumará al volumen del proyecto.
                  </p>
                </div>
                <Switch id="es_acero" checked={!!formData.es_acero} onCheckedChange={handleEsAceroChange} />
              </div>

              <div>
                <Label htmlFor="peso_teorico">Peso Teórico (kg)</Label>
                <Input
                  id="peso_teorico"
                  name="peso_teorico"
                  type="number"
                  value={formData.peso_teorico}
                  onChange={handleChange}
                  step="any"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
             <h3 className="text-sm font-semibold text-gray-800 mb-4">Control de Stock</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="existencias">Existencias Iniciales</Label>
                    <Input
                      id="existencias"
                      name="existencias"
                      type="number"
                      value={formData.existencias}
                      onChange={handleChange}
                      disabled={isEditing}
                    />
                </div>
                <div>
                    <Label htmlFor="stock_min">Stock Mínimo</Label>
                    <Input id="stock_min" name="stock_min" type="number" value={formData.stock_min} onChange={handleChange} min="0" step="any" />
                </div>
                <div>
                    <Label htmlFor="stock_max">Stock Máximo</Label>
                    <Input id="stock_max" name="stock_max" type="number" value={formData.stock_max} onChange={handleChange} min="0" step="any" />
                </div>
             </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Guardar Material</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDialog;