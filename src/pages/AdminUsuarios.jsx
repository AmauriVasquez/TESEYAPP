import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const ROLES = [
  { value: 'ADMIN_MAESTRO', label: 'Administrador Maestro' },
  { value: 'ADMIN_VISUAL', label: 'Administrador Visual' },
  { value: 'VENTAS', label: 'Ventas' },
  { value: 'COMPRAS_FACTURACION', label: 'Compras / Facturación' },
  { value: 'RH_ALMACEN', label: 'RH / Almacén' },
  { value: 'SUPERVISOR_CAMPO', label: 'Supervisor de Campo' },
  { value: 'OPERADOR', label: 'Operador' },
];

const ROLE_BADGE = {
  ADMIN_MAESTRO: 'bg-purple-100 text-purple-800',
  ADMIN_VISUAL: 'bg-indigo-100 text-indigo-800',
  VENTAS: 'bg-green-100 text-green-800',
  COMPRAS_FACTURACION: 'bg-yellow-100 text-yellow-800',
  RH_ALMACEN: 'bg-blue-100 text-blue-800',
  SUPERVISOR_CAMPO: 'bg-orange-100 text-orange-800',
  OPERADOR: 'bg-gray-100 text-gray-700',
};

const MODULES = [
  { key: 'clientes', label: 'Clientes' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'prospectos', label: 'Prospectos / CRM' },
  { key: 'compras', sub: 'pedidos', label: 'Compras — Pedidos' },
  { key: 'compras', sub: 'ordenes', label: 'Compras — Órdenes de Compra' },
  { key: 'compras', sub: 'proveedores', label: 'Compras — Proveedores' },
  { key: 'materiales', label: 'Materiales / Almacén' },
  { key: 'proyectos', label: 'Proyectos' },
  { key: 'proyectos', sub: 'control_financiero', label: 'Proyectos — Control Financiero' },
  { key: 'finanzas', label: 'Finanzas' },
  { key: 'personal', label: 'Control de Personal' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'activos', label: 'Activos Operativos' },
  { key: 'kpi_definitions', label: 'KPIs' },
];

const CAMPOS_OCULTOS_FINANZAS = [
  { id: 'utilidad_neta', label: 'Utilidad neta' },
  { id: 'margen_bruto', label: 'Margen bruto' },
  { id: 'utilidad_estimada', label: 'Utilidad estimada' },
];

const permModuleKey = (modulo, sub) => (sub ? `${modulo}.${sub}` : modulo);

const readPermBool = (perm, field) => {
  if (!perm) return false;
  const puedeKey = `puede_${field}`;
  if (typeof perm[puedeKey] === 'boolean') return perm[puedeKey];
  if (typeof perm[field] === 'boolean') return perm[field];
  return false;
};

const findUserPerm = (permisos, modulo, sub) =>
  (permisos || []).find(
    (p) =>
      p.modulo === modulo &&
      (p.submodulo ?? null) === (sub ?? null)
  );

const buildPermStateFromUser = (permisos) => {
  const state = {};
  MODULES.forEach((mod) => {
    const key = permModuleKey(mod.key, mod.sub);
    const found = findUserPerm(permisos, mod.key, mod.sub);
    state[key] = {
      ver: readPermBool(found, 'ver'),
      crear: readPermBool(found, 'crear'),
      editar: readPermBool(found, 'editar'),
      eliminar: readPermBool(found, 'eliminar'),
      exportar: readPermBool(found, 'exportar'),
      autorizar: readPermBool(found, 'autorizar'),
      campos_ocultos: Array.isArray(found?.campos_ocultos) ? [...found.campos_ocultos] : [],
      dirty: false,
    };
  });
  return state;
};

const AdminUsuarios = () => {
  const { toast } = useToast();
  const { hasRole, userId, loading: permLoading } = usePermissions();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombre_completo: '',
    correo: '',
    contraseña: '',
    telefono: '',
    rol: 'OPERADOR',
  });

  const [permSheetOpen, setPermSheetOpen] = useState(false);
  const [permUser, setPermUser] = useState(null);
  const [permState, setPermState] = useState({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [resettingPerms, setResettingPerms] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_usuarios');
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      setUsuarios(list);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar usuarios',
        description: err.message,
      });
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!permLoading && hasRole('ADMIN_MAESTRO')) {
      fetchUsuarios();
    }
  }, [permLoading, hasRole, fetchUsuarios]);

  const total = usuarios.length;
  const activos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios]);

  const openPermissions = (usuario) => {
    setPermUser(usuario);
    setPermState(buildPermStateFromUser(usuario.permisos));
    setPermSheetOpen(true);
  };

  const updatePermField = (key, field, value) => {
    setPermState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
        dirty: true,
      },
    }));
  };

  const toggleCampoOculto = (campoId, checked) => {
    const key = permModuleKey('finanzas');
    setPermState((prev) => {
      const current = prev[key]?.campos_ocultos ?? [];
      const next = checked
        ? [...new Set([...current, campoId])]
        : current.filter((c) => c !== campoId);
      return {
        ...prev,
        [key]: {
          ...prev[key],
          campos_ocultos: next,
          dirty: true,
        },
      };
    });
  };

  const handleRolChange = async (usuario, nuevoRol) => {
    if (usuario.id === userId) return;
    try {
      const { error } = await supabase.rpc('admin_set_rol_usuario', {
        p_usuario_id: usuario.id,
        p_nuevo_rol: nuevoRol,
      });
      if (error) throw error;
      toast({ title: 'Rol actualizado' });
      await fetchUsuarios();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar rol',
        description: err.message,
      });
    }
  };

  const handleToggleActivo = async (usuario, activo) => {
    if (usuario.id === userId) return;
    try {
      const { error } = await supabase.rpc('admin_toggle_usuario', {
        p_usuario_id: usuario.id,
        p_activo: activo,
      });
      if (error) throw error;
      toast({ title: activo ? 'Usuario activado' : 'Usuario desactivado' });
      await fetchUsuarios();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al cambiar estado',
        description: err.message,
      });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error } = await supabase.rpc('admin_crear_usuario', {
        p_email: createForm.correo.trim(),
        p_password: createForm.contraseña,
        p_nombre_completo: createForm.nombre_completo.trim(),
        p_telefono: createForm.telefono.trim() || null,
        p_app_rol: createForm.rol,
      });
      if (error) throw error;
      toast({ title: 'Usuario creado correctamente' });
      setCreateOpen(false);
      setCreateForm({
        nombre_completo: '',
        correo: '',
        contraseña: '',
        telefono: '',
        rol: 'OPERADOR',
      });
      await fetchUsuarios();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al crear usuario',
        description: err.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    try {
      const dirtyModules = MODULES.filter((mod) => {
        const key = permModuleKey(mod.key, mod.sub);
        return permState[key]?.dirty;
      });

      for (const mod of dirtyModules) {
        const key = permModuleKey(mod.key, mod.sub);
        const s = permState[key];
        const { error } = await supabase.rpc('admin_set_permiso', {
          p_usuario_id: permUser.id,
          p_modulo: mod.key,
          p_submodulo: mod.sub ?? null,
          p_puede_ver: Boolean(s.ver),
          p_puede_crear: Boolean(s.crear),
          p_puede_editar: Boolean(s.editar),
          p_puede_eliminar: Boolean(s.eliminar),
          p_puede_exportar: Boolean(s.exportar),
          p_puede_autorizar: Boolean(s.autorizar),
          p_campos_ocultos: mod.key === 'finanzas' ? s.campos_ocultos ?? [] : [],
        });
        if (error) throw error;
      }

      toast({ title: 'Permisos guardados correctamente' });
      setPermSheetOpen(false);
      setPermUser(null);
      await fetchUsuarios();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar permisos',
        description: err.message,
      });
    } finally {
      setSavingPerms(false);
    }
  };

  const handleResetToRole = async () => {
    if (!permUser) return;
    setResettingPerms(true);
    try {
      const { error } = await supabase
        .from('usuario_permisos')
        .delete()
        .eq('usuario_id', permUser.id);
      if (error) throw error;
      toast({ title: 'Permisos restablecidos al rol base' });
      setPermSheetOpen(false);
      setPermUser(null);
      await fetchUsuarios();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al restablecer permisos',
        description: err.message,
      });
    } finally {
      setResettingPerms(false);
    }
  };

  if (permLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasRole('ADMIN_MAESTRO')) {
    return <Navigate to="/" replace />;
  }

  const finanzasKey = permModuleKey('finanzas');
  const finanzasPerm = permState[finanzasKey];

  return (
    <>
      <Helmet>
        <title>Gestión de usuarios - IIHEMSA Peninsular</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h2>
            <Badge variant="secondary" className="mt-2">
              {total} usuarios · {activos} activos
            </Badge>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px]" />
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No hay usuarios registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  usuarios.map((usuario) => {
                    const isSelf = usuario.id === userId;
                    const initial = (usuario.nombre || usuario.correo || '?')
                      .charAt(0)
                      .toUpperCase();
                    const roleColor =
                      ROLE_BADGE[usuario.rol] || 'bg-gray-100 text-gray-700';

                    return (
                      <TableRow
                        key={usuario.id}
                        className={!usuario.activo ? 'opacity-60' : undefined}
                      >
                        <TableCell>
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${roleColor}`}
                          >
                            {initial}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{usuario.nombre}</span>
                            {isSelf && (
                              <Badge variant="outline" className="text-xs">
                                Tú
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {usuario.correo}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={usuario.rol}
                            onValueChange={(val) => handleRolChange(usuario, val)}
                            disabled={isSelf}
                          >
                            <SelectTrigger className="w-[200px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={Boolean(usuario.activo)}
                            onCheckedChange={(checked) =>
                              handleToggleActivo(usuario, checked)
                            }
                            disabled={isSelf}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {usuario.ultimo_acceso
                            ? formatDistanceToNow(new Date(usuario.ultimo_acceso), {
                                addSuffix: true,
                                locale: es,
                              })
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openPermissions(usuario)}
                            disabled={isSelf}
                          >
                            <UserCog className="w-4 h-4" />
                            Permisos
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nombre_completo">Nombre completo</Label>
              <Input
                id="nombre_completo"
                value={createForm.nombre_completo}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, nombre_completo: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                value={createForm.correo}
                onChange={(e) => setCreateForm((p) => ({ ...p, correo: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contraseña">Contraseña</Label>
              <Input
                id="contraseña"
                type="password"
                minLength={6}
                value={createForm.contraseña}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, contraseña: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                value={createForm.telefono}
                onChange={(e) => setCreateForm((p) => ({ ...p, telefono: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select
                value={createForm.rol}
                onValueChange={(val) => setCreateForm((p) => ({ ...p, rol: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? 'Creando...' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={permSheetOpen} onOpenChange={setPermSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-left">Permisos de usuario</SheetTitle>
            {permUser && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-sm font-medium">{permUser.nombre}</span>
                <Badge className={ROLE_BADGE[permUser.rol] || 'bg-gray-100 text-gray-700'}>
                  {ROLES.find((r) => r.value === permUser.rol)?.label ?? permUser.rol}
                </Badge>
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {MODULES.map((mod) => {
                const key = permModuleKey(mod.key, mod.sub);
                const s = permState[key];
                if (!s) return null;

                return (
                  <div key={key} className="space-y-3">
                    <p className="text-sm font-semibold text-gray-900">{mod.label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { field: 'ver', label: 'Ver' },
                        { field: 'crear', label: 'Crear' },
                        { field: 'editar', label: 'Editar' },
                        { field: 'eliminar', label: 'Eliminar' },
                      ].map(({ field, label }) => (
                        <div key={field} className="flex items-center justify-between gap-2">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <Switch
                            checked={Boolean(s[field])}
                            onCheckedChange={(checked) =>
                              updatePermField(key, field, checked)
                            }
                          />
                        </div>
                      ))}
                    </div>
                    {mod.key === 'finanzas' && (
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Campos ocultos</p>
                        {CAMPOS_OCULTOS_FINANZAS.map((campo) => (
                          <div key={campo.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`campo-${campo.id}`}
                              checked={(finanzasPerm?.campos_ocultos ?? []).includes(campo.id)}
                              onCheckedChange={(checked) =>
                                toggleCampoOculto(campo.id, Boolean(checked))
                              }
                            />
                            <Label htmlFor={`campo-${campo.id}`} className="text-sm font-normal">
                              {campo.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-b border-gray-100" />
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <SheetFooter className="px-6 py-4 border-t gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSavePermissions}
              disabled={savingPerms || resettingPerms}
            >
              {savingPerms ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResetToRole}
              disabled={savingPerms || resettingPerms}
            >
              {resettingPerms ? 'Restableciendo...' : 'Usar permisos del rol'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminUsuarios;
