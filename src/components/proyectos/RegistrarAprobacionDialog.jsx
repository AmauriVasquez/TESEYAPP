import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Upload, FileText } from 'lucide-react';

const RegistrarAprobacionDialog = ({ open, onOpenChange, proyecto, onSave, disabled = false }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [comentario, setComentario] = useState('');
    const [documento, setDocumento] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setDocumento(e.target.files[0]);
        }
    };
    
    const sanitizeFilename = (filename) => {
        return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    };

    const handleSave = async () => {
        if (disabled) return;
        if (!documento) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes adjuntar un documento de evidencia.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se ha podido identificar al usuario.' });
            return;
        }

        setIsSaving(true);

        try {
            // Verify user exists in public.usuarios table
            const { data: publicUser, error: userError } = await supabase
                .from('usuarios')
                .select('id')
                .eq('id', user.id)
                .single();

            if (userError || !publicUser) {
                throw new Error('El usuario no existe en los registros públicos. Contacte al administrador.');
            }
            
            const sanitizedFilename = sanitizeFilename(documento.name);
            const filePath = `aprobaciones/${proyecto.id}/${Date.now()}_${sanitizedFilename}`;

            const { error: uploadError } = await supabase.storage
                .from('proyecto_archivos')
                .upload(filePath, documento);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('proyecto_archivos')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase.from('proyecto_aprobaciones').insert({
                proyecto_id: proyecto.id,
                usuario_id: user.id,
                comentario: comentario,
                url_documento: publicUrl,
            });

            if (dbError) throw dbError;

            toast({ title: '✅ Aprobación Registrada' });
            onSave();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Guardar', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Aprobación del Cliente</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="comentario-aprobacion">Comentario (Opcional)</Label>
                        <textarea
                            id="comentario-aprobacion"
                            value={comentario}
                            onChange={(e) => setComentario(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            placeholder="Ej. Aprobado por el Ing. Pérez, se solicita iniciar producción."
                            disabled={disabled}
                        />
                    </div>
                    <div>
                        <Label>Documento de Evidencia *</Label>
                        <div
                            className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer"
                            onClick={() => !disabled && fileInputRef.current?.click()}
                        >
                            <div className="space-y-1 text-center">
                                {documento ? (
                                    <>
                                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                        <p className="font-semibold text-blue-600">{documento.name}</p>
                                        <p className="text-xs text-gray-500">{(documento.size / 1024).toFixed(2)} KB</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <p className="pl-1">Sube un archivo (PDF, JPG, PNG)</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={disabled}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isSaving}>Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isSaving || disabled}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Guardar Aprobación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RegistrarAprobacionDialog;