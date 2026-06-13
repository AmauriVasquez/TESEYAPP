import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { PlusCircle, Download, Upload, Search, Edit, Trash2, Loader2, AlertTriangle, Star, ToyBrick, Cuboid, Package, Building2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from '@/components/ui/progress';
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
import MaterialDialog from '@/components/materiales/MaterialDialog';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';


const StockIndicator = ({ existencias, min, max }) => {
    const percentage = max > 0 ? (existencias / max) * 100 : 0;
    let colorClass = 'bg-green-500';
    if (existencias < min) {
        colorClass = 'bg-red-500';
    } else if (existencias < min * 1.2) {
        colorClass = 'bg-yellow-500';
    }
    
    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-center text-xs text-gray-600">
                <span>Min: {min}</span>
                <span className="font-bold">{existencias?.toFixed(2)}</span>
                <span>Max: {max}</span>
            </div>
            <Progress value={percentage} className="h-2 [&>div]:bg-transparent" indicatorClassName={colorClass} />
        </div>
    );
};


const Materiales = () => {
    const [materiales, setMateriales] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [activeTab, setActiveTab] = useState('Materiales'); // Default to 'Materiales' tab
    const { toast } = useToast();

    const fetchMateriales = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('materiales')
            .select(`
                id,
                descripcion,
                categoria,
                familia,
                clave,
                unidad_compra,
                costo_compra,
                unidad_uso,
                factor_conversion,
                costo_unitario,
                peso_teorico,
                es_acero,
                existencias,
                stock_min,
                stock_max
            `)
            .order('id', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los materiales.' });
            console.error(error);
        } else {
            setMateriales(data);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchMateriales();
    }, [fetchMateriales]);

    const filteredMaterialesByTab = useMemo(() => {
      // If the activeTab is 'Materiales', we show ALL materials
      if (activeTab === 'Materiales') {
          return materiales;
      }
      return materiales.filter(m => m.categoria === activeTab);
    }, [materiales, activeTab]);

    const searchedMateriales = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return filteredMaterialesByTab.filter(m =>
            (m.descripcion && m.descripcion.toLowerCase().includes(term)) ||
            (m.clave && m.clave.toLowerCase().includes(term)) ||
            (m.id != null && String(m.id).toLowerCase().includes(term))
        );
    }, [filteredMaterialesByTab, searchTerm]);

    const handleAddMaterial = () => {
        setSelectedMaterial(null);
        setDialogOpen(true);
    };

    const handleEditMaterial = (material) => {
        setSelectedMaterial(material);
        setDialogOpen(true);
    };
    
    const handleDeleteRequest = (material) => {
        setSelectedMaterial(material);
        setDeleteConfirmationOpen(true);
    };

    const handleDeleteConfirm = async () => {
        const { error } = await supabase.from('materiales').delete().eq('id', selectedMaterial.id);
        if (error) {
            const esFk = error.code === '23503' || /foreign key|movimientos/i.test(error.message || '');
            toast({
                variant: 'destructive',
                title: 'Error al eliminar',
                description: esFk
                    ? 'No se puede eliminar: el material tiene movimientos de inventario u otros registros asociados.'
                    : error.message,
            });
        } else {
            toast({ title: '✅ Material Eliminado', description: `El material ${selectedMaterial.descripcion} ha sido eliminado.` });
            fetchMateriales();
        }
        setDeleteConfirmationOpen(false);
        setSelectedMaterial(null);
    };

    const handleSaveMaterial = async (materialData) => {
        const cleanMaterialInfo = {
            ...materialData,
            existencias: parseFloat(materialData.existencias) || 0,
            stock_min: parseFloat(materialData.stock_min) || 0,
            stock_max: parseFloat(materialData.stock_max) || 0,

            costo_compra: parseFloat(materialData.costo_compra) || 0,
            factor_conversion: parseFloat(materialData.factor_conversion) || 0,
            costo_unitario: parseFloat(materialData.costo_unitario) || 0,

            peso_teorico: parseFloat(materialData.peso_teorico) || 0,
            es_acero: Boolean(materialData.es_acero),
        };

        const { id: _id, ...payload } = cleanMaterialInfo;

        if (selectedMaterial) {
            // Las existencias sólo cambian vía movimientos de inventario (trigger guard en BD).
            // Excluimos el campo del UPDATE del catálogo para no chocar con esa regla.
            const { existencias: _ex, ...updatePayload } = payload;
            const { error: materialError } = await supabase
                .from('materiales')
                .update(updatePayload)
                .eq('id', selectedMaterial.id);

            if (materialError) {
                toast({ variant: 'destructive', title: 'Error', description: materialError.message });
                return;
            }

            toast({ title: '✅ Material Actualizado' });
        } else {
            const { error: materialError } = await supabase.from('materiales').insert(payload);

            if (materialError) {
                toast({ variant: 'destructive', title: 'Error', description: materialError.message });
                return;
            }

            toast({ title: '✅ Material Creado' });
        }

        setDialogOpen(false);
        fetchMateriales();
    };
    
    const downloadTemplate = () => {
        const headers = [
            'categoria',
            'familia',
            'clave',
            'descripcion',
            'unidad_compra',
            'costo_compra',
            'unidad_uso',
            'factor_conversion',
            'costo_unitario',
            'es_acero',
            'peso_teorico',
            'existencias',
            'stock_min',
            'stock_max'
        ];
        const ws = XLSX.utils.json_to_sheet(
            [
                {
                    categoria: 'Materiales',
                    familia: 'Abrasivos',
                    clave: '',
                    descripcion: '',
                    unidad_compra: '',
                    costo_compra: 0,
                    unidad_uso: '',
                    factor_conversion: 1,
                    costo_unitario: 0,
                    es_acero: false,
                    peso_teorico: 0,
                    existencias: 0,
                    stock_min: 0,
                    stock_max: 0,
                },
            ],
            { header: headers }
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Materiales");
        XLSX.writeFile(wb, "plantilla_materiales.xlsx");
        toast({ title: 'Plantilla Descargada', description: 'Rellena el archivo para importar tus materiales.'});
    };
    
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    toast({ variant: 'destructive', title: 'Archivo vacío', description: 'La plantilla no contiene datos para importar.' });
                    return;
                }

                const parseBool = (v) => {
                    if (typeof v === 'boolean') return v;
                    if (typeof v === 'number') return v !== 0;
                    const s = String(v ?? '').trim().toLowerCase();
                    return ['true', '1', 'si', 'sí', 'y', 'yes'].includes(s);
                };

                const validCategories = ['Materiales', 'Consumibles', 'Activos', 'Edificio', 'Servicios'];
                const materialsToInsert = json.map((row) => {
                    const categoria = validCategories.includes(row.categoria) ? row.categoria : 'Materiales';
                    const costo_compra = parseFloat(row.costo_compra) || 0;
                    const factor_conversion = parseFloat(row.factor_conversion) || 0;
                    const costo_unitario = factor_conversion > 0 ? costo_compra / factor_conversion : 0;

                    return {
                        categoria,
                        familia: row.familia ?? '',
                        clave: row.clave ?? null,
                        descripcion: row.descripcion ?? '',
                        unidad_compra: row.unidad_compra ?? '',
                        costo_compra,
                        unidad_uso: row.unidad_uso ?? '',
                        factor_conversion,
                        costo_unitario,
                        es_acero: parseBool(row.es_acero),
                        peso_teorico: parseFloat(row.peso_teorico) || 0,
                        existencias: parseFloat(row.existencias) || 0,
                        stock_min: parseFloat(row.stock_min) || 0,
                        stock_max: parseFloat(row.stock_max) || 0,
                    };
                });

                const { error: materialError } = await supabase
                    .from('materiales')
                    .insert(materialsToInsert);

                if (materialError) throw materialError;

                toast({ title: '✅ Importación Exitosa', description: `Se han importado ${materialsToInsert.length} nuevos materiales.` });
                fetchMateriales();

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error de importación', description: 'Verifica el formato del archivo. Detalles: ' + error.message });
            } finally {
                setIsUploading(false);
                event.target.value = null; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const renderMaterialesTable = (materialesList) => (
        <div className="overflow-x-auto">
            {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Clave</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Unidad Compra</TableHead>
                        <TableHead>Conversión (Uso)</TableHead>
                        <TableHead className="w-[200px]">Existencias</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {materialesList.map((material) => {
                        const tieneClave = material.clave != null && String(material.clave).trim() !== '';
                        return (
                            <TableRow key={material.id}>
                                <TableCell>
                                    {tieneClave ? (
                                        <span className="font-mono text-blue-600 font-semibold">{material.clave}</span>
                                    ) : (
                                        <span className="text-xs text-amber-600 font-medium" title="Edita el material para asignar clave y familia">Sin Clave</span>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{material.descripcion}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full inline-flex w-fit",
                                           material.categoria === 'Activos' ? 'bg-indigo-100 text-indigo-800' :
                                           material.categoria === 'Consumibles' ? 'bg-lime-100 text-lime-800' :
                                           material.categoria === 'Edificio' ? 'bg-amber-100 text-amber-800' :
                                           material.categoria === 'Servicios' ? 'bg-violet-100 text-violet-800' :
                                           'bg-blue-100 text-blue-800'
                                        )}>
                                          {material.categoria}
                                        </span>
                                        {material.familia && <span className="text-xs text-gray-500">{material.familia}</span>}
                                    </div>
                                </TableCell>
                                <TableCell>{material.unidad_compra}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded font-semibold",
                                            material.unidad_uso ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
                                        )}>
                                            {material.unidad_uso || 'N/A'}{material.factor_conversion ? ` (x${material.factor_conversion})` : ''}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            C/U: {material.costo_unitario != null ? Number(material.costo_unitario).toFixed(4) : '0'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StockIndicator existencias={material.existencias} min={material.stock_min} max={material.stock_max} />
                                    <span className="text-xs text-gray-500">en {material.unidad_uso || 'N/A'}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditMaterial(material)}><Edit className="w-4 h-4 text-gray-600"/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(material)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            )}
             {materialesList.length === 0 && !loading && (
                <div className="text-center py-10">
                    <p className="text-gray-500">No se encontraron materiales en esta categoría.</p>
                </div>
            )}
        </div>
    );

    const renderContentForTab = (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
           {renderMaterialesTable(searchedMateriales)}
        </div>
    );

    return (
        <>
            <Helmet>
                <title>Materiales - IIHEMSA Peninsular</title>
                <meta name="description" content="Gestión y control de inventario de materiales." />
            </Helmet>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Catálogo de Materiales</h1>
                        <p className="text-gray-600 mt-1">Administra el inventario de materiales de tu empresa.</p>
                    </div>
                    <div className="flex gap-2 self-stretch sm:self-center">
                        <Button variant="outline" onClick={downloadTemplate} className="gap-2"><Download className="w-4 h-4"/> Plantilla</Button>
                        <Button asChild variant="outline" className="gap-2">
                          <label htmlFor="import-file" className="cursor-pointer">
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                            Importar
                          </label>
                        </Button>
                        <input type="file" id="import-file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        <Button onClick={handleAddMaterial} className="gap-2"><PlusCircle className="w-4 h-4"/> Nuevo Material</Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
                        <TabsList>
                            <TabsTrigger value="Materiales" className="gap-2"><Package className="w-4 h-4" />Materiales</TabsTrigger>
                            <TabsTrigger value="Consumibles" className="gap-2"><ToyBrick className="w-4 h-4" />Consumibles</TabsTrigger>
                            <TabsTrigger value="Activos" className="gap-2"><Cuboid className="w-4 h-4" />Activos</TabsTrigger>
                            <TabsTrigger value="Edificio" className="gap-2"><Building2 className="w-4 h-4" />Edificio</TabsTrigger>
                            <TabsTrigger value="Servicios" className="gap-2"><Wrench className="w-4 h-4" />Servicios</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                            <Input 
                                placeholder="Buscar por clave o descripción..." 
                                className="pl-10"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <TabsContent value="Materiales">{renderContentForTab}</TabsContent>
                    <TabsContent value="Consumibles">{renderContentForTab}</TabsContent>
                    <TabsContent value="Activos">{renderContentForTab}</TabsContent>
                    <TabsContent value="Edificio">{renderContentForTab}</TabsContent>
                    <TabsContent value="Servicios">{renderContentForTab}</TabsContent>
                </Tabs>
            </motion.div>
            <MaterialDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={handleSaveMaterial}
                material={selectedMaterial}
            />
            <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500"/> ¿Estás seguro de eliminar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el material <span className="font-bold">{selectedMaterial?.descripcion}</span>.
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

export default Materiales;