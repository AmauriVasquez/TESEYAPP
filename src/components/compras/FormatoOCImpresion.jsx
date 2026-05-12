import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X, ChevronDown } from 'lucide-react';
import PlantillaImpresionOC from './PlantillaImpresionOC';
import FormatoOCMSM from '@/components/formatos/FormatoOCMSM';

const ETIQUETA_MARCA = {
  iihemsa: 'IIHEMSA',
  iihemsa_peninsular: 'IIHEMSA Peninsular',
  tesey: 'TESEY',
  msm: 'MSM',
};

const FormatoOCImpresion = ({ data, onClose }) => {
  const [marcaVista, setMarcaVista] = useState('iihemsa_peninsular');
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!data) return;
    const empresa = (data.empresa || '').toUpperCase();
    if (empresa.includes('MSM')) {
      setMarcaVista('msm');
    } else if (empresa.includes('IIHEMSA')) {
      setMarcaVista('iihemsa');
    } else if (empresa.includes('PENINSULAR')) {
      setMarcaVista('iihemsa_peninsular');
    } else if (empresa.includes('TESEY')) {
      setMarcaVista('tesey');
    } else {
      setMarcaVista('iihemsa_peninsular');
    }
  }, [data?.empresa]);

  if (!data) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .formato-oc-impresion-dialog > button.absolute { display: none !important; }
        }
      ` }} />
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col formato-oc-impresion-dialog print:max-w-none print:w-full print:shadow-none print:border-0 print:bg-transparent print:static print:left-0 print:top-0 print:translate-x-0 print:translate-y-0 print:max-h-none print:overflow-visible">
        <div className="flex justify-between items-center gap-2 pb-2 border-b print:hidden no-print">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setMenuAbierto((o) => !o)}
              >
                <span>Formato: {ETIQUETA_MARCA[marcaVista]}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
              {menuAbierto && (
                <div className="absolute z-20 mt-1 w-40 rounded-md border bg-white shadow-lg text-sm">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    onClick={() => { setMarcaVista('iihemsa_peninsular'); setMenuAbierto(false); }}
                  >
                    IIHEMSA Peninsular
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    onClick={() => { setMarcaVista('iihemsa'); setMenuAbierto(false); }}
                  >
                    IIHEMSA
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    onClick={() => { setMarcaVista('tesey'); setMenuAbierto(false); }}
                  >
                    TESEY
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                    onClick={() => { setMarcaVista('msm'); setMenuAbierto(false); }}
                  >
                    MSM
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
              <X className="w-4 h-4" /> Cerrar
            </Button>
            <Button size="sm" type="button" onClick={() => window.print()} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4" /> Imprimir: {ETIQUETA_MARCA[marcaVista]}
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 print:overflow-visible print:block">
          <div className="p-0 bg-white text-black print:p-0 print:block">
            {marcaVista !== 'msm' && (
              <PlantillaImpresionOC
                data={data}
                format={marcaVista === 'iihemsa' ? 'IIHEM' : 'TESEY'}
                marca={marcaVista}
                embedded
              />
            )}
            {marcaVista === 'msm' && <FormatoOCMSM data={data} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default FormatoOCImpresion;
