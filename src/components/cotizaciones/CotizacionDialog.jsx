
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Pencil, ShoppingCart, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CalculadoraCostosPartida from '@/components/cotizaciones/CalculadoraCostosPartida';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { BRANDINGS, DEFAULT_BRANDING_ID } from '@/lib/brandingConfig';
// PDF y subida a Drive pausados temporalmente (reactivar cuando se corrija el servicio)
// import jsPDF from 'jspdf';
// import { uploadQuotePdfToDrive } from '@/services/driveUploadService';

const CotizacionDialog = ({ open, onOpenChange, cotizacion, initialTemplate, onSave }) => {
  const { toast } = useToast();
  
  // Global Form State
  const [formData, setFormData] = useState(null);
  const [items, setItems] = useState([]);
  
  // Catalogs
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [unidadesCatalogo, setUnidadesCatalogo] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [nextFolio, setNextFolio] = useState('');
  const [calculadoraAbierta, setCalculadoraAbierta] = useState(false);

  // Item Input State
  const [newItem, setNewItem] = useState({
    descripcion: '',
    cantidad: '',
    precio_unitario: '',
    unidad: 'pza',
    observaciones: ''
  });
  
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const initialFormState = {
    cliente_id: null,
    cliente_nombre_externo: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estatus: 'Borrador',
    cotizacion_control: '',
    aplica_iva: true,
    usuario_cotizacion: '',
    descuento_porcentaje: 0,
    descuento_monto: 0,
    branding: DEFAULT_BRANDING_ID,
  };

  /** Genera el siguiente folio COT-YYYY-NNNN ignorando versiones (-V2, etc.): usa el máximo numérico del año. */
  const generateFolio = useCallback(async () => {
    const year = new Date().getFullYear();
    const { data, error: fetchError } = await supabase
      .from('cotizaciones')
      .select('folio')
      .ilike('folio', `COT-${year}-%`);

    if (fetchError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
      return 'Error';
    }

    let maxFolioNum = 0;
    if (data && data.length > 0) {
      const regex = new RegExp(`COT-${year}-(\\d+)`);
      data.forEach((item) => {
        const match = (item.folio || '').match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxFolioNum) maxFolioNum = num;
        }
      });
    }

    const siguienteNum = maxFolioNum + 1;
    return `COT-${year}-${String(siguienteNum).padStart(4, '0')}`;
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [clientesRes, usuariosRes, serviciosRes, unitsRes] = await Promise.all([
            supabase.from('clientes').select('id, nombre'),
            supabase.from('usuarios').select('id, nombre_completo'),
            supabase.from('catalogo_servicios').select('*').order('descripcion'),
            supabase.from('catalogo_unidades').select('*').order('nombre')
        ]);

        if (clientesRes.error) throw clientesRes.error;
        setClientes(clientesRes.data);

        if (usuariosRes.error) throw usuariosRes.error;
        setUsuarios(usuariosRes.data);
        
        if (serviciosRes.error) {
            console.error("Error fetching services:", serviciosRes.error);
        } else {
            setServiciosCatalogo(serviciosRes.data || []);
        }

        if (unitsRes.error) {
            console.error("Error fetching units:", unitsRes.error);
        } else {
            setUnidadesCatalogo(unitsRes.data || []);
        }

        // If creating new (o duplicar como plantilla)
        if (!cotizacion) {
            const folio = await generateFolio();
            setNextFolio(folio);
            if (initialTemplate) {
                const { data: itemsData, error: itemsError } = await supabase
                    .from('cotizaciones_items')
                    .select('*')
                    .eq('cotizacion_id', initialTemplate.id);
                if (itemsError) throw itemsError;
                setFormData({
                    ...initialFormState,
                    cliente_id: initialTemplate.cliente_id ?? null,
                    cliente_nombre_externo: initialTemplate.cliente_nombre_externo ?? '',
                    descripcion: initialTemplate.descripcion ?? '',
                    fecha: new Date().toISOString().split('T')[0],
                    aplica_iva: initialTemplate.aplica_iva !== false,
                    cotizacion_control: initialTemplate.cotizacion_control ?? '',
                    usuario_cotizacion: initialTemplate.usuario_cotizacion ?? '',
                    descuento_porcentaje: initialTemplate.descuento_porcentaje ?? 0,
                    descuento_monto: initialTemplate.descuento_monto ?? 0,
                    branding: initialTemplate.branding || DEFAULT_BRANDING_ID,
                });
                setItems(itemsData || []);
            } else {
                setFormData({ ...initialFormState });
                setItems([]);
            }
        } else {
            // If editing, fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from('cotizaciones_items')
                .select('*')
                .eq('cotizacion_id', cotizacion.id);

            if (itemsError) throw itemsError;
            
            setItems(itemsData || []);
            setFormData({
                ...initialFormState,
                ...cotizacion,
                aplica_iva: cotizacion.aplica_iva !== false,
                branding: cotizacion.branding || DEFAULT_BRANDING_ID,
            });
        }

    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar datos iniciales.' });
    } finally {
        setLoading(false);
    }
  }, [toast, cotizacion, initialTemplate, generateFolio]);
  
  useEffect(() => {
    if(open) {
        fetchData();
    } else {
        setFormData(null);
        setNextFolio('');
        setItems([]);
        setNewItem({ descripcion: '', cantidad: '', precio_unitario: '', unidad: 'pza', observaciones: '' });
        setSelectedServiceId('');
    }
  }, [open, fetchData]);

  // Calculations
  const { subtotalBruto, descuentoMonto, subtotalNeto, iva, total } = useMemo(() => {
    const subBruto = items.reduce((acc, item) => acc + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_unitario || 0)), 0);
    const descuentoPct = Math.max(0, parseFloat(formData?.descuento_porcentaje || 0));
    const descuento = subBruto * (descuentoPct / 100);
    const subNeto = Math.max(0, subBruto - descuento);
    const ivaAmount = formData?.aplica_iva ? subNeto * 0.16 : 0;
    return {
        subtotalBruto: subBruto,
        descuentoMonto: descuento,
        subtotalNeto: subNeto,
        iva: ivaAmount,
        total: subNeto + ivaAmount
    };
  }, [items, formData?.aplica_iva, formData?.descuento_porcentaje]);

  // Handlers
  const handleAddItem = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precio_unitario) {
        toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor ingresa descripción, cantidad y precio.' });
        return;
    }
    
    setItems(prev => [...prev, { ...newItem, id: Date.now() }]); // Temporary ID for UI key
    setNewItem({ descripcion: '', cantidad: '', precio_unitario: '', unidad: 'pza', observaciones: '' });
    setSelectedServiceId('');
  };

  const handleRemoveItem = (indexToRemove) => {
    setItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEditItem = (indexToEdit) => {
    const item = items[indexToEdit];
    if (!item) return;
    setNewItem({
      descripcion: item.descripcion ?? '',
      cantidad: String(item.cantidad ?? ''),
      precio_unitario: String(item.precio_unitario ?? ''),
      unidad: item.unidad ?? 'pza',
      observaciones: item.observaciones ?? '',
    });
    setItems(prev => prev.filter((_, i) => i !== indexToEdit));
    setSelectedServiceId('');
  };

  const handleServiceSelect = (serviceId) => {
      setSelectedServiceId(serviceId);
      const service = serviciosCatalogo.find(s => s.id.toString() === serviceId.toString());
      if (service) {
          setNewItem(prev => ({
              ...prev,
              descripcion: service.descripcion,
              precio_unitario: service.precio_unitario,
              unidad: service.unidad,
              // Keep existing quantity or default to 1 if empty
              cantidad: prev.cantidad || '1'
          }));
      }
  };
  
  // When description is manually changed, clear selection if it doesn't match
  const handleDescriptionChange = (val) => {
      setNewItem(prev => ({ ...prev, descripcion: val }));
      // Optional: Check if new val matches selected service, if not clear selected ID
      // We'll just clear it to indicate "Custom" mode
      if (selectedServiceId) {
          const currentService = serviciosCatalogo.find(s => s.id.toString() === selectedServiceId.toString());
          if (currentService && currentService.descripcion !== val) {
              setSelectedServiceId('');
          }
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (!formData.descripcion) {
      toast({ title: 'Error', description: 'La descripción general es requerida.', variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    if (items.length === 0) {
        toast({ title: 'Error', description: 'Debes agregar al menos una partida.', variant: 'destructive' });
        setIsSaving(false);
        return;
    }

    const quoteData = {
        cliente_id: formData.cliente_id,
        cliente_nombre_externo: formData.cliente_nombre_externo,
        descripcion: formData.descripcion,
        fecha: formData.fecha,
        total: total,
        aplica_iva: formData.aplica_iva !== false,
        estatus: formData.estatus,
        cotizacion_control: formData.cotizacion_control,
        usuario_cotizacion: formData.usuario_cotizacion,
        descuento_porcentaje: Math.max(0, parseFloat(formData.descuento_porcentaje || 0)),
        descuento_monto: descuentoMonto,
        branding: formData.branding || DEFAULT_BRANDING_ID,
    };

    try {
        let cotizacionId;

        if (cotizacion) { // Update
            cotizacionId = cotizacion.id;
            const { error: quoteError } = await supabase
                .from('cotizaciones')
                .update(quoteData)
                .eq('id', cotizacionId);

            if (quoteError) throw quoteError;

            // Delete old items to replace with new ones (simplest sync strategy)
            const { error: deleteError } = await supabase
                .from('cotizaciones_items')
                .delete()
                .eq('cotizacion_id', cotizacionId);
            
            if (deleteError) throw deleteError;

        } else { // Create
            quoteData.folio = nextFolio;
            const { data: newQuote, error: quoteError } = await supabase
                .from('cotizaciones')
                .insert(quoteData)
                .select()
                .single();
            
            if (quoteError) throw quoteError;
            cotizacionId = newQuote.id;
        }

        // Insert Items
        const itemsToInsert = items.map(item => ({
            cotizacion_id: cotizacionId,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad),
            precio_unitario: parseFloat(item.precio_unitario),
            unidad: item.unidad,
            observaciones: item.observaciones
        }));

        const { error: itemsError } = await supabase
            .from('cotizaciones_items')
            .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        const folio = cotizacion ? cotizacion.folio : nextFolio;
        toast({ title: cotizacion ? '✅ Cotización actualizada' : '✅ Cotización creada' });
        onSave();
        onOpenChange(false);

        // --- PDF y subida a G Drive PAUSADOS (reactivar cuando se corrija el servicio) ---
        // (async () => {
        //   try {
        //     console.log('Generando Blob del PDF...');
        //     const doc = new jsPDF();
        //     doc.setFontSize(14);
        //     doc.text(`Cotización ${folio}`, 20, 20);
        //     doc.setFontSize(10);
        //     doc.text(formData.descripcion || 'Sin descripción', 20, 30);
        //     doc.text(`Total: $${total.toFixed(2)}`, 20, 40);
        //     const pdfBlob = doc.output('blob');
        //     console.log('Blob generado, tamaño:', pdfBlob.size);
        //     const result = await uploadQuotePdfToDrive(pdfBlob, `${folio}.pdf`, toast);
        //     if (result?.success) {
        //       toast({ title: '📁 PDF subido a Drive', description: 'El archivo se guardó en la carpeta Cotizaciones.' });
        //     }
        //   } catch (err) {
        //     console.error('Error generando/subiendo PDF a Drive:', err);
        //   }
        // })();

    } catch (error) {
        console.error('Error saving quote:', error);
        toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  if (!formData) return null;

  const usuariosOptions = usuarios.map(u => ({ value: u.nombre_completo, label: u.nombre_completo }));

  const clientesOptions = [
  { value: 'externo', label: '-- Cliente Externo --' },
  ...clientes.map(c => ({ value: `id:${c.id}`, label: c.nombre }))
    ];  


  // Enhanced label with Code
  const serviciosOptions = serviciosCatalogo.map(s => ({ 
      value: s.id.toString(), 
      label: s.codigo ? `${s.codigo} - ${s.descripcion}` : s.descripcion 
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {cotizacion ? `Editar Cotización ${cotizacion.folio}` : (initialTemplate ? 'Nueva Cotización (desde plantilla)' : 'Nueva Cotización')}
          </DialogTitle>
        </DialogHeader>

        {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-grow overflow-y-auto pr-2 space-y-6 py-2">
                {/* Section 1: General Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                    <div>
                        <Label htmlFor="folio">Folio</Label>
                        <Input id="folio" value={cotizacion ? cotizacion.folio : nextFolio} readOnly className="bg-gray-100" />
                    </div>
                    <div>
                        <Label htmlFor="fecha">Fecha</Label>
                        <DatePicker id="fecha" value={formData.fecha} onChange={(fecha) => setFormData({ ...formData, fecha })} />
                    </div>
                    <div>
                        <Label htmlFor="branding">Empresa emisora</Label>
                        <Select
                            value={formData.branding || DEFAULT_BRANDING_ID}
                            onValueChange={(value) => setFormData({ ...formData, branding: value })}
                        >
                            <SelectTrigger id="branding">
                                <SelectValue placeholder="Selecciona empresa emisora" />
                            </SelectTrigger>
                            <SelectContent>
                                {BRANDINGS.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="cliente">Cliente</Label>
                        <Combobox
                            options={clientesOptions}
                            value={formData.cliente_id ? `id:${formData.cliente_id}` : 'externo'}
                            onChange={(value) => {
                                if (value === 'externo' || !value) {
                                    setFormData({ ...formData, cliente_id: null, cliente_nombre_externo: '' });
                                } else {
                                    setFormData({ ...formData, cliente_id: parseInt(value.split(':')[1]), cliente_nombre_externo: '' });
                                }
                            }}
                            placeholder="Selecciona un cliente..."
                            searchPlaceholder="Buscar cliente..."
                            notFoundMessage="No se encontró el cliente"
                        />
                    </div>
                    <div>
                        {formData.cliente_id === null ? (
                            <>
                                <Label htmlFor="cliente_nombre_externo">Nombre Cliente Externo</Label>
                                <Input
                                value={formData.cliente_nombre_externo}
                                onChange={(e) => setFormData({ ...formData, cliente_nombre_externo: e.target.value })}
                                placeholder="Ej. Empresa S.A. de C.V."
                                />
                            </>
                        ) : <div className="h-8" />}
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="descripcion">Concepto General del Proyecto</Label>
                        <Input
                            id="descripcion"
                            value={formData.descripcion}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            placeholder="Ej. Fabricación de estructura metálica para nave industrial"
                            required
                        />
                    </div>
                    <div className="md:col-span-1">
                         <Label htmlFor="cotizacion_control">No. Control Interno</Label>
                         <Input
                             id="cotizacion_control"
                             value={formData.cotizacion_control || ''}
                             onChange={(e) => setFormData({ ...formData, cotizacion_control: e.target.value })}
                             placeholder="Opcional"
                         />
                    </div>
                     <div className="md:col-span-1">
                        <Label htmlFor="usuario_cotizacion">Vendedor / Usuario</Label>
                        <Combobox
                            options={usuariosOptions}
                            value={formData.usuario_cotizacion}
                            onChange={(value) => setFormData({ ...formData, usuario_cotizacion: value })}
                            placeholder="Seleccione usuario..."
                            searchPlaceholder="Buscar..."
                            notFoundMessage="No encontrado"
                        />
                    </div>
                </div>

                {/* Calculadora de Costos de Partida (temporal) */}
                <div className="border border-amber-200 rounded-lg bg-amber-50/50 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setCalculadoraAbierta((v) => !v)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-100/50 transition-colors"
                    >
                        <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                            <Calculator className="w-4 h-4 text-amber-600" /> Calculadora de Costos de Partida
                        </h3>
                        {calculadoraAbierta ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    </button>
                    {calculadoraAbierta && (
                        <div className="p-4 pt-0 border-t border-amber-200">
                            <CalculadoraCostosPartida />
                        </div>
                    )}
                </div>

                {/* Section 2: Items Management */}
                <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-gray-700">
                        <ShoppingCart className="w-4 h-4" /> Partidas de la Cotización
                    </h3>
                    
                    {/* New Item Form */}
                    <div className="bg-white p-3 rounded shadow-sm border space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                             <Label className="text-xs font-semibold text-blue-600">Cargar del Catálogo (Opcional)</Label>
                             <Combobox
                                options={serviciosOptions}
                                value={selectedServiceId}
                                onChange={handleServiceSelect}
                                placeholder="Buscar por código o descripción..."
                                searchPlaceholder="Buscar..."
                                notFoundMessage="No encontrado en catálogo"
                                className="w-full"
                             />
                        </div>

                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-12 md:col-span-4">
                                <Label className="text-xs">Descripción del Producto/Servicio</Label>
                                <Input 
                                    value={newItem.descripcion} 
                                    onChange={e => handleDescriptionChange(e.target.value)} 
                                    placeholder="Ej. Placa de Acero A36"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs">Cantidad</Label>
                                <Input 
                                    type="number" 
                                    value={newItem.cantidad} 
                                    onChange={e => setNewItem({...newItem, cantidad: e.target.value})}
                                    placeholder="0"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs">Unidad</Label>
                                <Select value={newItem.unidad} onValueChange={v => setNewItem({...newItem, unidad: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {unidadesCatalogo.length > 0 ? (
                                            unidadesCatalogo.map(u => (
                                                <SelectItem key={u.id} value={u.abreviatura}>{u.nombre}</SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="pza">Pieza (Default)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <Label className="text-xs">Precio Unitario</Label>
                                <Input 
                                    type="number" 
                                    value={newItem.precio_unitario} 
                                    onChange={e => setNewItem({...newItem, precio_unitario: e.target.value})}
                                    placeholder="$0.00"
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <Button onClick={handleAddItem} className="w-full bg-blue-600 hover:bg-blue-700">
                                    <Plus className="w-4 h-4 mr-1" /> Agregar
                                </Button>
                            </div>
                            <div className="col-span-12">
                                <Label className="text-xs">Observaciones (Opcional)</Label>
                                <Input 
                                    value={newItem.observaciones} 
                                    onChange={e => setNewItem({...newItem, observaciones: e.target.value})}
                                    placeholder="Detalles adicionales para esta partida..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white rounded border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead className="w-[40%]">Descripción</TableHead>
                                    <TableHead className="text-center">Cant.</TableHead>
                                    <TableHead className="text-right">P. Unit</TableHead>
                                    <TableHead className="text-right">Importe</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                            No se han agregado partidas aún.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <div className="font-medium">{item.descripcion}</div>
                                                {item.observaciones && <div className="text-xs text-gray-500 italic flex items-center gap-1 mt-1"><span className="font-semibold">Obs:</span> {item.observaciones}</div>}
                                            </TableCell>
                                            <TableCell className="text-center">{item.cantidad} {item.unidad}</TableCell>
                                            <TableCell className="text-right">${parseFloat(item.precio_unitario).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${(parseFloat(item.cantidad) * parseFloat(item.precio_unitario)).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditItem(idx)} title="Editar partida">
                                                    <Pencil className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)} title="Eliminar">
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* Footer Totals */}
            <div className="border-t pt-4 mt-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center justify-between w-full md:w-1/3">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium text-lg">{subtotalBruto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-1/3 gap-2">
                        <span className="text-gray-600">Descuento (%):</span>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.descuento_porcentaje ?? 0}
                            onChange={(e) => setFormData({ ...formData, descuento_porcentaje: e.target.value })}
                            className="h-8 w-24 text-right"
                        />
                    </div>
                    <div className="flex items-center justify-between w-full md:w-1/3">
                        <span className="text-gray-600">Subtotal Neto:</span>
                        <span className="font-medium">{subtotalNeto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-1/3">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="aplica_iva"
                                checked={formData.aplica_iva}
                                onCheckedChange={(checked) => setFormData({ ...formData, aplica_iva: checked })}
                            />
                            <Label htmlFor="aplica_iva" className="cursor-pointer">IVA (16%)</Label>
                        </div>
                        <span className="font-medium">{iva.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-1/3 border-t border-gray-300 pt-2 mt-1">
                        <span className="text-xl font-bold text-gray-800">Total:</span>
                        <span className="text-xl font-bold text-blue-700">{total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-200">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSaving || items.length === 0} className="bg-blue-600 hover:bg-blue-700 min-w-[150px]">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {isSaving ? 'Guardando...' : cotizacion ? 'Actualizar Todo' : 'Crear Cotización'}
                    </Button>
                </div>
            </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CotizacionDialog;
