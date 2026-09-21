// src/components/ResponsiveCard.tsx
import React from 'react';
import { Card } from 'antd';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveCardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  children,
  extra,
  className,
  style,
}) => {
  const { isMobile } = useResponsive();

  return (
    <Card
      title={title}
      extra={extra}
      className={className}
      style={{
        ...style,
        borderRadius: isMobile ? 8 : 12,
        boxShadow: isMobile ? '0 2px 8px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.1)',
      }}
      bodyStyle={{
        padding: isMobile ? 12 : 24,
        overflowX: 'auto',
      }}
    >
      {children}
    </Card>
  );
};

export default ResponsiveCard;