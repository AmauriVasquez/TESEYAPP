import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AutorizarPedidoDialog = ({ open, onOpenChange, onAuthorized }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleAuthorize = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Verify credentials by attempting to sign in
      // Note: This will change the current session to the admin user.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error('Credenciales incorrectas');
      }

      // 2. Verify if the user is an administrator
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', signInData.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Error al verificar permisos de usuario');
      }

      if (userData.rol !== 'ADMINISTRADOR') {
        throw new Error('Este usuario no tiene permisos de Administrador para autorizar.');
      }

      // 3. Success
      onAuthorized();
      onOpenChange(false);
      setEmail('');
      setPassword('');
      toast({
        title: "Autorización Exitosa",
        description: "Se han verificado las credenciales de administrador.",
        variant: "default"
      });

    } catch (err) {
      console.error(err);
      setError(err.message || "Error de conexión");
      toast({
        title: "Error de Autorización",
        description: err.message || "No se pudo verificar las credenciales.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldCheck className="w-6 h-6" />
            Autorizar Pedido
          </DialogTitle>
          <DialogDescription>
            Esta acción requiere credenciales de <strong>Administrador</strong>. Por favor ingrese su email y contraseña para confirmar.
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
            <Label htmlFor="admin-email">Email de Administrador</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-password">Contraseña</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Autorización
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AutorizarPedidoDialog;