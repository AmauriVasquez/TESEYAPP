import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building, FileText, ArrowLeft } from 'lucide-react';
import FormatoTESEY from '@/components/formatos/FormatoOCTESEY';
import FormatoIIHEMSA from '@/components/formatos/FormatoOCIIHEMSA';

const SeleccionarFormatoDialog = ({ open, onOpenChange, pedidoData, defaultFormat = null }) => {
  const [selectedFormat, setSelectedFormat] = useState(null);

  // Efecto para auto-seleccionar el formato si viene del botón dividido
  React.useEffect(() => {
  if (open) {
      if (defaultFormat) {
          setSelectedFormat(defaultFormat);
      } else {
          setSelectedFormat(null);
      }
  }
}, [open, defaultFormat]);

  const handleClose = () => {
    setSelectedFormat(null); // Reset selection when closing
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedFormat && !defaultFormat && (
               <Button variant="ghost" size="icon" onClick={() => setSelectedFormat(null)} className="mr-2 h-8 w-8">
                   <ArrowLeft className="w-4 h-4" />
               </Button>
            )}
            {selectedFormat ? `Vista Previa: Formato ${selectedFormat}` : 'Seleccionar Formato de Impresión'}
          </DialogTitle>
        </DialogHeader>

        {!selectedFormat ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
            <div 
                className="group relative flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 cursor-pointer transition-all"
                onClick={() => setSelectedFormat('TESEY')}
            >
                <div className="p-4 rounded-full bg-gray-100 group-hover:bg-blue-100 mb-4">
                    <Building className="w-10 h-10 text-gray-600 group-hover:text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Formato TESEY</h3>
                <p className="text-center text-gray-500 mt-2 text-sm">Imprimir con logo y datos fiscales de TESEY Ingeniería.</p>
            </div>

            <div 
                className="group relative flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-blue-800 hover:bg-blue-50 cursor-pointer transition-all"
                onClick={() => setSelectedFormat('IIHEMSA')}
            >
                <div className="p-4 rounded-full bg-gray-100 group-hover:bg-blue-200 mb-4">
                    <FileText className="w-10 h-10 text-gray-600 group-hover:text-blue-800" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Formato IIHEMSA</h3>
                <p className="text-center text-gray-500 mt-2 text-sm">Imprimir con logo oficial y formato de IIHEMSA.</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-4 bg-gray-100 rounded-lg">
              {selectedFormat === 'TESEY' && <FormatoTESEY pedidoData={pedidoData} />}
              {selectedFormat === 'IIHEMSA' && <FormatoIIHEMSA pedidoData={pedidoData} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SeleccionarFormatoDialog;