import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import { Navigation } from 'lucide-react';
import { getGoogleMapsNavUrl, getWazeNavUrl } from '@/lib/venueCoordinates';

interface NavigationSheetProps {
  open: boolean;
  onClose: () => void;
  zoneName: string;
  latitude: number;
  longitude: number;
}

export function NavigationSheet({ open, onClose, zoneName, latitude, longitude }: NavigationSheetProps) {
  const { t } = useI18n();

  const googleUrl = getGoogleMapsNavUrl(zoneName, latitude, longitude);
  const wazeUrl = getWazeNavUrl(zoneName, latitude, longitude);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4 bg-card border-border">
        <SheetHeader>
          <SheetTitle className="font-display text-[22px] text-foreground">{zoneName}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button asChild className="w-full gap-2 text-[18px] font-display font-bold h-16 bg-primary text-primary-foreground hover:bg-primary/90">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="w-5 h-5" />
              🗺️ GO – Google Maps
            </a>
          </Button>
          <Button asChild variant="secondary" className="w-full gap-2 text-[18px] font-display font-bold h-16">
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
              🧭 Waze
            </a>
          </Button>
          <Button variant="outline" className="w-full text-[18px] h-16 font-display" onClick={onClose}>
            ✕ {t('close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
