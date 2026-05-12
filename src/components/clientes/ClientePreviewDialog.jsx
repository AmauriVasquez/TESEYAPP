import React from 'react';
import { Building, Mail, Phone, MapPin, FileText, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Modal solo-lectura con toda la información del cliente */
const ClientePreviewDialog = ({ open, onOpenChange, cliente }) => {
  if (!cliente) return null;

  const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Vista previa del cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-2">
          <InfoRow icon={Building} label="Nombre comercial / Razón social" value={cliente.nombre} />
          <InfoRow icon={User} label="Nombre del contacto" value={cliente.nombre_contacto || cliente.nombre} />
          <InfoRow icon={FileText} label="RFC" value={cliente.rfc} />
          <InfoRow icon={Mail} label="Correo electrónico" value={cliente.email} />
          <InfoRow icon={Phone} label="Teléfono" value={cliente.telefono} />
          <InfoRow icon={MapPin} label="Dirección fiscal / Entrega" value={cliente.direccion} />
          {(cliente.observaciones != null && cliente.observaciones !== '') && (
            <InfoRow icon={FileText} label="Observaciones" value={cliente.observaciones} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientePreviewDialog;
