import React from 'react';
import { Helmet } from 'react-helmet';
import PedidosMateriales from '@/pages/PedidosMateriales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/use-toast';

const Compras = () => {
  const { toast } = useToast();

  return (
    <>
      <Helmet>
        <title>Compras - Sistema TESEY</title>
        <meta name="description" content="Gestión de solicitudes, pedidos de materiales y órdenes de compra." />
      </Helmet>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compras</h2>
          <p className="text-gray-600 mt-1">Gestiona pedidos de materiales y órdenes de compra.</p>
        </div>

        <Tabs defaultValue="pedidos" className="w-full">
          <TabsList>
            <TabsTrigger value="pedidos">Pedidos de Materiales</TabsTrigger>
            <TabsTrigger value="ordenes" onClick={() => toast({ title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" })}>
              Órdenes de Compra
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pedidos" className="mt-4">
            <PedidosMateriales isEmbedded={true} />
          </TabsContent>

          <TabsContent value="ordenes" className="mt-4">
            <div className="bg-white rounded-xl border shadow-sm">
                <div className="text-center py-20">
                    <p className="text-gray-500">La gestión de Órdenes de Compra estará disponible aquí.</p>
                </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Compras;