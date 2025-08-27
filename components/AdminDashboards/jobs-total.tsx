import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";

// ⬇️ Use your existing types
import {
  MonthName,
  JobsRow,
  FooterByInterpreter,
  InterpreterName,
} from "@/types/overview";

type ApiResponse = {
  months: MonthName[];
  interpreters: InterpreterName[];
  totalJobsStack: JobsRow[];
  jobsFooter: FooterByInterpreter;
  year: number;
};

export function JobsTab({ year }: { year: number }) {
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin-dashboard/jobs-total/${year}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = (await r.json()) as ApiResponse;
        if (alive) setData(j);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year]);

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    if (!data) return {} as Record<InterpreterName, string>;
    const palette = [
      "#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED",
      "#0EA5E9", "#059669", "#CA8A04", "#EA580C", "#9333EA",
    ];
    const map = {} as Record<InterpreterName, string>;
    data.interpreters.forEach((n, i) => {
      map[n] = palette[i % palette.length];
    });
    return map;
  }, [data]);

  if (loading) return <div className="p-4 text-sm text-gray-600">Loading jobs…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const { interpreters, totalJobsStack, jobsFooter } = data;

  return (
    <>
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Total Jobs per Month (Year {data.year})</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totalJobsStack}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {interpreters.map((p) => (
                <Bar key={p} dataKey={p} fill={interpreterColors[p]} name={p} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Monthly Jobs Summary (Year {data.year}) with Diff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left">Month</th>
                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">{p}</th>
                  ))}
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {totalJobsStack.map((r) => {
                  const vals = interpreters.map(
                    (p) => Number(r[p as InterpreterName] ?? 0)
                  );
                  const d = Math.max(...vals) - Math.min(...vals);
                  return (
                    <tr key={r.month} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                      <td className="p-2 sticky left-0 z-10 bg-white dark:bg-slate-950">{r.month}</td>
                      {interpreters.map((p) => (
                        <td key={p} className="p-2 text-right">
                          {Number(r[p as InterpreterName] ?? 0)}
                        </td>
                      ))}
                      <td className="p-2 text-right font-medium">{r.total}</td>
                      <td className="p-2 text-right font-medium">{d}</td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 text-emerald-900 font-semibold">
                  <td className="p-2">TOTAL</td>
                  {jobsFooter.perInterpreter.map((v, idx) => (
                    <td key={idx} className="p-2 text-right">{v}</td>
                  ))}
                  <td className="p-2 text-right">{jobsFooter.grand}</td>
                  <td className="p-2 text-right">{jobsFooter.diff}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
