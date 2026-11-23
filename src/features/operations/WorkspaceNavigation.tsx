import { useSyncExternalStore, type KeyboardEvent } from 'react';
import { CalendarDays, ClipboardList, History, House, Package, Settings, Users } from 'lucide-react';

export type WorkspaceTab = readonly [id: string, label: string];

const tabIcons: Record<string, typeof House> = {
  home: House,
  today: Users,
  inventory: Package,
  agenda: CalendarDays,
  treatment: ClipboardList,
  history: History,
};

const tabId = (id: string, tab: string) => `${id}-tab-${tab}`;
export const workspacePanelId = (id: string) => `${id}-panel`;
export const workspaceTabId = tabId;

interface WorkspaceNavigationProps {
  id: string;
  tabs: readonly WorkspaceTab[];
  selected: string;
  sidebar?: boolean;
  verticalOnDesktop?: boolean;
  externalTab?: string;
  onSelect: (tab: string) => void;
}

function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, id: string, tabs: readonly WorkspaceTab[], value: string) {
  const index = tabs.findIndex(([tab]) => tab === value);
  let next: number;
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown': next = (index + 1) % tabs.length; break;
    case 'ArrowLeft':
    case 'ArrowUp': next = (index - 1 + tabs.length) % tabs.length; break;
    case 'Home': next = 0; break;
    case 'End': next = tabs.length - 1; break;
    default: return;
  }

  event.preventDefault();
  // Navigation is manual so moving focus never bypasses unsaved-change prompts.
  document.getElementById(tabId(id, tabs[next][0]))?.focus();
}

function TabButton({
  id, item, tabs, selected, showIcon, className, onSelect,
}: Pick<WorkspaceNavigationProps, 'id' | 'tabs' | 'selected' | 'onSelect'> & {
  item: WorkspaceTab;
  showIcon?: boolean;
  className?: string;
}) {
  const [value, label] = item;
  const Icon = tabIcons[value] ?? Settings;

  return (
    <button
      type="button"
      className={className}
      id={tabId(id, value)}
      role="tab"
      aria-selected={selected === value}
      aria-controls={workspacePanelId(id)}
      tabIndex={selected === value ? 0 : -1}
      onClick={() => onSelect(value)}
      onKeyDown={event => handleTabKey(event, id, tabs, value)}
    >
      {showIcon && <Icon size={18} aria-hidden="true" />}
      {label}
    </button>
  );
}

function subscribeToWideViewport(onChange: () => void) {
  const query = window.matchMedia('(min-width: 1024px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function hasWideViewport() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

export function WorkspaceNavigation({ id, tabs, selected, sidebar, verticalOnDesktop, externalTab, onSelect }: WorkspaceNavigationProps) {
  const wideViewport = useSyncExternalStore(subscribeToWideViewport, hasWideViewport, () => false);

  return (
    <div className="op-workspace-navigation">
      <div
        id={sidebar ? 'dispensary-sections' : undefined}
        className={`op-tabs op-workspace-tabs${sidebar ? ' op-sidebar' : ''}`}
        role="tablist"
        aria-label="Secciones del panel"
        aria-owns={externalTab ? tabId(id, externalTab) : undefined}
        aria-orientation={wideViewport && verticalOnDesktop ? 'vertical' : 'horizontal'}
      >
        {tabs.filter(([value]) => value !== externalTab).map(item => (
          <TabButton key={item[0]} id={id} item={item} tabs={tabs} selected={selected} showIcon={verticalOnDesktop} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function WorkspaceHeaderTab({ id, item, tabs, selected, onSelect }: Pick<WorkspaceNavigationProps, 'id' | 'tabs' | 'selected' | 'onSelect'> & { item: WorkspaceTab }) {
  return <TabButton id={id} item={item} tabs={tabs} selected={selected} showIcon className="op-management-tab" onSelect={onSelect} />;
}
