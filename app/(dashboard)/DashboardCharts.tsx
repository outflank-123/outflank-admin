'use client'

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

export default function DashboardCharts({ 
  revenueData, 
  statusData 
}: { 
  revenueData: any[],
  statusData: any[] 
}) {
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#64748b', '#8b5cf6', '#ef4444']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      {/* Revenue Graph */}
      <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-6">
        <div className="mb-6">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">Revenue & Orders</h2>
          <p className="text-[#86868b] text-[13px] font-medium">Sales performance over selected period</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#86868b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                yAxisId="left"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#86868b', fontSize: 12 }}
                tickFormatter={(value) => `₹${value}`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#86868b', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                formatter={(value: any, name: any) => name === 'revenue' ? [`₹${value}`, 'Revenue'] : [`${value}`, 'Orders']}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Order Status Pie Chart */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] p-6 flex flex-col">
        <div className="mb-2">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">Orders by Status</h2>
          <p className="text-[#86868b] text-[13px] font-medium">Distribution of all active orders</p>
        </div>
        <div className="flex-1 min-h-[250px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', color: '#1d1d1f' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
