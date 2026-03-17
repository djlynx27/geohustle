import { NavLink } from 'react-router-dom';
import { Calendar, Map, Layers, Settings, PartyPopper, Car } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

const navItems = [
  { path: '/', icon: Calendar, label: 'today' },
  { path: '/drive', icon: Car, label: 'drive' },
  { path: '/planning', icon: Map, label: 'planning' },
  { path: '/events', icon: PartyPopper, label: 'events' },
  { path: '/zones', icon: Layers, label: 'zones' },
  { path: '/admin', icon: Settings, label: 'admin' },
] as const;

export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 min-w-[56px] py-2 text-[11px] font-body transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
