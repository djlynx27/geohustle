import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useZones, type Zone } from '@/hooks/useSupabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedTrip {
  date: string;
  start_time: string;
  end_time: string;
  earnings: number;
  tips: number;
  distance_km: number;
  platform: string;
  zone_id: string | null;
  zone_name: string;
  raw: Record<string, string>;
}

// Map time+day patterns to zone types for auto-assignment
function guessZoneByTime(hour: number, dayOfWeek: number, zones: Zone[]): { id: string; name: string } | null {
  // dayOfWeek: 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  let preferredTypes: string[] = [];

  if (hour >= 0 && hour < 5) {
    preferredTypes = ['nightlife', 'aéroport'];
  } else if (hour >= 5 && hour < 9) {
    preferredTypes = ['métro', 'transport', 'résidentiel'];
  } else if (hour >= 9 && hour < 12) {
    preferredTypes = ['commercial', 'médical', 'université'];
  } else if (hour >= 12 && hour < 14) {
    preferredTypes = ['commercial', 'tourisme'];
  } else if (hour >= 14 && hour < 17) {
    preferredTypes = ['commercial', 'université', 'tourisme'];
  } else if (hour >= 17 && hour < 20) {
    preferredTypes = ['métro', 'transport', 'commercial'];
  } else if (hour >= 20 && hour < 23) {
    preferredTypes = isWeekend ? ['nightlife', 'événements', 'tourisme'] : ['nightlife', 'résidentiel'];
  } else {
    preferredTypes = ['nightlife', 'aéroport'];
  }

  for (const type of preferredTypes) {
    const match = zones.find((z: any) => z.type === type);
    if (match) return { id: match.id, name: match.name };
  }

  // Fallback: highest base_score zone
  if (zones.length > 0) {
    const best = zones.reduce((a, b) => ((a.base_score ?? 0) > (b.base_score ?? 0) ? a : b));
    return best ? { id: best.id, name: best.name } : null;
  }
  return null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Normalize headers
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function findColumn(row: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.includes(c));
    if (key && row[key]) return row[key];
  }
  return '';
}

function parseEarnings(val: string): number {
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

function parseMilesToKm(val: string): number {
  const miles = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
  return Math.round(miles * 1.60934 * 10) / 10;
}

export function CsvImporter() {
  const { data: mtlZones = [] } = useZones('mtl');
  const { data: lavalZones = [] } = useZones('laval');
  const { data: longueuilZones = [] } = useZones('longueuil');
  const allZones = useMemo<Zone[]>(() => [...mtlZones, ...lavalZones, ...longueuilZones], [mtlZones, lavalZones, longueuilZones]);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTrip[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsed([]);
    setImported(0);
    setFile(f);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('Fichier CSV vide ou invalide');
        return;
      }

      const trips: ParsedTrip[] = rows.map(row => {
        const dateStr = findColumn(row, ['date', 'trip_date', 'day']);
        const startTime = findColumn(row, ['start', 'time', 'pickup_time', 'start_time']);
        const endTime = findColumn(row, ['end', 'dropoff_time', 'end_time']);
        const earnings = parseEarnings(findColumn(row, ['earnings', 'total', 'fare', 'amount', 'pay']));
        const tips = parseEarnings(findColumn(row, ['tip', 'tips']));
        const distance = parseMilesToKm(findColumn(row, ['miles', 'distance', 'mi']));
        const platform = findColumn(row, ['platform', 'app', 'service']) || 'Gridwise';

        // Parse date for zone mapping
        let hour = 12;
        let dayOfWeek = 3;
        try {
          if (startTime) {
            const timeParts = startTime.match(/(\d{1,2}):(\d{2})/);
            if (timeParts) hour = parseInt(timeParts[1]);
            const isPM = startTime.toLowerCase().includes('pm') && hour < 12;
            const isAM12 = startTime.toLowerCase().includes('am') && hour === 12;
            if (isPM) hour += 12;
            if (isAM12) hour = 0;
          }
          if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) dayOfWeek = d.getDay();
          }
        } catch { /* ignore parse errors */ }

        const zone = guessZoneByTime(hour, dayOfWeek, allZones);

        // Build ISO timestamps
        let started_at = dateStr || new Date().toISOString().split('T')[0];
        if (startTime) {
          const hh = String(hour).padStart(2, '0');
          const mm = startTime.match(/:(\d{2})/)?.[1] || '00';
          started_at = `${started_at}T${hh}:${mm}:00`;
        } else {
          started_at = `${started_at}T12:00:00`;
        }

        let ended_at = started_at;
        if (endTime) {
          const endMatch = endTime.match(/(\d{1,2}):(\d{2})/);
          if (endMatch) {
            let eh = parseInt(endMatch[1]);
            const em = endMatch[2];
            const ePM = endTime.toLowerCase().includes('pm') && eh < 12;
            const eAM12 = endTime.toLowerCase().includes('am') && eh === 12;
            if (ePM) eh += 12;
            if (eAM12) eh = 0;
            ended_at = `${dateStr || new Date().toISOString().split('T')[0]}T${String(eh).padStart(2, '0')}:${em}:00`;
          }
        }

        return {
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          earnings,
          tips,
          distance_km: distance,
          platform,
          zone_id: zone?.id || null,
          zone_name: zone?.name || 'Auto (aucune)',
          raw: row,
        };
      });

      setParsed(trips);
      toast.success(`${trips.length} courses détectées`);
    };
    reader.readAsText(f);
  }, [allZones]);

  async function handleImport() {
    if (parsed.length === 0) return;
    setImporting(true);
    setProgress(0);
    let success = 0;

    const batch = parsed.filter(t => t.zone_id).map(t => ({
      zone_id: t.zone_id!,
      started_at: `${t.date}T${t.start_time || '12:00'}`,
      ended_at: t.end_time ? `${t.date}T${t.end_time}` : null,
      earnings: t.earnings,
      tips: t.tips,
      distance_km: t.distance_km,
      notes: `Import CSV ${t.platform}`,
    }));

    // Insert in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      const { error } = await supabase.from('trips').insert(chunk);
      if (error) {
        console.error('Import error:', error);
      } else {
        success += chunk.length;
      }
      setProgress(Math.round(((i + chunk.length) / batch.length) * 100));
    }

    setImported(success);
    setImporting(false);
    toast.success(`${success} courses importées sur ${batch.length}`);
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" /> Import CSV Gridwise
        </CardTitle>
        <CardDescription className="text-xs">
          Importez un export CSV Gridwise — les zones sont assignées automatiquement par heure et jour
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* File upload */}
        <label className="flex items-center justify-center gap-2 w-full h-20 rounded-lg border-2 border-dashed border-border bg-background cursor-pointer hover:border-primary/50 transition-colors">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="w-5 h-5" />
            <span className="text-xs">{file ? file.name : 'Cliquez pour uploader un CSV'}</span>
          </div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>

        {/* Preview */}
        {parsed.length > 0 && imported === 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{parsed.length} courses détectées</span>
              <Badge variant="secondary" className="text-xs">
                {parsed.filter(t => t.zone_id).length} avec zone
              </Badge>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {parsed.slice(0, 20).map((t, i) => (
                <div key={i} className="bg-background rounded-md border border-border p-2 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="font-medium">{t.date} {t.start_time}</span>
                    <span className="text-muted-foreground ml-2">{t.zone_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold">${t.earnings.toFixed(2)}</span>
                    {t.distance_km > 0 && <span className="text-muted-foreground">{t.distance_km} km</span>}
                  </div>
                </div>
              ))}
              {parsed.length > 20 && (
                <p className="text-[10px] text-muted-foreground text-center">+{parsed.length - 20} autres courses…</p>
              )}
            </div>

            {importing && <Progress value={progress} className="h-2" />}

            <Button onClick={handleImport} className="w-full gap-2" disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {importing ? `Import en cours… ${progress}%` : `Importer ${parsed.filter(t => t.zone_id).length} courses`}
            </Button>
          </div>
        )}

        {/* Success */}
        {imported > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-foreground">{imported} courses importées avec succès</p>
              <p className="text-muted-foreground">Les données seront utilisées lors de la prochaine analyse IA</p>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
          <p className="font-medium text-foreground">Colonnes supportées</p>
          <p>date, start/time, end, earnings/total/fare, tips, miles/distance, platform</p>
          <p>Les miles sont automatiquement convertis en km</p>
        </div>
      </CardContent>
    </Card>
  );
}
