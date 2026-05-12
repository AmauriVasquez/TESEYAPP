import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AutorizarImpresionDialog = ({ open, onOpenChange, onAuthorized }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Reset state whenever the dialog opens
  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleAuthorize = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Verify credentials by attempting to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error('Credenciales incorrectas. Verifique el email y la contraseña.');
      }

      // 2. Verify if the user is an administrator
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', signInData.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('No se pudo verificar el rol del usuario.');
      }

      // Check for Admin role (case insensitive just to be safe)
      if (userData.rol?.toUpperCase() !== 'ADMINISTRADOR') {
        throw new Error('Acceso denegado. Se requieren permisos de Administrador.');
      }

      // 3. Success
      toast({
        title: "Autorización Exitosa",
        description: "Permiso de impresión concedido.",
        className: "bg-green-50 border-green-200 text-green-900"
      });

      // Trigger the callback to parent
      onAuthorized();

    } catch (err) {
      console.error('Error de autorización:', err);
      setError(err.message);
      toast({
        title: "Error de Autorización",
        description: err.message,
        variant: "destructive"
      });
      setLoading(false); // Only stop loading on error, on success parent handles close
    }
  };
  
  const handleClose = () => {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldCheck className="w-6 h-6" />
            Autorizar Impresión Oficial
          </DialogTitle>
          <DialogDescription>
            La impresión del formato <strong>IIHEMSA V2</strong> requiere credenciales de Administrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAuthorize} className="grid gap-4 py-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="admin-email-print">Email de Administrador</Label>
            <Input
              id="admin-email-print"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-password-print">Contraseña</Label>
            <Input
              id="admin-password-print"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e Imprimir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AutorizarImpresionDialog;