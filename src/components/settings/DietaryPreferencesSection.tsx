import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Leaf,
  ThumbsDown,
  Moon,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PreferenceListEditor } from './PreferenceListEditor';
import { useSettings } from '@/hooks/useProteinData';
import { cn } from '@/lib/utils';
import type { DietaryPreferences } from '@/types';

// Preset options for quick selection
const ALLERGY_PRESETS = ['Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
const INTOLERANCE_PRESETS = ['Lactose', 'Gluten', 'Fructose', 'Histamine', 'Caffeine'];
const RESTRICTION_PRESETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Keto', 'Low-carb'];
const DISLIKE_PRESETS = ['Mushrooms', 'Olives', 'Cilantro', 'Blue cheese', 'Liver', 'Anchovies'];

// Settings row component (copied from Settings.tsx for consistency)
function SettingsRow({
  icon: Icon,
  iconColor = 'text-muted-foreground',
  label,
  description,
  action,
  onClick,
}: {
  icon?: React.ElementType;
  iconColor?: string;
  label: string;
  description?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex items-center justify-between w-full px-4 py-3 text-left transition-colors',
        onClick && 'hover:bg-muted/50 active:bg-muted cursor-pointer'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={cn('flex-shrink-0', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground truncate">{description}</div>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-3">{action}</div>}
      {onClick && !action && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </Wrapper>
  );
}

// Settings section component (copied from Settings.tsx for consistency)
function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {title && (
        <div className="px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}
      <div className="bg-card rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function formatListSummary(items: string[] | undefined): string {
  if (!items || items.length === 0) return 'None';
  if (items.length <= 2) return items.join(', ');
  return `${items.slice(0, 2).join(', ')} +${items.length - 2} more`;
}

export function DietaryPreferencesSection() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const prefs = settings.dietaryPreferences || {
    allergies: [],
    intolerances: [],
    dietaryRestrictions: [],
    dislikes: [],
    favorites: [],
  };

  const [editingField, setEditingField] = useState<keyof DietaryPreferences | null>(null);
  const [sleepTimeDialogOpen, setSleepTimeDialogOpen] = useState(false);
  const [tempSleepTime, setTempSleepTime] = useState(prefs.sleepTime || '23:00');
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Settings are locked until onboarding has started
  const isLocked = !settings.advisorOnboardingStarted;

  const handleLockedClick = (action: () => void) => {
    if (isLocked) {
      setPendingAction(() => action);
      setLockedDialogOpen(true);
    } else {
      action();
    }
  };

  const handleProceedAnyway = () => {
    // Mark onboarding as started so settings become accessible
    updateSettings({ advisorOnboardingStarted: true });
    setLockedDialogOpen(false);
    // Execute the pending action
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleGoToBuddy = () => {
    setLockedDialogOpen(false);
    navigate('/advisor');
  };

  const updatePreferences = (field: keyof DietaryPreferences, value: string[] | string) => {
    const updated: DietaryPreferences = {
      ...prefs,
      [field]: value,
    };
    updateSettings({ dietaryPreferences: updated });
  };

  const handleSaveSleepTime = () => {
    updatePreferences('sleepTime', tempSleepTime);
    setSleepTimeDialogOpen(false);
  };

  const getEditorConfig = (field: keyof DietaryPreferences) => {
    switch (field) {
      case 'allergies':
        return {
          title: 'Food Allergies',
          description: 'Foods that cause allergic reactions',
          presets: ALLERGY_PRESETS,
        };
      case 'intolerances':
        return {
          title: 'Food Intolerances',
          description: 'Foods that cause digestive issues',
          presets: INTOLERANCE_PRESETS,
        };
      case 'dietaryRestrictions':
        return {
          title: 'Dietary Restrictions',
          description: 'Diets you follow',
          presets: RESTRICTION_PRESETS,
        };
      case 'dislikes':
        return {
          title: 'Foods You Dislike',
          description: 'Foods you prefer to avoid',
          presets: DISLIKE_PRESETS,
        };
      default:
        return { title: '', description: '', presets: [] };
    }
  };

  return (
    <>
      <SettingsSection title="Food Buddy">
        {isLocked && (
          <div className="px-4 py-2 bg-muted/50 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Complete initial setup in Food Buddy to edit
          </div>
        )}
        <SettingsRow
          icon={AlertTriangle}
          iconColor={isLocked ? 'text-muted-foreground' : 'text-red-500'}
          label="Allergies"
          description={formatListSummary(prefs.allergies)}
          onClick={() => handleLockedClick(() => setEditingField('allergies'))}
        />
        <SettingsRow
          icon={Ban}
          iconColor={isLocked ? 'text-muted-foreground' : 'text-orange-500'}
          label="Intolerances"
          description={formatListSummary(prefs.intolerances)}
          onClick={() => handleLockedClick(() => setEditingField('intolerances'))}
        />
        <SettingsRow
          icon={Leaf}
          iconColor={isLocked ? 'text-muted-foreground' : 'text-green-500'}
          label="Dietary Restrictions"
          description={formatListSummary(prefs.dietaryRestrictions)}
          onClick={() => handleLockedClick(() => setEditingField('dietaryRestrictions'))}
        />
        <SettingsRow
          icon={ThumbsDown}
          iconColor={isLocked ? 'text-muted-foreground' : 'text-gray-500'}
          label="Dislikes"
          description={formatListSummary(prefs.dislikes)}
          onClick={() => handleLockedClick(() => setEditingField('dislikes'))}
        />
        <SettingsRow
          icon={Moon}
          iconColor={isLocked ? 'text-muted-foreground' : 'text-indigo-500'}
          label="Sleep Time"
          description={prefs.sleepTime ? `Around ${prefs.sleepTime}` : 'Not set'}
          onClick={() => handleLockedClick(() => {
            setTempSleepTime(prefs.sleepTime || '23:00');
            setSleepTimeDialogOpen(true);
          })}
        />
      </SettingsSection>

      {/* List editors for each preference type */}
      {editingField && editingField !== 'sleepTime' && editingField !== 'additionalNotes' && editingField !== 'favorites' && (
        <PreferenceListEditor
          open={!!editingField}
          onOpenChange={(open) => !open && setEditingField(null)}
          title={getEditorConfig(editingField).title}
          description={getEditorConfig(editingField).description}
          items={(prefs[editingField] as string[]) || []}
          onSave={(items) => updatePreferences(editingField, items)}
          presets={getEditorConfig(editingField).presets}
        />
      )}

      {/* Sleep time dialog */}
      <Dialog open={sleepTimeDialogOpen} onOpenChange={setSleepTimeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-indigo-500" />
              Usual Sleep Time
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              The advisor won't recommend heavy meals within 2 hours of your sleep time.
            </p>
            <Input
              type="time"
              value={tempSleepTime}
              onChange={(e) => setTempSleepTime(e.target.value)}
              className="text-center text-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSleepTimeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSleepTime}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Locked settings dialog */}
      <Dialog open={lockedDialogOpen} onOpenChange={setLockedDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Initial Setup Required
            </DialogTitle>
            <DialogDescription>
              Food Buddy preferences are set up through a quick chat in the Buddy tab. This helps me understand your needs better.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleGoToBuddy} className="w-full">
              Go to Food Buddy
            </Button>
            <Button variant="outline" onClick={handleProceedAnyway} className="w-full">
              Edit here instead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
