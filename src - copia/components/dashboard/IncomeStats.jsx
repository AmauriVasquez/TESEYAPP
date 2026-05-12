import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, TrendingUp, DollarSign } from 'lucide-react';
import { format, getYear } from 'date-fns';
import { es } from 'date-fns/locale';

const StatCard = ({ title, value, icon }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);


const IncomeStats = () => {
    const [incomeData, setIncomeData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(String(getYear(new Date())));
    const [availableYears, setAvailableYears] = useState([]);
    const { toast } = useToast();

    const fetchIncomeData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: yearsData, error: yearsError } = await supabase.rpc('get_distinct_payment_years');
            if (yearsError) throw yearsError;
            
            const years = yearsData.map(y => String(y.year)).sort((a, b) => b - a);
            setAvailableYears(years);

            if (years.length > 0 && !years.includes(selectedYear)) {
                setSelectedYear(years[0]);
            }
            
            const startDate = `${selectedYear}-01-01`;
            const endDate = `${selectedYear}-12-31`;

            const { data, error } = await supabase
                .from('proyecto_pagos')
                .select('fecha_pago, monto')
                .gte('fecha_pago', startDate)
                .lte('fecha_pago', endDate);

            if (error) throw error;

            const monthlyIncome = Array(12).fill(0).map((_, i) => ({
                name: format(new Date(selectedYear, i), 'MMM', { locale: es }),
                ingresos: 0,
            }));

            data.forEach(payment => {
                const month = new Date(payment.fecha_pago).getMonth();
                monthlyIncome[month].ingresos += payment.monto;
            });

            setIncomeData(monthlyIncome);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error al cargar datos de ingresos',
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    }, [selectedYear, toast]);

    useEffect(() => {
        fetchIncomeData();
    }, [fetchIncomeData]);
    
    useEffect(() => {
        // Create the RPC function if it doesn't exist
        const createFunction = async () => {
             await supabase.rpc('get_distinct_payment_years').then(({error}) => {
                if (error && error.code === '42883') {
                     supabase.sql`
                        CREATE OR REPLACE FUNCTION get_distinct_payment_years()
                        RETURNS TABLE(year INT) AS $$
                        BEGIN
                            RETURN QUERY
                            SELECT DISTINCT EXTRACT(YEAR FROM fecha_pago)::INT AS year
                            FROM public.proyecto_pagos
                            ORDER BY year DESC;
                        END;
                        $$ LANGUAGE plpgsql;
                    `.then(() => fetchIncomeData());
                }
            });
        };
        createFunction();
    }, [fetchIncomeData]);


    const { totalIncome, averageMonthlyIncome } = useMemo(() => {
        const total = incomeData.reduce((sum, month) => sum + month.ingresos, 0);
        const monthsWithIncome = incomeData.filter(m => m.ingresos > 0).length;
        const average = monthsWithIncome > 0 ? total / monthsWithIncome : 0;
        return { totalIncome: total, averageMonthlyIncome: average };
    }, [incomeData]);

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(value);

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle>Ingresos Mensuales ({selectedYear})</CardTitle>
                         {availableYears.length > 0 && (
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Seleccionar año" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                     {loading ? (
                        <div className="flex justify-center items-center h-96">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                        </div>
                    ) : incomeData.length > 0 && totalIncome > 0 ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <StatCard
                                    title={`Total Ingresos ${selectedYear}`}
                                    value={formatCurrency(totalIncome)}
                                    icon={<DollarSign className="h-5 w-5 text-green-500" />}
                                />
                                <StatCard
                                    title="Promedio Mensual"
                                    value={formatCurrency(averageMonthlyIncome)}
                                    icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
                                />
                            </div>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={incomeData} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis
                                            tickFormatter={(value) =>
                                                `$${(value / 1000).toLocaleString()}k`
                                            }
                                        />
                                        <Tooltip
                                            formatter={(value) => [formatCurrency(value), 'Ingresos']}
                                        />
                                        <Legend />
                                        <Bar dataKey="ingresos" fill="#3b82f6" name="Ingresos" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-96 text-center text-gray-500">
                            <DollarSign className="w-16 h-16 mb-4 text-gray-400" />
                            <h3 className="text-xl font-semibold">No hay datos de ingresos</h3>
                            <p className="mt-1">No se encontraron pagos registrados para el año {selectedYear}.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default IncomeStats;