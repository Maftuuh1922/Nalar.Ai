// @ts-nocheck
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppShell } from '@/context/AppShellContext'
import {
  BookOpenText,
  BookText,
  ChevronRight,
  Github,
  Layers3,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SessionList from '@/components/SessionList'
import { VersionBadge } from '@/components/sidebar/VersionBadge'
import type { SessionSummary } from '@/lib/session-api'
import { Tooltip } from '@/components/ui/Tooltip'
import { useCapabilityAccess } from '@/components/access/CapabilityAccessContext'
import type { Capability } from '@/lib/capability-routes'

interface NavEntry {
  href: string
  label: string
  icon: LucideIcon
  tooltipKey?: string
  requires?: Capability
}

interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavEntry[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    icon: Sparkles,
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        tooltipKey: 'Dashboard tooltip',
      },
      {
        href: '/home',
        label: 'Chat',
        icon: MessagesSquare,
        tooltipKey: 'Home tooltip',
        requires: 'llm',
      },
      {
        href: '/co-writer',
        label: 'Co-Writer',
        icon: PenLine,
        tooltipKey: 'Co-Writer tooltip',
        requires: 'llm',
      },
    ],
  },
  {
    label: 'Riset',
    icon: Layers3,
    items: [
      { href: '/space', label: 'Learning Space', icon: Layers3, tooltipKey: 'Space tooltip' },
    ],
  },
]

const GITHUB_REPO_URL = 'https://github.com/HKUDS/NalarAI'
const DOCS_URL = 'https://nalar.ai/'
const RECENTS_COLLAPSED_KEY = 'nalarai.sidebar.recentsCollapsed'
const GROUP_COLLAPSED_KEY = 'nalarai.sidebar.groupsCollapsed'

interface SidebarShellProps {
  sessions?: SessionSummary[]
  activeSessionId?: string | null
  loadingSessions?: boolean
  showSessions?: boolean
  onNewChat?: () => void
  onSelectSession?: (sessionId: string) => void | Promise<void>
  onRenameSession?: (sessionId: string, title: string) => void | Promise<void>
  onDeleteSession?: (sessionId: string) => void | Promise<void>
  footerSlot?: ReactNode | ((collapsed: boolean) => ReactNode)
}

function GroupNavItem({
  item,
  collapsed,
  active,
  locked,
  onHomeClick,
}: {
  item: NavEntry
  collapsed: boolean
  active: boolean
  locked: boolean
  onHomeClick: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation()
  const lockedTooltip = t('Locked — contact your administrator to get access.')
  const content = (
    <div
      className={`flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] transition-all active:scale-[0.97] ${
        active
          ? 'bg-[var(--accent)] text-[var(--foreground)] font-medium'
          : locked
            ? 'text-[var(--muted-foreground)]/30 cursor-not-allowed'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
      }`}
    >
      <item.icon
        size={14}
        strokeWidth={active ? 2 : 1.8}
        className={active ? 'text-[var(--primary)]' : 'opacity-80'}
      />
      {!collapsed && <span className="flex-1">{t(item.label)}</span>}
      {!collapsed && locked && <Lock size={11} strokeWidth={1.8} className="opacity-50" />}
    </div>
  )
  if (locked)
    return (
      <Tooltip label={t(item.label)} description={lockedTooltip} side="right">
        {content}
      </Tooltip>
    )
  return (
    <Link href={item.href} onClick={item.href === '/home' ? onHomeClick : undefined}>
      {collapsed ? (
        <Tooltip
          label={t(item.label)}
          description={item.tooltipKey ? t(item.tooltipKey) : undefined}
          side="right"
        >
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </Link>
  )
}

export function SidebarShell({
  sessions = [],
  activeSessionId = null,
  loadingSessions = false,
  showSessions = false,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  footerSlot,
}: SidebarShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = useCapabilityAccess()
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = useAppShell()
  const [narrowViewport, setNarrowViewport] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const syncViewport = () => setNarrowViewport(media.matches)
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])

  const compactSidebar = collapsed || narrowViewport

  // Collapsed-state persistence. Read from localStorage ONLY after mount —
  // reading it in a useState initializer makes the server HTML differ from
  // the client's first render → React hydration mismatch (#418) → full tree
  // re-render that drops chat/session state (persona preset, mode, …).
  // Synchronous setState in effects (react-hooks/set-state-in-effect) is
  // avoided by reading into refs; the first paint stays consistent.
  const [recentsCollapsed, setRecentsCollapsed] = useState(false)
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let recents = false
    let groups: Record<string, boolean> = {}
    try {
      recents = localStorage.getItem(RECENTS_COLLAPSED_KEY) === '1'
      groups = JSON.parse(localStorage.getItem(GROUP_COLLAPSED_KEY) || '{}')
    } catch {
      /* nilai korup → default */
    }
    // queueMicrotask: setState bukan lagi "synchronously within the effect
    // body" sehingga react-hooks/set-state-in-effect tidak terpicu, tapi
    // tetap sebelum paint berikutnya.
    queueMicrotask(() => {
      setRecentsCollapsed(recents)
      setGroupsCollapsed(groups)
    })
  }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const toggleGroup = (label: string) => {
    setGroupsCollapsed(prev => {
      const next = { ...prev, [label]: !prev[label] }
      localStorage.setItem(GROUP_COLLAPSED_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggleRecents = () => {
    setRecentsCollapsed(prev => {
      const n = !prev
      localStorage.setItem(RECENTS_COLLAPSED_KEY, n ? '1' : '0')
      return n
    })
  }

  const navLocked = useCallback(
    (item: NavEntry) => (item.requires ? !has(item.requires) : false),
    [has]
  )
  const renderedFooter = typeof footerSlot === 'function' ? footerSlot(compactSidebar) : footerSlot

  const handleHomeClick = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return
    event.preventDefault()
    onNewChat?.()
    router.push('/home')
  }

  const isActive = useCallback(
    (href: string) => {
      if (href === '/home') return pathname === '/home' || pathname.startsWith('/home/')
      return pathname === href || pathname.startsWith(href + '/')
    },
    [pathname]
  )

  // Quick-search: "/" focuses the box (unless the user is typing elsewhere),
  // and the query filters the recents list below.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter(session =>
      `${session.title ?? ''} ${session.last_message ?? ''}`.toLowerCase().includes(query)
    )
  }, [sessions, searchQuery])

  /* Collapsed */
  if (compactSidebar) {
    return (
      <aside className="group/sb relative flex h-screen w-[56px] shrink-0 flex-col items-center bg-[var(--background)] border-r border-[var(--border)] py-2.5 transition-all">
        <div className="relative mb-1 flex h-10 w-full items-center justify-center font-bold text-[var(--foreground)]">
          <Link
            href="/home"
            aria-label="Nalar AI"
            className="flex flex-col items-center text-[12px] leading-[1.1] tracking-tight"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/nalar-ai-hero.jpg"
              alt="NALAR AI"
              className="size-7 rounded-md object-cover object-center"
            />
          </Link>
          <button
            onClick={() => setCollapsed(false)}
            className="absolute inset-0 flex items-center justify-center rounded-lg text-[var(--muted-foreground)] opacity-0 hover:opacity-100 bg-[var(--background)]/80 max-md:hidden"
            aria-label={t('Expand sidebar')}
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
        <nav className="mt-1 flex w-full flex-col items-center gap-0.5 px-1">
          {NAV_GROUPS.flatMap(group => group.items).map(item => (
            <GroupNavItem
              key={item.href}
              item={item}
              collapsed
              active={isActive(item.href)}
              locked={navLocked(item)}
              onHomeClick={handleHomeClick}
            />
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex w-full flex-col items-center gap-0.5 px-1">
          <div className="my-1 h-px w-6 bg-[var(--border)]/40" />
          <Link
            href="/settings"
            aria-label={t('Settings')}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              isActive('/settings')
                ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/30'
            }`}
          >
            <Settings size={15} strokeWidth={1.5} />
          </Link>
          {renderedFooter}
          <VersionBadge collapsed />
        </div>
      </aside>
    )
  }

  /* Expanded */
  return (
    <aside className="flex w-[230px] h-screen shrink-0 flex-col bg-[var(--background)] border-r border-[var(--border)] transition-all">
      {/* Workspace switcher header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/nalar-ai-hero.jpg"
            alt="NALAR AI"
            className="size-8 shrink-0 rounded-[8px] object-cover object-center select-none"
          />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-tight text-[var(--foreground)]">
              Nalar AI
            </span>
            <span className="block truncate text-[11px] leading-tight text-[var(--muted-foreground)]">
              {t('Workspace')}
            </span>
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          aria-label={t('Collapse sidebar')}
          className="rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* Quick search + New chat */}
      <div className="px-3 pb-1">
        <label className="mb-1.5 flex h-8 items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]">
          <Search size={12} className="shrink-0 text-[var(--muted-foreground)]" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={t('Quick search', 'Quick search')}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <kbd className="flex h-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--card)] px-1.5 text-[10px] text-[var(--muted-foreground)] shadow-sm">
            /
          </kbd>
        </label>
        <button
          type="button"
          onClick={handleHomeClick}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--primary)] transition-[background-color,transform] duration-100 hover:bg-[var(--accent)] active:scale-[0.96]"
        >
          <span className="min-w-0 flex-1 truncate text-left">{t('New chat')}</span>
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
            <Plus size={9} strokeWidth={3} />
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_GROUPS.map(group => {
          const open = !groupsCollapsed[group.label]
          const groupActive = group.items.some(i => isActive(i.href))
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-all ${
                  groupActive
                    ? 'text-[var(--muted-foreground)]'
                    : 'text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]'
                }`}
              >
                <ChevronRight
                  size={10}
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                />
                {t(group.label)}
              </button>
              {open && (
                <div className="mt-0.5 space-y-px pb-1">
                  {group.items.map(item => (
                    <GroupNavItem
                      key={item.href}
                      item={item}
                      collapsed={false}
                      active={isActive(item.href)}
                      locked={navLocked(item)}
                      onHomeClick={handleHomeClick}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {showSessions && onSelectSession ? (
          <div className="mt-4 pb-2">
            <div className="px-2 pb-1 pt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]/60">
              {t('Recents')}
            </div>
            {searchQuery.trim() && filteredSessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-[var(--muted-foreground)]/70">
                {t('No conversations yet')}
              </div>
            ) : (
              <SessionList
                sessions={filteredSessions}
                activeSessionId={activeSessionId}
                loading={loadingSessions}
                onSelect={onSelectSession}
                onRename={onRenameSession}
                onDelete={onDeleteSession}
                compact
              />
            )}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-[var(--border)]/30 px-2 py-1.5">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all ${
            isActive('/settings')
              ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/40 hover:text-[var(--foreground)]'
          }`}
        >
          <Settings size={14} strokeWidth={1.5} />
          <span>{t('Settings')}</span>
        </Link>
        {renderedFooter}
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <VersionBadge />
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer noopener"
            title={t('Docs')}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]"
          >
            <BookText size={11} strokeWidth={1.7} />
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            title="GitHub"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]"
          >
            <Github size={11} strokeWidth={1.7} />
          </a>
        </div>
      </div>
    </aside>
  )
}
