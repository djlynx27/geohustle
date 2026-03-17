import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/contexts/I18nContext';

interface CitySelectProps {
  cities: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}

export function CitySelect({ cities, value, onChange }: CitySelectProps) {
  const { t } = useI18n();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full bg-card border-border">
        <SelectValue placeholder={t('selectCity')} />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {cities.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
