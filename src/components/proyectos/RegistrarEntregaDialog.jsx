import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { notifyProjectFinishedOrDelivered } from '@/services/TelegramService';
import { Loader2, Upload, FileText, Eraser } from 'lucide-react';

const RegistrarEntregaDialog = ({ open, onOpenChange, proyecto, onSave }) => {
    const { toast } = useToast();
    const [recibidoPor, setRecibidoPor] = useState('');
    const [comentarios, setComentarios] = useState('');
    const [evidencia, setEvidencia] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const sigCanvasRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setEvidencia(e.target.files[0]);
        }
    };
    
    const sanitizeFilename = (filename) => {
        return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    };
    
    const clearSignature = () => sigCanvasRef.current.clear();

    const handleSave = async () => {
        if (!recibidoPor.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes indicar quién recibe la mercancía.' });
            return;
        }
        if (sigCanvasRef.current.isEmpty()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Se requiere la firma de recibido.' });
            return;
        }
        
        setIsSaving(true);
        let evidenciaUrl = null;
        let firmaUrl = null;

        try {
            // 1. Upload signature
            const signatureImage = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
            const signatureBlob = await (await fetch(signatureImage)).blob();
            const firmaPath = `entregas/${proyecto.id}/firma_${Date.now()}.png`;
            const { error: firmaError } = await supabase.storage.from('proyecto_archivos').upload(firmaPath, signatureBlob, { contentType: 'image/png' });
            if (firmaError) throw new Error(`Error al subir la firma: ${firmaError.message}`);
            firmaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(firmaPath).data.publicUrl;

            // 2. Upload evidence if exists
            if (evidencia) {
                const sanitizedFilename = sanitizeFilename(evidencia.name);
                const evidenciaPath = `entregas/${proyecto.id}/evidencia_${Date.now()}_${sanitizedFilename}`;
                const { error: evidenciaError } = await supabase.storage.from('proyecto_archivos').upload(evidenciaPath, evidencia);
                if (evidenciaError) throw new Error(`Error al subir la evidencia: ${evidenciaError.message}`);
                evidenciaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(evidenciaPath).data.publicUrl;
            }

            // 3. Save record to database
            const { error: dbError } = await supabase.from('proyecto_entregas').insert({
                proyecto_id: proyecto.id,
                recibido_por: recibidoPor,
                comentarios,
                url_evidencia: evidenciaUrl,
                url_firma: firmaUrl,
            });
            if (dbError) throw new Error(`Error en la base de datos: ${dbError.message}`);
            
            // 4. Update project status
            const { error: projectError } = await supabase.from('proyectos').update({ estatus: 'Entregado' }).eq('id', proyecto.id);
            if (projectError) throw new Error(`Error al actualizar el proyecto: ${projectError.message}`);

            notifyProjectFinishedOrDelivered({
              folio: proyecto.folio || 'Sin folio',
              cliente_nombre: proyecto.cliente ?? proyecto.cliente_nombre_externo ?? 'Sin cliente',
              estatus: 'Entregado',
            });

            toast({ title: '✅ Entrega Registrada', description: 'El proyecto ha sido marcado como Entregado.' });
            onSave();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Registrar Entrega', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Registrar Entrega de Mercancía</DialogTitle>
                </DialogHeader>
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="recibidoPor">Nombre de quien recibe *</Label>
                            <Input id="recibidoPor" value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)} placeholder="Ej. Juan Pérez" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="comentarios-entrega">Comentarios (Opcional)</Label>
                            <textarea id="comentarios-entrega" value={comentarios} onChange={(e) => setComentarios(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Ej. Se entregó completo." />
                        </div>
                        <div className="space-y-2">
                             <Label>Evidencia de Entrega (Opcional)</Label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="space-y-1 text-center">
                                    {evidencia ? (<><FileText className="mx-auto h-12 w-12 text-gray-400" /><p className="font-semibold text-blue-600">{evidencia.name}</p></>) : (<><Upload className="mx-auto h-12 w-12 text-gray-400" /><p className="pl-1">Sube una foto o documento</p></>)}
                                </div>
                            </div>
                            <input ref={fileInputRef} id="evidencia-upload" type="file" className="sr-only" onChange={handleFileChange} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Firma de Recibido *</Label>
                        <div className="relative border border-gray-300 rounded-lg">
                           <SignatureCanvas ref={sigCanvasRef} penColor='black' canvasProps={{ className: 'w-full h-64 rounded-lg' }} />
                           <Button variant="ghost" size="icon" className="absolute top-1 right-1" onClick={clearSignature}><Eraser className="w-4 h-4" /></Button>
                        </div>
                        <p className="text-xs text-gray-500">Pide al cliente que firme en el recuadro.</p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Confirmar Entrega
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RegistrarEntregaDialog;