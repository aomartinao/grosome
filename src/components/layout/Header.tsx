import { Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function Header() {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Today';
      case '/chat':
        return 'Log Food';
      case '/history':
        return 'History';
      case '/settings':
        return 'Settings';
      default:
        return 'Protee';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-top">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-semibold text-primary">{getTitle()}</h1>
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
