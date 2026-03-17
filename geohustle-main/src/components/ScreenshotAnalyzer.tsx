import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useZones } from '@/hooks/useSupabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Upload, MapPin, Flame } from 'lucide-react';
import { toast } from 'sonner';

interface AnalysisResult {
  zones_detected: { area: string; demand: string; surge_multiplier: number | null; color_intensity: string }[];
  overall_demand: string;
  time_context: string;
  notes: string;
}

export function ScreenshotAnalyzer() {
  const { data: mtlZones = [] } = useZones('mtl');
  const { data: lavalZones = [] } = useZones('laval');
  const { data: longueuilZones = [] } = useZones('longueuil');
  const allZones = [...mtlZones, ...lavalZones, ...longueuilZones];

  const [zoneId, setZoneId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop gros (max 10 MB)');
      return;
    }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleAnalyze() {
    if (!file || !zoneId) {
      toast.error('Sélectionnez une zone et un screenshot');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Upload to storage
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('driver-screenshots')
        .upload(fileName, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('driver-screenshots')
        .getPublicUrl(fileName);

      const zoneName = allZones.find(z => z.id === zoneId)?.name || 'Unknown';

      // Call edge function
      const { data, error } = await supabase.functions.invoke('analyze-screenshot', {
        body: { image_url: urlData.publicUrl, zone_id: zoneId, zone_name: zoneName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data.analysis);
      toast.success('Analyse terminée — note sauvegardée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  }

  const demandColor = (d: string) => {
    if (d === 'very_high') return 'destructive';
    if (d === 'high') return 'default';
    if (d === 'medium') return 'secondary';
    return 'outline';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" /> Analyse de screenshot
        </CardTitle>
        <CardDescription className="text-xs">
          Uploadez un screenshot Lyft/Uber pour extraire les zones de surge via l'IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Zone select */}
        <Select value={zoneId} onValueChange={setZoneId}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Zone de référence" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            {allZones.map(z => (
              <SelectItem key={z.id} value={z.id}>
                {z.name} — <span className="text-muted-foreground capitalize">{z.type}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* File upload */}
        <label className="flex items-center justify-center gap-2 w-full h-28 rounded-lg border-2 border-dashed border-border bg-background cursor-pointer hover:border-primary/50 transition-colors">
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-contain rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Upload className="w-6 h-6" />
              <span className="text-xs">Cliquez pour uploader un screenshot</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>

        <Button onClick={handleAnalyze} className="w-full gap-2" disabled={loading || !file || !zoneId}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {loading ? 'Analyse en cours…' : 'Analyser avec l\'IA'}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Résultat de l'analyse</span>
              <Badge variant={demandColor(result.overall_demand)} className="text-xs">
                <Flame className="w-3 h-3 mr-1" />
                {result.overall_demand}
              </Badge>
            </div>

            {result.time_context && (
              <p className="text-xs text-muted-foreground">⏰ {result.time_context}</p>
            )}

            {result.zones_detected?.length > 0 && (
              <div className="space-y-1.5">
                {result.zones_detected.map((z, i) => (
                  <div key={i} className="bg-background rounded-md border border-border p-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs font-medium">{z.area}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {z.surge_multiplier && (
                        <span className="text-xs text-muted-foreground">×{z.surge_multiplier}</span>
                      )}
                      <Badge variant={demandColor(z.demand)} className="text-[10px] px-1.5 py-0">
                        {z.demand}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.notes && (
              <p className="text-xs text-muted-foreground italic">💡 {result.notes}</p>
            )}

            <p className="text-[10px] text-muted-foreground text-center">Note sauvegardée automatiquement dans driver_notes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
