import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const GraphBlock = ({ title, color, dataKey, data }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border">
    <h3 className="text-lg font-semibold mb-4 text-gray-700">{title}</h3>
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="timestamp"
            fontSize={12}
            tick={{ fill: '#666' }}
            tickFormatter={(tick) => format(new Date(tick), 'HH:mm:ss')}
          />
          <YAxis domain={['auto', 'auto']} fontSize={12} tick={{ fill: '#666' }} />
          <Tooltip labelFormatter={(label) => `Time: ${label}`} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default GraphBlock;

