import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Upload, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RegistrarPagoDialog = ({ open, onOpenChange, proyectoId, onSave }) => {
    const { toast } = useToast();
    const [monto, setMonto] = useState('');
    const [fechaPago, setFechaPago] = useState(null);
    const [metodoPago, setMetodoPago] = useState('');
    const [comentarios, setComentarios] = useState('');
    const [cfdiFile, setCfdiFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setCfdiFile(e.target.files[0]);
        }
    };

    const sanitizeFilename = (filename) => {
        return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    };

    const handleSave = async () => {
        if (!monto || !fechaPago || !metodoPago) {
            toast({ variant: 'destructive', title: 'Error', description: 'Monto, fecha y método de pago son requeridos.' });
            return;
        }
        setIsSaving(true);
        
        let cfdiUrl = null;
        try {
            if (cfdiFile) {
                const sanitizedFilename = sanitizeFilename(cfdiFile.name);
                const filePath = `pagos/${proyectoId}/${Date.now()}_${sanitizedFilename}`;
                const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, cfdiFile);
                if (uploadError) throw new Error(`Error al subir el CFDI: ${uploadError.message}`);
                cfdiUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
            }

            const { error: dbError } = await supabase.from('proyecto_pagos').insert({
                proyecto_id: proyectoId,
                monto: parseFloat(monto),
                fecha_pago: format(fechaPago, 'yyyy-MM-dd'),
                metodo_pago: metodoPago,
                comentarios: comentarios,
                url_cfdi: cfdiUrl,
            });

            if (dbError) throw new Error(`Error en la base de datos: ${dbError.message}`);

            toast({ title: '✅ Pago Registrado' });
            onSave();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Guardar Pago', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Registrar Pago del Proyecto</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="monto">Monto *</Label>
                            <Input id="monto" type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej. 5000.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha de Pago *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !fechaPago && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {fechaPago ? format(fechaPago, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fechaPago} onSelect={setFechaPago} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Método de Pago *</Label>
                        <Select value={metodoPago} onValueChange={setMetodoPago}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un método..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Transferencia">Transferencia</SelectItem>
                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                <SelectItem value="Tarjeta de Crédito/Débito">Tarjeta de Crédito/Débito</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="comentarios-pago">Comentarios (Opcional)</Label>
                        <textarea id="comentarios-pago" value={comentarios} onChange={e => setComentarios(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" rows={2} placeholder="Ej. Anticipo 50%..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Adjuntar CFDI (Opcional)</Label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="space-y-1 text-center">
                                {cfdiFile ? (<><FileText className="mx-auto h-12 w-12 text-gray-400" /><p className="font-semibold text-blue-600">{cfdiFile.name}</p></>) : (<><Upload className="mx-auto h-12 w-12 text-gray-400" /><p className="pl-1">Sube un archivo (XML, PDF)</p></>)}
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileChange} accept=".xml,.pdf" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Guardar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RegistrarPagoDialog;