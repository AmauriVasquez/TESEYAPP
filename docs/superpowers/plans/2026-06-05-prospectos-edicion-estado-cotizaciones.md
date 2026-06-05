# Edición de prospectos, cambio de etapa e historial de cotizaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar edición de prospectos desde su panel de detalle, cambio rápido de etapa con confirmación, y mostrar el historial de cotizaciones tanto en prospectos como en un nuevo ClienteDetalle completo.

**Architecture:** Track A (Tasks 1-3, secuenciales) toca `ProspectoDetalle.jsx` y `Prospectos.jsx`. Track B (Task 4, paralelo a Track A) crea `ClienteDetalle.jsx` y modifica `Clientes.jsx`. Ambos tracks no comparten archivos y pueden ejecutarse en paralelo. Task 5 (build) espera a que ambos tracks terminen.

**Tech Stack:** React 18, Vite, Supabase JS client, shadcn/ui (Button, Dialog, Tabs, AlertDialog, DropdownMenu, Textarea), Lucide React, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-06-05-prospectos-edicion-estado-cotizaciones-design.md`

---

## ⚡ Paralelismo

```
Task 1 ──► Task 2 ──► Task 3 ──┐
                                ├──► Task 5 (build)
Task 4 ─────────────────────────┘
```

- **Track A** (Tasks 1→2→3): secuenciales, todos tocan `ProspectoDetalle.jsx`
- **Track B** (Task 4): independiente, crea `ClienteDetalle.jsx` y modifica `Clientes.jsx`
- Tasks 1 y 4 pueden lanzarse en paralelo

---

## Task 1: Botón Editar en ProspectoDetalle + cableado en Prospectos.jsx

**Files:**
- Modify: `src/pages/Prospectos.jsx` (añadir `handleEdit` + prop `onEdit`)
- Modify: `src/components/crm/ProspectoDetalle.jsx` (añadir botón Editar)

- [ ] **Step 1: Añadir `handleEdit` en Prospectos.jsx**

Abre `src/pages/Prospectos.jsx`. Busca `handleNuevo` (línea ~143). Justo debajo, añade:

```jsx
const handleEdit = useCallback((p) => {
  setProspectoEditar(p);
  setDialogOpen(true);
}, []);
```

- [ ] **Step 2: Pasar prop `onEdit` a ProspectoDetalle en Prospectos.jsx**

Busca el bloque `<ProspectoDetalle` (línea ~297). Reemplaza:

```jsx
      <ProspectoDetalle
        open={detalleOpen}
        onOpenChange={(open) => {
          setDetalleOpen(open);
          if (!open) setProspectoSeleccionado(null);
        }}
        prospecto={prospectoSeleccionado}
        onRefetch={refetch}
      />
```

con:

```jsx
      <ProspectoDetalle
        open={detalleOpen}
        onOpenChange={(open) => {
          setDetalleOpen(open);
          if (!open) setProspectoSeleccionado(null);
        }}
        prospecto={prospectoSeleccionado}
        onRefetch={refetch}
        onEdit={handleEdit}
      />
```

- [ ] **Step 3: Añadir `Pencil` a los imports de ProspectoDetalle.jsx**

Abre `src/components/crm/ProspectoDetalle.jsx`. Busca la línea de imports de lucide-react (~línea 8):

```jsx
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Users,
  FileText,
  Loader2,
  UserCheck,
  Globe,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  ExternalLink,
} from 'lucide-react';
```

Reemplaza con (agrega `Pencil`):

```jsx
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Users,
  FileText,
  Loader2,
  UserCheck,
  Globe,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  ExternalLink,
  Pencil,
} from 'lucide-react';
```

- [ ] **Step 4: Aceptar prop `onEdit` en ProspectoDetalle**

Busca la firma del componente (línea ~108):

```jsx
const ProspectoDetalle = ({ open, onOpenChange, prospecto, onRefetch }) => {
```

Reemplaza con:

```jsx
const ProspectoDetalle = ({ open, onOpenChange, prospecto, onRefetch, onEdit }) => {
```

- [ ] **Step 5: Añadir botón Editar en el DialogHeader de ProspectoDetalle**

Busca este bloque en el DialogHeader (líneas ~217-257, dentro de `<DialogHeader>`), justo antes de `{puedeConvertir && (`:

```jsx
            {puedeConvertir && (
              <Button
                type="button"
                size="sm"
                className="mt-2 bg-green-600 hover:bg-green-700 text-white gap-2"
```

Añade el botón Editar **antes** de ese bloque:

```jsx
            {onEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 gap-2"
                onClick={() => onEdit(prospecto)}
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            {puedeConvertir && (
              <Button
                type="button"
                size="sm"
                className="mt-2 bg-green-600 hover:bg-green-700 text-white gap-2"
```

- [ ] **Step 6: Verificar que no hay errores de lint / compilación**

```bash
cd /c/Users/eavm__sz/tesey-app && npm run build 2>&1 | tail -20
```

Esperado: sin errores de TypeScript/JSX.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/eavm__sz/tesey-app && git add src/pages/Prospectos.jsx src/components/crm/ProspectoDetalle.jsx && git commit -m "feat(prospectos): añadir botón Editar en detalle y cableado con ProspectoDialog"
```

---

## Task 2: Dropdown de etapa con confirmación y motivo de descarte

**Files:**
- Modify: `src/components/crm/ProspectoDetalle.jsx` (dropdown etapa + AlertDialogs)

- [ ] **Step 1: Añadir imports de DropdownMenu, AlertDialog y Textarea**

Al principio de `src/components/crm/ProspectoDetalle.jsx`, agrega estos imports después de los imports existentes de `@/components/ui/`:

```jsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
```

También agrega `ChevronDown` a los imports de lucide-react (justo después de `Pencil`):

```jsx
  Pencil,
  ChevronDown,
} from 'lucide-react';
```

- [ ] **Step 2: Añadir constante ETAPAS_MANUALES a nivel de módulo**

Justo después del bloque `const FUENTE_LABEL = { ... };` (línea ~65), añade:

```jsx
const ETAPAS_MANUALES = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'en_negociacion', label: 'En negociación' },
];
```

- [ ] **Step 3: Añadir estados para el dropdown de etapa**

Dentro del componente `ProspectoDetalle`, después de `const [cotizacionOpen, setCotizacionOpen] = useState(false);` (línea ~119), añade:

```jsx
  const [etapaPendiente, setEtapaPendiente] = useState(null);
  const [confirmEtapaOpen, setConfirmEtapaOpen] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [motivoModalOpen, setMotivoModalOpen] = useState(false);
  const [isUpdatingEtapa, setIsUpdatingEtapa] = useState(false);
```

- [ ] **Step 4: Añadir handlers de etapa dentro del componente**

Después de `const handleConvertir = async () => { ... };` (línea ~196), añade:

```jsx
  const handleEtapaSelect = (etapa) => {
    setEtapaPendiente(etapa);
    if (etapa === 'descartado') {
      setMotivoDescarte('');
      setMotivoModalOpen(true);
    } else {
      setConfirmEtapaOpen(true);
    }
  };

  const handleConfirmEtapa = async () => {
    setConfirmEtapaOpen(false);
    setIsUpdatingEtapa(true);
    try {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: etapaPendiente, motivo_descarte: null })
        .eq('id', prospecto.id);
      if (error) throw error;
      toast({
        title: 'Etapa actualizada',
        description: `El prospecto pasó a: ${ETAPA_LABEL[etapaPendiente]}`,
      });
      onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsUpdatingEtapa(false);
      setEtapaPendiente(null);
    }
  };

  const handleDescartarConfirm = async () => {
    setMotivoModalOpen(false);
    setIsUpdatingEtapa(true);
    try {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: 'descartado', motivo_descarte: motivoDescarte.trim() || null })
        .eq('id', prospecto.id);
      if (error) throw error;
      toast({ title: 'Prospecto descartado' });
      onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsUpdatingEtapa(false);
      setMotivoDescarte('');
      setEtapaPendiente(null);
    }
  };
```

- [ ] **Step 5: Reemplazar el badge estático de etapa con el dropdown**

Busca este span en el JSX (dentro del `<DialogHeader>`, ~línea 213):

```jsx
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass}`}>
                {ETAPA_LABEL[prospecto.etapa] || prospecto.etapa}
              </span>
```

Reemplaza con:

```jsx
              {prospecto.etapa === 'convertido' ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass}`}>
                  {ETAPA_LABEL[prospecto.etapa]}
                </span>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isUpdatingEtapa}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass} hover:opacity-80 transition-opacity disabled:opacity-50`}
                    >
                      {isUpdatingEtapa ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          {ETAPA_LABEL[prospecto.etapa] || prospecto.etapa}
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {ETAPAS_MANUALES.map((e) => (
                      <DropdownMenuItem
                        key={e.value}
                        disabled={e.value === prospecto.etapa}
                        onClick={() => handleEtapaSelect(e.value)}
                        className={e.value === prospecto.etapa ? 'font-semibold text-blue-700' : ''}
                      >
                        {e.value === prospecto.etapa ? `✓ ${e.label}` : e.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={prospecto.etapa === 'descartado'}
                      onClick={() => handleEtapaSelect('descartado')}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      Descartar…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
```

- [ ] **Step 6: Añadir los AlertDialogs al final del return de ProspectoDetalle**

Busca el cierre del componente, justo antes del `</>` final que cierra el fragment (después de `</CotizacionDialog>`). Añade:

```jsx
      {/* Confirmación cambio de etapa */}
      <AlertDialog open={confirmEtapaOpen} onOpenChange={setConfirmEtapaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              El prospecto <span className="font-semibold">{prospecto.nombre}</span> pasará
              a: <span className="font-semibold">{ETAPA_LABEL[etapaPendiente]}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEtapaPendiente(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEtapa}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal motivo de descarte */}
      <AlertDialog open={motivoModalOpen} onOpenChange={setMotivoModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar prospecto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas indicar el motivo del descarte? (opcional)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Textarea
              placeholder="Ej. Presupuesto insuficiente, sin respuesta..."
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
              className="h-20 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEtapaPendiente(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDescartarConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 7: Build check**

```bash
cd /c/Users/eavm__sz/tesey-app && npm run build 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/eavm__sz/tesey-app && git add src/components/crm/ProspectoDetalle.jsx && git commit -m "feat(prospectos): dropdown de etapa con confirmación y motivo de descarte"
```

---

## Task 3: Tab Cotizaciones en ProspectoDetalle

**Files:**
- Modify: `src/components/crm/ProspectoDetalle.jsx` (nuevo tab + fetch lazy)

- [ ] **Step 1: Añadir constante ESTATUS_COT_BADGE a nivel de módulo**

Justo después de `const ETAPAS_MANUALES = [...];` (añadido en Task 2), agrega:

```jsx
const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};
```

- [ ] **Step 2: Añadir estados de cotizaciones y tab activo**

Dentro del componente, después de los estados de etapa añadidos en Task 2, añade:

```jsx
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false);
  const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
```

- [ ] **Step 3: Añadir fetchCotizaciones**

Después de `fetchInteracciones` (callback ~línea 121), añade:

```jsx
  const fetchCotizaciones = useCallback(async () => {
    if (!prospecto?.id) return;
    setLoadingCotizaciones(true);
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('id, folio, descripcion, fecha, total, estatus')
      .eq('prospecto_id', prospecto.id)
      .eq('es_ultima_version', true)
      .order('fecha', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones.' });
      setCotizaciones([]);
    } else {
      setCotizaciones(data || []);
    }
    setLoadingCotizaciones(false);
    setCotizacionesLoaded(true);
  }, [prospecto?.id, toast]);
```

- [ ] **Step 4: Actualizar el useEffect para resetear cotizaciones al abrir/cerrar**

Busca el `useEffect` que llama a `fetchInteracciones` (~línea 144):

```jsx
  useEffect(() => {
    if (open && prospecto?.id) {
      fetchInteracciones();
    } else {
      setInteracciones([]);
    }
  }, [open, prospecto?.id, fetchInteracciones]);
```

Reemplaza con:

```jsx
  useEffect(() => {
    if (open && prospecto?.id) {
      fetchInteracciones();
      setActiveTab('resumen');
      setCotizaciones([]);
      setCotizacionesLoaded(false);
    } else {
      setInteracciones([]);
      setCotizaciones([]);
      setCotizacionesLoaded(false);
    }
  }, [open, prospecto?.id, fetchInteracciones]);
```

- [ ] **Step 5: Añadir handler de cambio de tab**

Dentro del componente, antes del `return (`, añade:

```jsx
  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'cotizaciones' && !cotizacionesLoaded) {
      fetchCotizaciones();
    }
  };
```

- [ ] **Step 6: Actualizar el componente Tabs para usar valor controlado y nuevo tab**

Busca `<Tabs defaultValue="resumen" className="mt-2">` (~línea 259). Reemplaza esa línea y las dos líneas de TabsTrigger:

```jsx
          <Tabs defaultValue="resumen" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="resumen" className="flex-1">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="interacciones" className="flex-1">
                Interacciones
              </TabsTrigger>
            </TabsList>
```

con:

```jsx
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="resumen" className="flex-1">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="interacciones" className="flex-1">
                Interacciones
              </TabsTrigger>
              <TabsTrigger value="cotizaciones" className="flex-1">
                Cotizaciones
                {cotizaciones.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {cotizaciones.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
```

- [ ] **Step 7: Añadir TabsContent de Cotizaciones**

Busca el cierre `</Tabs>` al final de los tabs (~antes de `</DialogContent>`). Justo antes de ese `</Tabs>`, añade:

```jsx
            <TabsContent value="cotizaciones" className="mt-4">
              {loadingCotizaciones ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : cotizaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <p className="text-sm">Sin cotizaciones registradas.</p>
                  {puedeConvertir && (
                    <p className="text-xs mt-1 text-gray-400">
                      Usa "Generar cotización" para crear una.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        <th className="text-left py-2 px-2 font-semibold">Folio</th>
                        <th className="text-left py-2 px-2 font-semibold">Descripción</th>
                        <th className="text-left py-2 px-2 font-semibold">Fecha</th>
                        <th className="text-right py-2 px-2 font-semibold">Total</th>
                        <th className="text-center py-2 px-2 font-semibold">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotizaciones.map((cot) => (
                        <tr key={cot.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 font-mono text-xs text-gray-700">{cot.folio}</td>
                          <td className="py-2 px-2 text-gray-700 max-w-[130px]">
                            <span className="block truncate" title={cot.descripcion}>
                              {cot.descripcion}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                            {formatDate(cot.fecha)}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatMXN(cot.total)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                ESTATUS_COT_BADGE[cot.estatus] ?? 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {cot.estatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
```

- [ ] **Step 8: Build check**

```bash
cd /c/Users/eavm__sz/tesey-app && npm run build 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/eavm__sz/tesey-app && git add src/components/crm/ProspectoDetalle.jsx && git commit -m "feat(prospectos): tab de cotizaciones con carga lazy en detalle del prospecto"
```

---

## Task 4: Nuevo ClienteDetalle + actualizar Clientes.jsx  *(paralelo a Tasks 1-3)*

**Files:**
- Create: `src/components/clientes/ClienteDetalle.jsx`
- Modify: `src/pages/Clientes.jsx`

- [ ] **Step 1: Crear `src/components/clientes/ClienteDetalle.jsx`**

Crea el archivo con este contenido completo:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Building, Mail, Phone, MapPin, FileText, User, Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(
    value + (String(value).includes('T') ? '' : 'T00:00:00')
  ).toLocaleDateString('es-MX');
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(value) || 0);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
    <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-words">{value || '—'}</p>
    </div>
  </div>
);

const ClienteDetalle = ({ open, onOpenChange, cliente, onEdit }) => {
  const { toast } = useToast();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false);
  const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);

  const fetchCotizaciones = useCallback(async () => {
    if (!cliente?.id) return;
    setLoadingCotizaciones(true);
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('id, folio, descripcion, fecha, total, estatus')
      .eq('cliente_id', cliente.id)
      .eq('es_ultima_version', true)
      .order('fecha', { ascending: false });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las cotizaciones.',
      });
      setCotizaciones([]);
    } else {
      setCotizaciones(data || []);
    }
    setLoadingCotizaciones(false);
    setCotizacionesLoaded(true);
  }, [cliente?.id, toast]);

  useEffect(() => {
    if (!open) {
      setCotizaciones([]);
      setCotizacionesLoaded(false);
    }
  }, [open]);

  const handleTabChange = (value) => {
    if (value === 'cotizaciones' && !cotizacionesLoaded) {
      fetchCotizaciones();
    }
  };

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            {cliente.nombre}
          </DialogTitle>
          {onEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 gap-2 w-fit"
              onClick={() => onEdit(cliente)}
            >
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
          )}
        </DialogHeader>

        <Tabs defaultValue="informacion" onValueChange={handleTabChange} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="informacion" className="flex-1">
              Información
            </TabsTrigger>
            <TabsTrigger value="cotizaciones" className="flex-1">
              Cotizaciones
              {cotizaciones.length > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {cotizaciones.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informacion" className="mt-4">
            <div className="space-y-1 py-2">
              <InfoRow
                icon={Building}
                label="Nombre comercial / Razón social"
                value={cliente.nombre}
              />
              <InfoRow
                icon={User}
                label="Nombre del contacto"
                value={cliente.nombre_contacto || cliente.nombre}
              />
              <InfoRow icon={FileText} label="RFC" value={cliente.rfc} />
              <InfoRow icon={Mail} label="Correo electrónico" value={cliente.email} />
              <InfoRow icon={Phone} label="Teléfono" value={cliente.telefono} />
              <InfoRow
                icon={MapPin}
                label="Dirección fiscal / Entrega"
                value={cliente.direccion}
              />
              {cliente.observaciones != null && cliente.observaciones !== '' && (
                <InfoRow icon={FileText} label="Observaciones" value={cliente.observaciones} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cotizaciones" className="mt-4">
            {loadingCotizaciones ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : cotizaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <p className="text-sm">Sin cotizaciones registradas para este cliente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left py-2 px-2 font-semibold">Folio</th>
                      <th className="text-left py-2 px-2 font-semibold">Descripción</th>
                      <th className="text-left py-2 px-2 font-semibold">Fecha</th>
                      <th className="text-right py-2 px-2 font-semibold">Total</th>
                      <th className="text-center py-2 px-2 font-semibold">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.map((cot) => (
                      <tr key={cot.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs text-gray-700">
                          {cot.folio}
                        </td>
                        <td className="py-2 px-2 text-gray-700 max-w-[160px]">
                          <span className="block truncate" title={cot.descripcion}>
                            {cot.descripcion}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                          {formatDate(cot.fecha)}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatMXN(cot.total)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              ESTATUS_COT_BADGE[cot.estatus] ?? 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {cot.estatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteDetalle;
```

- [ ] **Step 2: Actualizar el import en Clientes.jsx**

Abre `src/pages/Clientes.jsx`. Busca la línea:

```jsx
import ClientePreviewDialog from '@/components/clientes/ClientePreviewDialog';
```

Reemplaza con:

```jsx
import ClienteDetalle from '@/components/clientes/ClienteDetalle';
```

- [ ] **Step 3: Reemplazar el render de ClientePreviewDialog en Clientes.jsx**

Busca (~línea 250):

```jsx
      <ClientePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        cliente={clienteToPreview}
      />
```

Reemplaza con:

```jsx
      <ClienteDetalle
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setClienteToPreview(null);
        }}
        cliente={clienteToPreview}
        onEdit={handleEdit}
      />
```

> **Nota:** `handleEdit` ya existe en `Clientes.jsx` (~línea 74) y hace exactamente lo que necesitamos: setea `selectedCliente` y abre `dialogOpen` con `ClienteDialog`.

- [ ] **Step 4: Build check**

```bash
cd /c/Users/eavm__sz/tesey-app && npm run build 2>&1 | tail -20
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/eavm__sz/tesey-app && git add src/components/clientes/ClienteDetalle.jsx src/pages/Clientes.jsx && git commit -m "feat(clientes): nuevo ClienteDetalle con tabs Información y Cotizaciones"
```

---

## Task 5: Verificación final de build y smoke test

**Files:** ninguno (verificación pura)

> **Prerequisito:** Tasks 1, 2, 3 y 4 completados y commiteados.

- [ ] **Step 1: Build limpio**

```bash
cd /c/Users/eavm__sz/tesey-app && npm run build 2>&1
```

Esperado: termina con `✓ built in X.XXs` y sin ningún `error` en el output.

- [ ] **Step 2: Verificar que los 4 commits del feature están presentes**

```bash
cd /c/Users/eavm__sz/tesey-app && git log --oneline -5
```

Esperado: los 4 commits de feature más el commit del spec al tope:

```
feat(clientes): nuevo ClienteDetalle con tabs Información y Cotizaciones
feat(prospectos): tab de cotizaciones con carga lazy en detalle del prospecto
feat(prospectos): dropdown de etapa con confirmación y motivo de descarte
feat(prospectos): añadir botón Editar en detalle y cableado con ProspectoDialog
docs: spec de edición prospectos, cambio de etapa e historial cotizaciones
```

- [ ] **Step 3: Checklist funcional contra criterios de aceptación del spec**

Revisa los archivos modificados y confirma que cada criterio del spec tiene implementación:

- [ ] `ProspectoDetalle.jsx` tiene botón `Pencil` con `onClick={() => onEdit(prospecto)}`
- [ ] `Prospectos.jsx` tiene `handleEdit` que setea `prospectoEditar` y `dialogOpen`
- [ ] `ProspectoDetalle.jsx` tiene `DropdownMenu` envolviendo el badge de etapa (condicionado a `!== 'convertido'`)
- [ ] `ProspectoDetalle.jsx` tiene `AlertDialog` de confirmación y otro para motivo de descarte
- [ ] `ProspectoDetalle.jsx` tiene `TabsTrigger value="cotizaciones"` y su `TabsContent`
- [ ] `ClienteDetalle.jsx` existe con tabs `informacion` y `cotizaciones`
- [ ] `Clientes.jsx` usa `ClienteDetalle` en lugar de `ClientePreviewDialog`

- [ ] **Step 4: Merge a main (si estás en rama de feature)**

Solo ejecutar si el trabajo se hizo en una rama separada:

```bash
cd /c/Users/eavm__sz/tesey-app && git checkout main && git merge --no-ff feature/prospectos-edicion-cotizaciones -m "feat: edición prospectos, cambio de etapa e historial cotizaciones"
```

Si ya se trabajó directo en `main`, omitir este paso.

---

## Resumen de archivos

| Archivo | Acción | Task |
|---|---|---|
| `src/pages/Prospectos.jsx` | Modificar | 1 |
| `src/components/crm/ProspectoDetalle.jsx` | Modificar | 1, 2, 3 |
| `src/components/clientes/ClienteDetalle.jsx` | **Crear** | 4 |
| `src/pages/Clientes.jsx` | Modificar | 4 |
