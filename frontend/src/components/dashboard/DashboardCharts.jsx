import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '../../lib/api';

/** Brand palette (hex so it renders inside SVG, where CSS vars don't resolve). */
const COLOR = {
  red: '#be1e2d',
  grey: '#787c7e',
  green: '#2f8f4e',
  amber: '#c9882f',
  blue: '#2f6f9f',
  greyMuted: '#9a9ea0',
  axis: '#9a9ea0',
  grid: '#e0e2e4',
};

const CHANNEL_LABELS = {
  linkedin_jobs: 'LinkedIn Jobs',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  facebook_instagram: 'Facebook/Instagram',
  wordpress: 'WordPress',
  onbekend: 'Onbekend',
};

const STATUS_META = {
  draft: { label: 'Concept', color: COLOR.grey },
  pending_approval: { label: 'Wacht op goedkeuring', color: COLOR.amber },
  approved: { label: 'Goedgekeurd', color: COLOR.blue },
  published: { label: 'Gepubliceerd', color: COLOR.green },
  expired: { label: 'Verlopen', color: COLOR.greyMuted },
};

const AXIS_PROPS = {
  stroke: COLOR.axis,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

function ChartCard({ title, isEmpty, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            Nog geen gegevens beschikbaar.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardCharts() {
  const analyticsQuery = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => api('/dashboard/analytics'),
  });

  if (analyticsQuery.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Kon statistieken niet laden.
        </CardContent>
      </Card>
    );
  }

  const data = analyticsQuery.data || {};
  const contentPerWeek = data.contentPerWeek || [];
  const publicationsByChannel = (data.publicationsByChannel || []).map((row) => ({
    ...row,
    label: CHANNEL_LABELS[row.channel] || row.channel,
  }));
  const statusDistribution = (data.statusDistribution || []).map((row) => ({
    ...row,
    label: STATUS_META[row.status]?.label || row.status,
    color: STATUS_META[row.status]?.color || COLOR.grey,
  }));
  const activeVacaturesPerWeek = data.activeVacaturesPerWeek || [];

  const contentHasData = contentPerWeek.some(
    (row) => row.vacature > 0 || row.marketing > 0,
  );
  const channelHasData = publicationsByChannel.length > 0;
  const statusHasData = statusDistribution.length > 0;
  const activeHasData = activeVacaturesPerWeek.some((row) => row.count > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Content geplaatst per week" isEmpty={!contentHasData}>
        <BarChart data={contentPerWeek} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis dataKey="week" {...AXIS_PROPS} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend />
          <Bar dataKey="vacature" name="Vacature" stackId="content" fill={COLOR.red} radius={[0, 0, 0, 0]} />
          <Bar dataKey="marketing" name="Marketing" stackId="content" fill={COLOR.grey} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Publicaties per kanaal" isEmpty={!channelHasData}>
        <BarChart data={publicationsByChannel} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend />
          <Bar dataKey="success" name="Gelukt" stackId="ch" fill={COLOR.green} />
          <Bar dataKey="pending" name="In behandeling" stackId="ch" fill={COLOR.amber} />
          <Bar dataKey="failed" name="Mislukt" stackId="ch" fill={COLOR.red} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Status-verdeling" isEmpty={!statusHasData}>
        <PieChart>
          <Pie
            data={statusDistribution}
            dataKey="count"
            nameKey="label"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {statusDistribution.map((entry) => (
              <Cell key={entry.status} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartCard>

      <ChartCard title="Actieve vacatures over tijd" isEmpty={!activeHasData}>
        <LineChart data={activeVacaturesPerWeek} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis dataKey="week" {...AXIS_PROPS} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="Actieve vacatures"
            stroke={COLOR.red}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR.red }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartCard>
    </div>
  );
}
