import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useZones, type Zone } from '@/hooks/useSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, DollarSign, Loader2, Plus, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

function useRecentTrips() {
  return useQuery({
    queryKey: ['recent-trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*, zones(name)')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

function useAddTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trip: {
      zone_id: string;
      started_at: string;
      ended_at: string;
      earnings: number;
      tips: number;
      distance_km: number;
      notes: string;
      platform: string | null;
      experiment?: boolean;
    }) => {
      const { error } = await supabase.from('trips').insert(trip as any);
      if (error) throw error;
      return trip.zone_id;
    },
    onSuccess: async (zoneId) => {
      qc.invalidateQueries({ queryKey: ['recent-trips'] });
      toast.success('Course enregistrée');

      // Trigger partial AI rescore for this zone only
      try {
        const { error } = await supabase.functions.invoke('ai-score-analysis', {
          body: { zone_id: zoneId },
        });
        if (!error) {
          qc.invalidateQueries({ queryKey: ['zone-scores'] });
          toast.info('Score de zone mis à jour via IA');
        }
      } catch {
        // Non-blocking: don't fail if AI rescore fails
      }
    },
  });
}

export function TripLogger() {
  const { data: zones = [] } = useZones('mtl');
  const { data: lavalZones = [] } = useZones('laval');
  const { data: longueuilZones = [] } = useZones('longueuil');
  const allZones = [...zones, ...lavalZones, ...longueuilZones];

  const { data: recentTrips = [] } = useRecentTrips();
  const addTrip = useAddTrip();

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    zone_id: '',
    date: today,
    start_time: '08:00',
    end_time: '09:00',
    earnings: '',
    tips: '',
    distance_km: '',
    notes: '',
    platform: '',
  });

  function updateField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.zone_id || !form.date || !form.earnings) {
      toast.error('Zone, date et montant requis');
      return;
    }
    const started_at = `${form.date}T${form.start_time}:00`;
    const ended_at = `${form.date}T${form.end_time}:00`;
    await addTrip.mutateAsync({
      zone_id: form.zone_id,
      started_at,
      ended_at,
      earnings: parseFloat(form.earnings) || 0,
      tips: parseFloat(form.tips) || 0,
      distance_km: parseFloat(form.distance_km) || 0,
      notes: form.notes.trim().slice(0, 500),
      platform: form.platform || null,
    });
    setForm(f => ({ ...f, earnings: '', tips: '', distance_km: '', notes: '' }));
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Journal de courses
        </CardTitle>
        <CardDescription className="text-xs">Enregistrer manuellement une course</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Zone select */}
        <Select value={form.zone_id} onValueChange={v => updateField('zone_id', v)}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Sélectionner une zone" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            {allZones.map(z => (
              <SelectItem key={z.id} value={z.id}>
                {z.name} — <span className="text-muted-foreground capitalize">{z.type}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date + times */}
        <div className="grid grid-cols-3 gap-2">
          <Input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} className="bg-background border-border" />
          <Input type="time" value={form.start_time} onChange={e => updateField('start_time', e.target.value)} className="bg-background border-border" />
          <Input type="time" value={form.end_time} onChange={e => updateField('end_time', e.target.value)} className="bg-background border-border" />
        </div>

        {/* Platform */}
        <Select value={form.platform} onValueChange={v => updateField('platform', v)}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Plateforme (Uber, Lyft, Skip...)" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            <SelectItem value="uber">Uber</SelectItem>
            <SelectItem value="lyft">Lyft</SelectItem>
            <SelectItem value="skip">SkipTheDishes</SelectItem>
            <SelectItem value="doordash">DoorDash</SelectItem>
            <SelectItem value="eva">Eva</SelectItem>
            <SelectItem value="taxi">Taxi / Taxi Fantôme</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>

        {/* Earnings + tips + distance */}
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" step="0.01" placeholder="Gains $" value={form.earnings} onChange={e => updateField('earnings', e.target.value)} className="bg-background border-border" />
          <Input type="number" step="0.01" placeholder="Tips $" value={form.tips} onChange={e => updateField('tips', e.target.value)} className="bg-background border-border" />
          <Input type="number" step="0.1" placeholder="km" value={form.distance_km} onChange={e => updateField('distance_km', e.target.value)} className="bg-background border-border" />
        </div>

        {/* Notes */}
        <Textarea placeholder="Notes (optionnel)" value={form.notes} onChange={e => updateField('notes', e.target.value)} className="bg-background border-border h-16 resize-none" maxLength={500} />

        <Button onClick={handleSubmit} className="w-full gap-2" disabled={addTrip.isPending}>
          {addTrip.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Enregistrer la course
        </Button>

        {/* Recent trips */}
        {recentTrips.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium text-foreground">10 dernières courses</p>
            {recentTrips.map((trip: any) => (
              <div key={trip.id} className="bg-background rounded-lg border border-border p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-display font-semibold truncate">
                    {trip.zones?.name || 'Zone inconnue'}
                  </span>
                  <div className="flex items-center gap-1">
                    {trip.platform && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <Smartphone className="w-3 h-3 mr-0.5" />
                        {String(trip.platform)}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <DollarSign className="w-3 h-3 mr-0.5" />
                      {Number(trip.earnings || 0).toFixed(2)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(trip.started_at)}–{trip.ended_at ? formatTime(trip.ended_at) : '?'}
                  </span>
                  {trip.distance_km > 0 && <span>{Number(trip.distance_km).toFixed(1)} km</span>}
                  {trip.tips > 0 && <span>+${Number(trip.tips).toFixed(2)} tips</span>}
                </div>
                {trip.notes && <p className="text-xs text-muted-foreground italic truncate">{trip.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
