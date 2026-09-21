// src/components/ResponsiveTable.tsx
import React from 'react';
import { Table, TableProps } from 'antd';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveTableProps<RecordType extends object> extends TableProps<RecordType> {
  cardRender?: (record: RecordType) => React.ReactNode;
}

const ResponsiveTable = <RecordType extends object,>({
  columns,
  dataSource,
  cardRender,
  ...props
}: ResponsiveTableProps<RecordType>) => {
  const { isMobile } = useResponsive();

  if (isMobile && cardRender) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dataSource?.map((record, index) => (
          <div key={index} style={{ 
            background: '#fff', 
            borderRadius: 8, 
            padding: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0'
          }}>
            {cardRender(record)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      {...props}
      scroll={{ x: isMobile ? undefined : props.scroll?.x }}
    />
  );
};

export default ResponsiveTable;