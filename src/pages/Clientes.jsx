import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Plus, Search, Mail, Phone, Building, Edit, Trash2, Eye, Loader2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ClienteDialog from '@/components/clientes/ClienteDialog';
import { renderToStaticMarkup } from 'react-dom/server';
import FormatoEstadoCuenta from '@/components/formatos/FormatoEstadoCuenta';
import { getEstadoCuentaCliente } from '@/lib/estadoCuentaData';
import { imprimirDocumentoCombinado } from '@/lib/printCombined';
import { getMarcaColores } from '@/lib/brandingConfig';
import ClienteDetalle from '@/components/clientes/ClienteDetalle';
import { supabase } from '@/lib/customSupabaseClient';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Clientes = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clienteToPreview, setClienteToPreview] = useState(null);
  const [imprimiendoCuentaId, setImprimiendoCuentaId] = useState(null);

  /** Genera el PDF de estado de cuenta (entregado pendiente de pago) del cliente. */
  const handleEstadoCuenta = useCallback(async (cliente) => {
    if (imprimiendoCuentaId) return;
    setImprimiendoCuentaId(cliente.id);
    try {
      const datos = await getEstadoCuentaCliente({ clienteId: cliente.id });
      if (datos.sinAdeudos) {
        toast({ title: 'Sin adeudos', description: 'Este cliente no tiene trabajos entregados con saldo pendiente.' });
        return;
      }
      const markup = renderToStaticMarkup(<FormatoEstadoCuenta datos={datos} />);
      const doc = new DOMParser().parseFromString(markup, 'text/html');
      const html = doc.querySelector('.estado-cuenta-root')?.outerHTML ?? markup;
      const ok = await imprimirDocumentoCombinado({
        bloquesHTML: [html],
        titulo: `Estado de cuenta ${cliente.nombre || ''}`.trim(),
        cssVars: getMarcaColores(datos.marca),
      });
      if (ok === false) {
        toast({ variant: 'destructive', title: 'Popup bloqueado', description: 'Permite ventanas emergentes para generar el PDF.' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo generar el estado de cuenta.' });
    } finally {
      setImprimiendoCuentaId(null);
    }
  }, [imprimiendoCuentaId, toast]);


  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
    if(error){
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.'});
    } else {
        setClientes(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchClientes();
    
    const handleFocus = () => {
        fetchClientes();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
        window.removeEventListener('focus', handleFocus);
    };
  }, [fetchClientes]);

  // Soporte de enlace profundo: /clientes?cliente=<id> (p.ej. "Ver cliente" desde
  // un prospecto convertido) abre la vista previa del cliente y limpia el query param.
  useEffect(() => {
    const clienteParam = searchParams.get('cliente');
    if (!clienteParam || loading || clientes.length === 0) return;
    const target = clientes.find((c) => String(c.id) === String(clienteParam));
    if (target) {
        setClienteToPreview(target);
        setPreviewOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('cliente');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, clientes, loading]);

  const handleEdit = (cliente) => {
    setPreviewOpen(false);
    setClienteToPreview(null);
    setSelectedCliente(cliente);
    setDialogOpen(true);
  };
  
  const handleDeleteRequest = (cliente) => {
    setSelectedCliente(cliente);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const { error } = await supabase.from('clientes').delete().eq('id', selectedCliente.id);
    if(error) {
        toast({variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el cliente. Puede que esté asociado a cotizaciones o proyectos.'});
    } else {
        toast({title: '✅ Cliente Eliminado'});
        fetchClientes();
    }
    setDeleteConfirmationOpen(false);
    setSelectedCliente(null);
  };

  const handleView = (cliente) => {
    setClienteToPreview(cliente);
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    await fetchClientes();
    setDialogOpen(false);
  };

  const filteredClientes = clientes.filter(cliente =>
    (cliente.nombre && cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cliente.rfc && cliente.rfc.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Helmet>
        <title>Clientes - IIHEMSA Peninsular</title>
        <meta name="description" content="Gestión de clientes y CRM IIHEMSA Peninsular" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
            <p className="text-gray-600 mt-1">Gestiona tu cartera de clientes</p>
          </div>
          <Button 
            onClick={() => {
              setSelectedCliente(null);
              setDialogOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, RFC o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : filteredClientes.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              {searchTerm ? 'No se encontraron clientes con ese criterio.' : 'Aún no hay clientes registrados.'}
            </div>
          ) : (
            <>
              {/* MÓVIL — tarjetas */}
              <div className="sm:hidden divide-y divide-gray-200">
                {filteredClientes.map((cliente, index) => (
                  <motion.div
                    key={cliente.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.03 }}
                    onClick={() => handleView(cliente)}
                    className="p-4 cursor-pointer active:bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 break-words">{cliente.nombre}</p>
                        {cliente.rfc && (
                          <p className="text-xs font-mono text-gray-500 mt-0.5 break-all">{cliente.rfc}</p>
                        )}
                        {cliente.email && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1 break-all">
                            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                            {cliente.email}
                          </div>
                        )}
                        {cliente.telefono && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-0.5">
                            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                            {cliente.telefono}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEstadoCuenta(cliente); }}
                        disabled={imprimiendoCuentaId === cliente.id}
                        className="h-10 gap-1.5"
                        title="Estado de cuenta (PDF)"
                      >
                        {imprimiendoCuentaId === cliente.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        Estado de cuenta
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}
                        className="h-10 gap-1.5"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDeleteRequest(cliente); }}
                        className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ESCRITORIO — tabla */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        RFC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contacto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                    </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredClientes.map((cliente, index) => (
                    <motion.tr
                        key={cliente.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleView(cliente)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                        <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <Building className="w-5 h-5 text-white" />
                            </div>
                            <div>
                            <p className="font-medium text-gray-900">{cliente.nombre}</p>
                            <p className="text-sm text-gray-500">{cliente.direccion}</p>
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-900">{cliente.rfc}</span>
                        </td>
                        <td className="px-6 py-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {cliente.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {cliente.telefono}
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEstadoCuenta(cliente); }}
                            disabled={imprimiendoCuentaId === cliente.id}
                            className="hover:bg-green-50 hover:text-green-700"
                            title="Estado de cuenta (PDF)"
                            >
                            {imprimiendoCuentaId === cliente.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                            </Button>
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleView(cliente); }}
                            className="hover:bg-blue-50 hover:text-blue-600"
                            >
                            <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}
                            className="hover:bg-blue-50 hover:text-blue-600"
                            >
                            <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(cliente); }}
                            className="hover:bg-red-50 hover:text-red-600"
                            >
                            <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        </td>
                    </motion.tr>
                    ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        clienteToEdit={selectedCliente}
      />
      <ClienteDetalle
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setClienteToPreview(null);
        }}
        cliente={clienteToPreview}
        onEdit={handleEdit}
      />
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de eliminar al cliente {selectedCliente?.nombre}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente el cliente de tus registros.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
};

export default Clientes;