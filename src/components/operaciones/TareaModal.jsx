import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TIPOS = [
  { v: 'general', l: 'General' },
  { v: 'mejora', l: 'Mejora interna' },
  { v: 'mantenimiento', l: 'Mantenimiento' },
];
const PRIORIDADES = [
  { v: 'baja', l: 'Baja' },
  { v: 'media', l: 'Media' },
  { v: 'alta', l: 'Alta' },
];

const VACIA = { titulo: '', descripcion: '', tipo: 'general', prioridad: 'media', asignado_empleado_id: '', fecha_limite: '' };

export default function TareaModal({ open, onOpenChange, empleados, tarea, onGuardar }) {
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(tarea
        ? {
            titulo: tarea.titulo ?? '',
            descripcion: tarea.descripcion ?? '',
            tipo: tarea.tipo ?? 'general',
            prioridad: tarea.prioridad ?? 'media',
            asignado_empleado_id: tarea.asignado_empleado_id ?? '',
            fecha_limite: tarea.fecha_limite ?? '',
          }
        : VACIA);
    }
  }, [open, tarea]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    await onGuardar({ ...form, asignado_empleado_id: form.asignado_empleado_id || null });
    setGuardando(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="t-titulo">Título</Label>
            <Input id="t-titulo" value={form.titulo} onChange={set('titulo')} placeholder="Qué hay que hacer" />
          </div>
          <div>
            <Label htmlFor="t-desc">Descripción</Label>
            <textarea id="t-desc" value={form.descripcion} onChange={set('descripcion')}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-tipo">Tipo</Label>
              <select id="t-tipo" value={form.tipo} onChange={set('tipo')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="t-prio">Prioridad</Label>
              <select id="t-prio" value={form.prioridad} onChange={set('prioridad')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-asig">Asignar a</Label>
              <select id="t-asig" value={form.asignado_empleado_id} onChange={set('asignado_empleado_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— Sin asignar —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="t-fecha">Fecha límite</Label>
              <Input id="t-fecha" type="date" value={form.fecha_limite} onChange={set('fecha_limite')} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !form.titulo.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
