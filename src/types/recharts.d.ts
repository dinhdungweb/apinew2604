declare module 'recharts' {
  import React from 'react';

  export interface ResponsiveContainerProps {
    width?: string | number;
    height?: string | number;
    children?: React.ReactNode;
  }

  export interface LineChartProps {
    data?: any[];
    children?: React.ReactNode;
  }

  export interface BarChartProps {
    data?: any[];
    children?: React.ReactNode;
  }

  export interface PieChartProps {
    children?: React.ReactNode;
  }

  export interface PieProps {
    data?: any[];
    cx?: string | number;
    cy?: string | number;
    labelLine?: boolean;
    outerRadius?: number;
    fill?: string;
    dataKey?: string;
    label?: Function | React.ReactNode;
    children?: React.ReactNode;
  }

  export interface LineProps {
    type?: string;
    dataKey?: string;
    stroke?: string;
    activeDot?: any;
    dot?: any;
    legendType?: string;
    strokeWidth?: number;
    children?: React.ReactNode;
  }

  export interface BarProps {
    dataKey?: string;
    fill?: string;
    name?: string;
    legendType?: string;
    children?: React.ReactNode;
  }

  export interface CellProps {
    key?: string;
    fill?: string;
    children?: React.ReactNode;
  }

  export interface XAxisProps {
    dataKey?: string;
    children?: React.ReactNode;
  }

  export interface YAxisProps {
    domain?: [number, number];
    children?: React.ReactNode;
  }

  export interface CartesianGridProps {
    strokeDasharray?: string;
    children?: React.ReactNode;
  }

  export interface TooltipProps {
    children?: React.ReactNode;
  }

  export interface LegendProps {
    children?: React.ReactNode;
  }

  export const ResponsiveContainer: React.FC<ResponsiveContainerProps>;
  export const LineChart: React.FC<LineChartProps>;
  export const Line: React.FC<LineProps>;
  export const BarChart: React.FC<BarChartProps>;
  export const Bar: React.FC<BarProps>;
  export const PieChart: React.FC<PieChartProps>;
  export const Pie: React.FC<PieProps>;
  export const Cell: React.FC<CellProps>;
  export const XAxis: React.FC<XAxisProps>;
  export const YAxis: React.FC<YAxisProps>;
  export const CartesianGrid: React.FC<CartesianGridProps>;
  export const Tooltip: React.FC<TooltipProps>;
  export const Legend: React.FC<LegendProps>;
} 