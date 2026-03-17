import { useState, lazy, Suspense } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { CitySelect } from '@/components/CitySelect';
import { useCities, useZones, useAddZone, useUpdateZone, useDeleteZone, type Zone } from '@/hooks/useSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Constants } from '@/integrations/supabase/types';
const MapboxHeatmap = lazy(() => import('@/components/MapboxHeatmap'));
import { useCityId } from '@/hooks/useCityId';
import { ZonePerformanceHeatmap } from '@/components/ZonePerformanceHeatmap';

const ZONE_TYPES = Constants.public.Enums.zone_type;

const CITY_CENTERS: Record<string, [number, number]> = {
  mtl: [45.5017, -73.5673],
  qc: [46.8139, -71.2080],
  ott: [45.4215, -75.6972],
};

export default function ZonesScreen() {
  const { t } = useI18n();
  const [cityId, setCityId] = useCityId();
  const { data: cities = [] } = useCities();
  const { data: zones = [] } = useZones(cityId);
  const addZone = useAddZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();

  const [editing, setEditing] = useState<Zone | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'commercial' as string, latitude: '', longitude: '' });

  function openAdd() {
    setEditing(null);
    setForm({ name: '', type: 'commercial', latitude: '', longitude: '' });
    setShowDialog(true);
  }

  function openEdit(zone: Zone) {
    setEditing(zone);
    setForm({ name: zone.name, type: zone.type, latitude: String(zone.latitude), longitude: String(zone.longitude) });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.name || !form.latitude || !form.longitude) return;
    try {
      if (editing) {
        await updateZone.mutateAsync({
          id: editing.id,
          name: form.name,
          type: form.type,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
        });
      } else {
        await addZone.mutateAsync({
          city_id: cityId,
          name: form.name,
          type: form.type as any,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
        });
      }
      toast.success(t('save'));
      setShowDialog(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteZone.mutateAsync(id);
      toast.success(t('deleteZone'));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const mapCenter = zones.length > 0
    ? [zones[0].latitude, zones[0].longitude] as [number, number]
    : CITY_CENTERS[cityId] ?? CITY_CENTERS.mtl;

  const mapMarkers = zones.map(zone => ({
    id: zone.id,
    name: zone.name,
    type: zone.type,
    latitude: zone.latitude,
    longitude: zone.longitude,
  }));

  return (
    <div className="flex flex-col h-full pb-36">
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold">{t('zones')}</h1>
          <Button size="sm" onClick={openAdd} className="gap-1"><Plus className="w-4 h-4" /> {t('addZone')}</Button>
        </div>
        <CitySelect cities={cities} value={cityId} onChange={setCityId} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="relative z-[1] h-[220px] w-full overflow-hidden rounded-lg border border-border">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Chargement de la carte…</div>
            }
          >
            <MapboxHeatmap center={mapCenter} zoom={11} markers={mapMarkers} />
          </Suspense>
        </div>

        {/* Performance Heatmap */}
        <div className="relative z-[1] mt-4">
          <ZonePerformanceHeatmap zones={zones} />
        </div>

        <div className="relative z-[1] mt-4 space-y-2">
          {zones.map(zone => (
            <div key={zone.id} className="flex items-center justify-between bg-card rounded-md border border-border px-3 py-2 gap-2">
              <div className="min-w-0">
                <span className="text-sm font-display font-medium break-words block">{zone.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{zone.type}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(zone)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(zone.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? t('editZone') : t('addZone')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t('name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background border-border" />
            <Select value={form.type} onValueChange={value => setForm(f => ({ ...f, type: value }))}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ZONE_TYPES.map(zoneType => <SelectItem key={zoneType} value={zoneType}>{zoneType}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={t('latitude')} value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} className="bg-background border-border" />
              <Input placeholder={t('longitude')} value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
