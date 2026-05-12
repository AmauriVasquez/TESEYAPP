import React from 'react';
import { Badge } from '@/components/ui/badge';

const EstatusPedidoBadge = ({ estatus }) => {
  const styles = {
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Surtido': 'bg-green-100 text-green-800 border-green-200',
    'Entregado': 'bg-green-600 text-white border-transparent hover:bg-green-700',
    'Cancelado': 'bg-red-600 text-white border-transparent hover:bg-red-700'
  };

  // Fallback for undefined statuses
  const badgeStyle = styles[estatus] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <Badge variant="outline" className={`${badgeStyle} uppercase`}>
      {estatus}
    </Badge>
  );
};

export default EstatusPedidoBadge;