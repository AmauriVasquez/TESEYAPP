# Prospect Scheduling & Duplicate Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add future interaction scheduling (visita/llamada/whatsapp) to the CRM prospect panel, display scheduled appointments in the existing calendar, and consolidate 7 duplicate company records.

**Architecture:** Extend `crm_interacciones` with `programada boolean` + `fecha_hora_programada timestamptz`. New `CitaForm` and `MarcarRealizadaForm` components integrate with `ProspectoDetalle`. `CalendarView` receives a `citas` prop and an `onSelectCita` callback from `Calendario.jsx` which manages `ProspectoDetalle` state for calendar click-throughs.

**Tech Stack:** React 18, Tailwind CSS v3, Shadcn/ui, Supabase (PostgreSQL), Lucide React, react-big-calendar, date-fns

---

## Resumen de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| Supabase migration | Execute SQL | Add 2 columns to `crm_interacciones` |
| Supabase SQL | Execute SQL | Consolidate 7 duplicate company records |
| `src/components/crm/CitaForm.jsx` | Create | Dialog to schedule a future appointment |
| `src/components/crm/MarcarRealizadaForm.jsx` | Create | Dialog to mark appointment done + fill result |
| `src/components/crm/ProspectoDetalle.jsx` | Modify | Add schedule button, split interactions into pending/history |
| `src/components/proyectos/CalendarView.jsx` | Modify | Accept `citas` prop, render CRM events in indigo, call `onSelectCita` |
| `src/pages/Calendario.jsx` | Modify | Fetch scheduled citas, pass to CalendarView, manage ProspectoDetalle state |

---

## Task 1: DB migration — add columns to crm_interacciones

**Files:**
- Execute SQL via Supabase MCP (`mcp__6506ddae...__execute_sql`)

- [ ] **Step 1: Run migration SQL**

Use tool `mcp__6506ddae-25f2-48b5-92df-c9230e08a4d0__execute_sql` with project_id `czbmqzimjlwwgcglubey`:

```sql
ALTER TABLE crm_interacciones
  ADD COLUMN IF NOT EXISTS programada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_hora_programada timestamptz;

COMMENT ON COLUMN crm_interacciones.programada IS 'true = cita futura programada, false = interacción ya registrada';
COMMENT ON COLUMN crm_interacciones.fecha_hora_programada IS 'Fecha y hora exacta de la cita programada';
```

- [ ] **Step 2: Verify columns exist**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'crm_interacciones'
  AND column_name IN ('programada', 'fecha_hora_programada');
```

Expected: 2 rows returned — `programada` as `boolean` with default `false`, `fecha_hora_programada` as `timestamp with time zone`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): add programada and fecha_hora_programada to crm_interacciones"
```

---

## Task 2: Duplicate cleanup — consolidate 7 company groups

**Files:**
- Execute SQL via Supabase MCP

**Context:** All 7 groups are the same company imported with multiple emails. Keep the record with the lowest `id` (earliest inserted), merge extra emails into `observaciones`, soft-delete the rest.

- [ ] **Step 1: Preview what will be consolidated**

Run this SELECT to confirm the groups before touching data:

```sql
SELECT nombre, COUNT(*) as total, array_agg(id ORDER BY id) as ids, array_agg(email ORDER BY id) as emails
FROM prospectos
WHERE nombre IN ('Baku', 'Lot Desarrollos', 'Constructora Proser', 'Endor', 'SUA', 'DESUR', 'Buscatán')
  AND eliminado = false
GROUP BY nombre
ORDER BY nombre;
```

Review the output and confirm the id arrays look correct before proceeding.

- [ ] **Step 2: Consolidate — merge emails and soft-delete duplicates**

```sql
-- For each duplicate group: update the primary record's observaciones with extra emails, then soft-delete extras.
-- This is a single transaction so it rolls back if anything fails.

BEGIN;

-- Helper: update primary record's observaciones to include all extra emails
WITH groups AS (
  SELECT
    nombre,
    MIN(id) AS primary_id,
    array_agg(id ORDER BY id) AS all_ids,
    array_agg(email ORDER BY id) FILTER (WHERE email IS NOT NULL) AS all_emails
  FROM prospectos
  WHERE nombre IN ('Baku', 'Lot Desarrollos', 'Constructora Proser', 'Endor', 'SUA', 'DESUR', 'Buscatán')
    AND eliminado = false
  GROUP BY nombre
  HAVING COUNT(*) > 1
),
extra_emails AS (
  SELECT
    g.primary_id,
    string_agg(p.email, ', ') AS merged_emails
  FROM groups g
  JOIN prospectos p ON p.id = ANY(g.all_ids) AND p.id <> g.primary_id AND p.email IS NOT NULL
  GROUP BY g.primary_id
)
UPDATE prospectos p
SET observaciones = CASE
  WHEN p.observaciones IS NOT NULL AND p.observaciones <> '' THEN
    p.observaciones || E'\n' || 'Contactos adicionales: ' || ee.merged_emails
  ELSE
    'Contactos adicionales: ' || ee.merged_emails
  END
FROM extra_emails ee
WHERE p.id = ee.primary_id;

-- Soft-delete all non-primary records
WITH groups AS (
  SELECT
    MIN(id) AS primary_id,
    array_agg(id ORDER BY id) AS all_ids
  FROM prospectos
  WHERE nombre IN ('Baku', 'Lot Desarrollos', 'Constructora Proser', 'Endor', 'SUA', 'DESUR', 'Buscatán')
    AND eliminado = false
  GROUP BY nombre
  HAVING COUNT(*) > 1
)
UPDATE prospectos
SET eliminado = true
WHERE id IN (
  SELECT unnest(all_ids) FROM groups
) AND id NOT IN (
  SELECT primary_id FROM groups
);

COMMIT;
```

- [ ] **Step 3: Verify cleanup**

```sql
SELECT nombre, COUNT(*) as total
FROM prospectos
WHERE nombre IN ('Baku', 'Lot Desarrollos', 'Constructora Proser', 'Endor', 'SUA', 'DESUR', 'Buscatán')
  AND eliminado = false
GROUP BY nombre;
```

Expected: 7 rows, each with `total = 1`.

Also verify merged emails on Baku primary:
```sql
SELECT id, nombre, email, observaciones
FROM prospectos
WHERE nombre = 'Baku' AND eliminado = false;
```

Expected: 1 row, `observaciones` contains "Contactos adicionales: ..." with the merged emails.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(data): consolidate 7 duplicate prospect company records"
```

---

## Task 3: Create CitaForm.jsx

**Files:**
- Create: `src/components/crm/CitaForm.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/crm/CitaForm.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const TIPOS_CITA = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
];

const INITIAL = {
  tipo: 'llamada',
  fecha: '',
  hora: '',
  descripcion: '',
};

const CitaForm = ({ open, onOpenChange, prospectoId, marcaOrigen, onSave }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(INITIAL);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fecha || !form.hora) {
      toast({
        variant: 'destructive',
        title: 'Fecha y hora requeridas',
        description: 'Selecciona cuándo será la cita.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const fecha_hora_programada = new Date(
        `${form.fecha}T${form.hora}:00`
      ).toISOString();

      const { error } = await supabase.from('crm_interacciones').insert([
        {
          prospecto_id: prospectoId,
          marca_origen: marcaOrigen,
          tipo: form.tipo,
          descripcion: form.descripcion.trim() || null,
          fecha: form.fecha,
          programada: true,
          fecha_hora_programada,
          eliminado: false,
        },
      ]);
      if (error) throw error;

      toast({
        title: 'Cita programada',
        description: 'La cita fue agendada correctamente.',
      });
      setForm(INITIAL);
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar la cita.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Programar cita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tipo de contacto</Label>
            <Select
              value={form.tipo}
              onValueChange={(val) => setForm((p) => ({ ...p, tipo: val }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CITA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha}
                onChange={handleChange}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="time"
                value={form.hora}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descripcion">Notas previas (opcional)</Label>
            <Textarea
              id="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Temas a tratar, objetivo de la cita..."
              className="h-20 resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSaving ? 'Guardando...' : 'Programar cita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CitaForm;
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors related to CitaForm.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CitaForm.jsx
git commit -m "feat(crm): add CitaForm component for scheduling future interactions"
```

---

## Task 4: Create MarcarRealizadaForm.jsx

**Files:**
- Create: `src/components/crm/MarcarRealizadaForm.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/crm/MarcarRealizadaForm.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ETAPAS = [
  { value: 'contactado', label: 'Contactado' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'en_negociacion', label: 'En negociación' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'descartado', label: 'Descartado' },
];

const MarcarRealizadaForm = ({
  open,
  onOpenChange,
  interaccion,
  prospectoId,
  onSave,
  onRefetch,
}) => {
  const { toast } = useToast();
  const [resultado, setResultado] = useState('');
  const [nuevaEtapa, setNuevaEtapa] = useState('');
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setResultado('');
    setNuevaEtapa('');
    setMotivoDescarte('');
    onOpenChange(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resultado.trim()) {
      toast({
        variant: 'destructive',
        title: 'Resultado requerido',
        description: 'Describe qué pasó en la interacción.',
      });
      return;
    }
    setIsSaving(true);
    try {
      // Mark interaction as realized (programada = false, save result in descripcion)
      const { error: intError } = await supabase
        .from('crm_interacciones')
        .update({ programada: false, descripcion: resultado.trim() })
        .eq('id', interaccion.id);
      if (intError) throw intError;

      // Optionally update prospect stage
      if (nuevaEtapa) {
        const updateData = { etapa: nuevaEtapa };
        if (nuevaEtapa === 'descartado' && motivoDescarte.trim()) {
          updateData.motivo_descarte = motivoDescarte.trim();
        }
        const { error: prospError } = await supabase
          .from('prospectos')
          .update(updateData)
          .eq('id', prospectoId);
        if (prospError) throw prospError;
      }

      toast({
        title: 'Interacción registrada',
        description: 'La cita fue marcada como realizada.',
      });
      setResultado('');
      setNuevaEtapa('');
      setMotivoDescarte('');
      onSave();
      if (onRefetch) onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar el resultado.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Resultado de la cita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="resultado">
              ¿Qué resultado tuvo la interacción?{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="resultado"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Describe brevemente qué pasó..."
              className="h-24 resize-none"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Actualizar etapa del prospecto (opcional)</Label>
            <Select value={nuevaEtapa} onValueChange={setNuevaEtapa}>
              <SelectTrigger>
                <SelectValue placeholder="— Sin cambio —" />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {nuevaEtapa === 'descartado' && (
            <div className="grid gap-2">
              <Label htmlFor="motivoDescarte">Motivo de descarte</Label>
              <Textarea
                id="motivoDescarte"
                value={motivoDescarte}
                onChange={(e) => setMotivoDescarte(e.target.value)}
                placeholder="¿Por qué se descarta este prospecto?"
                className="h-20 resize-none"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? 'Guardando...' : 'Confirmar resultado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MarcarRealizadaForm;
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors related to MarcarRealizadaForm.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/MarcarRealizadaForm.jsx
git commit -m "feat(crm): add MarcarRealizadaForm to register interaction results"
```

---

## Task 5: Modify ProspectoDetalle.jsx

**Files:**
- Modify: `src/components/crm/ProspectoDetalle.jsx`

**Changes needed:**
1. Add `CalendarDays` to lucide imports
2. Import `CitaForm` and `MarcarRealizadaForm`
3. Add state: `citaFormOpen`, `marcarRealizadaOpen`, `selectedCita`
4. Add `formatDateTime` helper
5. In Interacciones tab: split list into pendientes/historial, add "Programar cita" button, render pending citas with "Marcar como realizada" button
6. Mount `CitaForm` and `MarcarRealizadaForm`

- [ ] **Step 1: Add CalendarDays to lucide imports**

In `ProspectoDetalle.jsx`, find the lucide import block (line 10-20) and add `CalendarDays`:

```jsx
// BEFORE:
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
} from 'lucide-react';

// AFTER:
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
} from 'lucide-react';
```

- [ ] **Step 2: Add component imports after InteraccionForm import**

```jsx
// BEFORE (line 23):
import InteraccionForm from '@/components/crm/InteraccionForm';

// AFTER:
import InteraccionForm from '@/components/crm/InteraccionForm';
import CitaForm from '@/components/crm/CitaForm';
import MarcarRealizadaForm from '@/components/crm/MarcarRealizadaForm';
```

- [ ] **Step 3: Add formatDateTime helper after formatDate (line 74)**

```jsx
// Add after the formatDate function:
const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TIPO_CITA_COLOR = {
  llamada: 'bg-blue-100 text-blue-800',
  whatsapp: 'bg-green-100 text-green-800',
  visita: 'bg-orange-100 text-orange-800',
};
```

- [ ] **Step 4: Add state variables inside ProspectoDetalle (after existing state declarations, around line 88)**

```jsx
// Add after: const [isConverting, setIsConverting] = useState(false);
const [citaFormOpen, setCitaFormOpen] = useState(false);
const [marcarRealizadaOpen, setMarcarRealizadaOpen] = useState(false);
const [selectedCita, setSelectedCita] = useState(null);
```

- [ ] **Step 5: Replace the Interacciones TabsContent entirely**

Find the `<TabsContent value="interacciones"` block (lines 290–334) and replace it with:

```jsx
<TabsContent value="interacciones" className="mt-4 space-y-4">
  {/* Action buttons */}
  <div className="flex gap-2 flex-wrap">
    <Button
      type="button"
      variant="outline"
      className="flex-1 sm:flex-none gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
      onClick={() => setCitaFormOpen(true)}
    >
      <CalendarDays className="w-4 h-4" />
      Programar cita
    </Button>
    <Button
      type="button"
      variant="outline"
      className="flex-1 sm:flex-none"
      onClick={() => setInteraccionFormOpen(true)}
    >
      + Registrar interacción
    </Button>
  </div>

  {loadingInteracciones ? (
    <div className="flex justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  ) : (
    <>
      {/* Pending appointments section */}
      {interacciones.filter((i) => i.programada).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
            Citas pendientes
          </p>
          <ul className="space-y-2">
            {interacciones
              .filter((i) => i.programada)
              .sort(
                (a, b) =>
                  new Date(a.fecha_hora_programada) -
                  new Date(b.fecha_hora_programada)
              )
              .map((item) => {
                const Icon = TIPO_ICON[item.tipo] || FileText;
                const colorClass =
                  TIPO_CITA_COLOR[item.tipo] || 'bg-gray-100 text-gray-800';
                return (
                  <li
                    key={item.id}
                    className="flex gap-3 border border-indigo-100 rounded-lg p-3 bg-indigo-50"
                  >
                    <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                        >
                          {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                        </span>
                        <p className="text-sm font-semibold text-indigo-900">
                          {formatDateTime(item.fecha_hora_programada)}
                        </p>
                      </div>
                      {item.descripcion && (
                        <p className="text-xs text-gray-600 mt-1">
                          {item.descripcion}
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => {
                          setSelectedCita(item);
                          setMarcarRealizadaOpen(true);
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Marcar como realizada
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Interaction history section */}
      <div>
        {interacciones.filter((i) => !i.programada).length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Historial
          </p>
        )}
        {interacciones.filter((i) => !i.programada).length === 0 &&
        interacciones.filter((i) => i.programada).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Sin interacciones registradas. Registra la primera.
          </p>
        ) : interacciones.filter((i) => !i.programada).length === 0 ? null : (
          <ul className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {interacciones
              .filter((i) => !i.programada)
              .map((item) => {
                const Icon = TIPO_ICON[item.tipo] || FileText;
                return (
                  <li
                    key={item.id}
                    className="flex gap-3 border rounded-lg p-3 bg-gray-50"
                  >
                    <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{item.descripcion}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(item.fecha)}
                      </p>
                      {item.proxima_accion && (
                        <p className="text-xs text-blue-700 mt-1">
                          Próxima: {item.proxima_accion}
                          {item.fecha_proxima_accion
                            ? ` · ${formatDate(item.fecha_proxima_accion)}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </>
  )}
</TabsContent>
```

- [ ] **Step 6: Add CitaForm and MarcarRealizadaForm mounts**

Find the closing `</>` of the component return (after the `<InteraccionForm .../>` at lines 339–345) and add:

```jsx
      <CitaForm
        open={citaFormOpen}
        onOpenChange={setCitaFormOpen}
        prospectoId={prospecto.id}
        marcaOrigen={prospecto.marca_origen || 'tesey'}
        onSave={fetchInteracciones}
      />

      <MarcarRealizadaForm
        open={marcarRealizadaOpen}
        onOpenChange={setMarcarRealizadaOpen}
        interaccion={selectedCita}
        prospectoId={prospecto.id}
        onSave={fetchInteracciones}
        onRefetch={onRefetch}
      />
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/crm/ProspectoDetalle.jsx
git commit -m "feat(crm): integrate CitaForm and MarcarRealizadaForm into ProspectoDetalle"
```

---

## Task 6: Modify CalendarView.jsx — accept CRM citas

**Files:**
- Modify: `src/components/proyectos/CalendarView.jsx`

**Changes needed:**
1. Accept `citas` and `onSelectCita` props
2. Add `CRM_COLOR` constant
3. Handle CRM event style in `eventStyleGetter`
4. Map citas to calendar events in `events` useMemo
5. Handle click on CRM events in `handleSelectEvent`
6. Add CRM legend item in sidebar

- [ ] **Step 1: Add CRM_COLOR constant after CUMBLE_COLOR (line 41)**

```jsx
// BEFORE:
const CUMBLE_COLOR = '#db2777';

// AFTER:
const CUMBLE_COLOR = '#db2777';
const CRM_COLOR = '#6366f1'; // indigo-500
```

- [ ] **Step 2: Update eventStyleGetter to handle CRM events (lines 43-64)**

```jsx
// BEFORE:
const eventStyleGetter = (event) => {
  if (event?.resource?.tipo === 'cumpleanos') {
    return {
      style: {
        backgroundColor: CUMBLE_COLOR,
        borderRadius: '4px',
        border: 'none',
        color: 'white',
      },
    };
  }
  const estatus = event?.resource?.estatus;
  const backgroundColor = STATUS_COLORS[estatus] ?? '#3174ad';
  return {
    style: {
      backgroundColor,
      borderRadius: '4px',
      border: 'none',
      color: 'white',
    },
  };
};

// AFTER:
const eventStyleGetter = (event) => {
  if (event?.resource?.tipo === 'cumpleanos') {
    return {
      style: { backgroundColor: CUMBLE_COLOR, borderRadius: '4px', border: 'none', color: 'white' },
    };
  }
  if (event?.resource?.tipo === 'cita_crm') {
    return {
      style: { backgroundColor: CRM_COLOR, borderRadius: '4px', border: 'none', color: 'white' },
    };
  }
  const estatus = event?.resource?.estatus;
  const backgroundColor = STATUS_COLORS[estatus] ?? '#3174ad';
  return {
    style: { backgroundColor, borderRadius: '4px', border: 'none', color: 'white' },
  };
};
```

- [ ] **Step 3: Update CalendarView props signature (line 147)**

```jsx
// BEFORE:
const CalendarView = ({ proyectos, empleados = [] }) => {

// AFTER:
const CalendarView = ({ proyectos, empleados = [], citas = [], onSelectCita }) => {
```

- [ ] **Step 4: Add CRM events to the `events` useMemo**

Find the `events` useMemo (lines 174-219). Replace the return statement:

```jsx
// BEFORE (last part of useMemo):
    return [...projectEvents, ...cumpleEvents];
  }, [proyectos, activeStatuses, empleados, todayStr]);

// AFTER:
    const TIPO_LABEL = { llamada: 'Llamada', whatsapp: 'WhatsApp', visita: 'Visita' };
    const citaEvents = (citas || [])
      .filter((c) => c.fecha_hora_programada)
      .map((c) => {
        const start = new Date(c.fecha_hora_programada);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
        const tipoLabel = TIPO_LABEL[c.tipo] || c.tipo;
        const nombreProspecto = c.prospecto?.nombre || 'Prospecto';
        return {
          id: `cita-${c.id}`,
          title: `${tipoLabel} — ${nombreProspecto}`,
          start,
          end,
          resource: { tipo: 'cita_crm', citaId: c.id, prospecto: c.prospecto },
        };
      });

    return [...projectEvents, ...cumpleEvents, ...citaEvents];
  }, [proyectos, activeStatuses, empleados, todayStr, citas]);
```

- [ ] **Step 5: Update handleSelectEvent to call onSelectCita for CRM events (lines 221-226)**

```jsx
// BEFORE:
  const handleSelectEvent = (event) => {
    if (event?.resource?.tipo === 'cumpleanos') return;
    if (event?.resource?.id) {
      navigate(`${proyectosBase}/${event.resource.id}`);
    }
  };

// AFTER:
  const handleSelectEvent = (event) => {
    if (event?.resource?.tipo === 'cumpleanos') return;
    if (event?.resource?.tipo === 'cita_crm') {
      if (onSelectCita && event.resource.prospecto) {
        onSelectCita(event.resource.prospecto);
      }
      return;
    }
    if (event?.resource?.id) {
      navigate(`${proyectosBase}/${event.resource.id}`);
    }
  };
```

- [ ] **Step 6: Add CRM legend in sidebar (after the cumpleaños implicit legend, inside the `<aside>` block)**

Find the end of the status filter section in the sidebar (after the `</div>` that closes the `ESTATUS_ACTIVOS.map` block, around line 264) and add:

```jsx
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">CRM</h3>
          <div className="flex items-center gap-2 text-sm text-gray-700 p-1">
            <span
              className="w-3 h-3 rounded-sm shadow-sm shrink-0"
              style={{ backgroundColor: CRM_COLOR }}
              aria-hidden
            />
            <span>Citas con prospectos</span>
          </div>
        </div>
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/proyectos/CalendarView.jsx
git commit -m "feat(calendar): render CRM scheduled interactions as indigo events"
```

---

## Task 7: Modify Calendario.jsx — fetch citas and wire ProspectoDetalle

**Files:**
- Modify: `src/pages/Calendario.jsx`

**Changes needed:**
1. Import `useState` (already imported), `ProspectoDetalle`
2. Add state: `citas`, `selectedProspecto`, `detailOpen`
3. Fetch citas in `fetchProyectos` (parallel with existing queries)
4. Pass `citas` and `onSelectCita` to `CalendarView`
5. Render `ProspectoDetalle`

- [ ] **Step 1: Replace full Calendario.jsx content**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import CalendarView from '@/components/proyectos/CalendarView';
import ProspectoDetalle from '@/components/crm/ProspectoDetalle';

const Calendario = () => {
  const { toast } = useToast();
  const [proyectos, setProyectos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProspecto, setSelectedProspecto] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [proyRes, empRes, citasRes] = await Promise.all([
        supabase
          .from('proyectos')
          .select(`
            *,
            cliente:cliente_id(nombre),
            responsable:responsable_id(nombre_completo)
          `)
          .order('id', { ascending: false }),
        supabase
          .from('empleados')
          .select('id, nombre_completo, fecha_nacimiento, google_calendar_cumple_id')
          .eq('activo', true)
          .order('nombre_completo'),
        supabase
          .from('crm_interacciones')
          .select('id, tipo, fecha_hora_programada, descripcion, prospecto:prospecto_id(id, nombre)')
          .eq('programada', true)
          .eq('eliminado', false),
      ]);

      if (proyRes.error) throw proyRes.error;

      const withClientName = (proyRes.data || []).map((p) => ({
        ...p,
        cliente_nombre: p.cliente?.nombre || p.cliente_nombre_externo || 'Sin Cliente',
      }));
      setProyectos(withClientName);

      if (!empRes.error) setEmpleados(empRes.data || []);
      if (!citasRes.error) setCitas(citasRes.data || []);
    } catch (error) {
      console.error('Error cargando datos para calendario:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los datos del calendario.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectCita = useCallback(
    async (citaProspecto) => {
      if (!citaProspecto?.id) return;
      const { data, error } = await supabase
        .from('prospectos')
        .select('*')
        .eq('id', citaProspecto.id)
        .single();
      if (!error && data) {
        setSelectedProspecto(data);
        setDetailOpen(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cargar el prospecto.',
        });
      }
    },
    [toast]
  );

  return (
    <>
      <Helmet>
        <title>Calendario - IIHEMSA Peninsular</title>
      </Helmet>
      <div className="flex flex-col h-[calc(100vh-80px)] min-h-0">
        <div className="shrink-0 mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Calendario</h2>
          <p className="text-gray-600 mt-1 text-sm">
            Vista de proyectos y citas con prospectos. Filtra por estatus en el panel izquierdo.
          </p>
        </div>
        {loading ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <CalendarView
              proyectos={proyectos}
              empleados={empleados}
              citas={citas}
              onSelectCita={handleSelectCita}
            />
          </div>
        )}
      </div>

      <ProspectoDetalle
        open={detailOpen}
        onOpenChange={setDetailOpen}
        prospecto={selectedProspecto}
        onRefetch={fetchData}
      />
    </>
  );
};

export default Calendario;
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors. Build should complete successfully.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Calendario.jsx
git commit -m "feat(calendar): fetch and display CRM scheduled interactions, open ProspectoDetalle on click"
```

---

## Task 8: Final build and smoke check

- [ ] **Step 1: Run full build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ built in X.Xs` with no errors. Note any warnings.

- [ ] **Step 2: Verify the spec is committed**

```bash
git add docs/superpowers/specs/2026-05-22-prospect-scheduling-design.md docs/superpowers/plans/2026-05-22-prospect-scheduling.md
git commit -m "docs: add prospect scheduling spec and implementation plan"
```

---

## Self-Review

**Spec coverage:**
- ✅ DB migration (programada + fecha_hora_programada) → Task 1
- ✅ Duplicate cleanup (7 companies) → Task 2
- ✅ CitaForm (tipo/fecha/hora/notas) → Task 3
- ✅ MarcarRealizadaForm (resultado + stage update) → Task 4
- ✅ ProspectoDetalle: schedule button + pending/history split → Task 5
- ✅ Calendar CRM events in indigo → Task 6
- ✅ Calendar click → opens ProspectoDetalle → Task 7

**Placeholder scan:** None found. All steps have explicit code.

**Type consistency:**
- `CitaForm` props: `open, onOpenChange, prospectoId, marcaOrigen, onSave` ✅ matches Task 5 usage
- `MarcarRealizadaForm` props: `open, onOpenChange, interaccion, prospectoId, onSave, onRefetch` ✅ matches Task 5 usage
- `CalendarView` new props: `citas, onSelectCita` ✅ matches Task 7 usage
- `citas` shape: `{ id, tipo, fecha_hora_programada, descripcion, prospecto: { id, nombre } }` ✅ consistent between Task 6 and 7
- `handleSelectCita` receives `{ id, nombre }` from `event.resource.prospecto` ✅ consistent with cita shape
