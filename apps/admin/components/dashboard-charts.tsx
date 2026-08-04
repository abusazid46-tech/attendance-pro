"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AttendanceTrend({ data }: { data: { month: string; attendance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line type="monotone" dataKey="attendance" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SubjectBars({ data }: { data: { subject: string; attendance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="subject" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="attendance" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.subject} fill={entry.attendance >= 75 ? "#16a34a" : entry.attendance >= 60 ? "#f97316" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PresentAbsentPie({ data = [] }: { data?: { name: string; value: number }[] }) {
  const palette = ["#16a34a", "#dc2626", "#f97316", "#2563eb"];
  const chartData = data.length ? data.map((item, index) => ({ ...item, fill: palette[index % palette.length] })) : [{ name: "No records", value: 1, fill: "#94a3b8" }];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Tooltip />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} />
      </PieChart>
    </ResponsiveContainer>
  );
}
