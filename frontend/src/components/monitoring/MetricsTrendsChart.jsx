import React from 'react';

const MetricsTrendsChart = ({ data, type, period }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Nenhum dado disponível para o período selecionado
      </div>
    );
  }

  // Simple line chart implementation using SVG
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = 40;

  // Get data bounds
  const timestamps = data.map(d => new Date(d.timestamp).getTime());
  const values = data.map(d => d.value);
  
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Create scales
  const xScale = (timestamp) => {
    const time = new Date(timestamp).getTime();
    return padding + ((time - minTime) / (maxTime - minTime)) * (chartWidth - 2 * padding);
  };

  const yScale = (value) => {
    if (maxValue === minValue) return chartHeight / 2;
    return chartHeight - padding - ((value - minValue) / (maxValue - minValue)) * (chartHeight - 2 * padding);
  };

  // Group data by component for multiple lines
  const componentData = data.reduce((acc, point) => {
    const component = point.component || 'system';
    if (!acc[component]) acc[component] = [];
    acc[component].push(point);
    return acc;
  }, {});

  const colors = {
    frontend: '#3B82F6',
    backend: '#10B981',
    firebase: '#F59E0B',
    auth: '#8B5CF6',
    system: '#6B7280'
  };

  // Create path for each component
  const createPath = (points) => {
    if (points.length === 0) return '';
    
    const sortedPoints = points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let path = `M ${xScale(sortedPoints[0].timestamp)} ${yScale(sortedPoints[0].value)}`;
    
    for (let i = 1; i < sortedPoints.length; i++) {
      path += ` L ${xScale(sortedPoints[i].timestamp)} ${yScale(sortedPoints[i].value)}`;
    }
    
    return path;
  };

  // Format value for display
  const formatValue = (value) => {
    if (type === 'performance') {
      return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
    }
    return Math.round(value);
  };

  // Format time for axis
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (period === 'last_hour') {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (period === 'last_day') {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
    }
  };

  // Create grid lines
  const gridLines = [];
  const numGridLines = 5;
  
  for (let i = 0; i <= numGridLines; i++) {
    const y = padding + (i * (chartHeight - 2 * padding)) / numGridLines;
    const value = maxValue - (i * (maxValue - minValue)) / numGridLines;
    
    gridLines.push(
      <g key={`grid-${i}`}>
        <line
          x1={padding}
          y1={y}
          x2={chartWidth - padding}
          y2={y}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        <text
          x={padding - 10}
          y={y + 4}
          textAnchor="end"
          fontSize="12"
          fill="#6B7280"
        >
          {formatValue(value)}
        </text>
      </g>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight + 40} className="w-full">
          {/* Grid lines */}
          {gridLines}
          
          {/* X-axis */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#D1D5DB"
            strokeWidth="2"
          />
          
          {/* Y-axis */}
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="#D1D5DB"
            strokeWidth="2"
          />
          
          {/* Data lines */}
          {Object.entries(componentData).map(([component, points]) => (
            <g key={component}>
              <path
                d={createPath(points)}
                fill="none"
                stroke={colors[component] || colors.system}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Data points */}
              {points.map((point, index) => (
                <circle
                  key={index}
                  cx={xScale(point.timestamp)}
                  cy={yScale(point.value)}
                  r="3"
                  fill={colors[component] || colors.system}
                >
                  <title>
                    {component}: {formatValue(point.value)} em {formatTime(point.timestamp)}
                  </title>
                </circle>
              ))}
            </g>
          ))}
          
          {/* X-axis labels */}
          {timestamps.length > 0 && (
            <g>
              {[0, Math.floor(timestamps.length / 2), timestamps.length - 1].map(index => {
                if (index >= timestamps.length) return null;
                const timestamp = timestamps[index];
                return (
                  <text
                    key={index}
                    x={xScale(timestamp)}
                    y={chartHeight - padding + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6B7280"
                  >
                    {formatTime(timestamp)}
                  </text>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center space-x-6">
        {Object.keys(componentData).map(component => (
          <div key={component} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[component] || colors.system }}
            />
            <span className="text-sm text-gray-600 capitalize">
              {component}
            </span>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="text-center text-sm text-gray-500">
        {type === 'errors' ? 'Número de erros' : 'Tempo de resposta'} ao longo do tempo
      </div>
    </div>
  );
};

export default MetricsTrendsChart;