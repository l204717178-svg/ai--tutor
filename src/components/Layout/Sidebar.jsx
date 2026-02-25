import React, { useState, useMemo } from 'react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, FileText, GraduationCap, Settings, ChevronDown, ChevronRight, ChevronLeft, Plus, MessageSquare, Activity, Pencil, Trash2, Sparkles } from 'lucide-react'
import useFileStore from "@/store/useFileStore"
import { clearFileCache } from "@/lib/file-cache"

function NavHistory({ mode, isExpanded, onClose }) {
    // ... remaining NavHistory code stays same
    const history = useFileStore(s => s[mode]?.history || [])
    const sessionId = useFileStore(s => s[mode]?.sessionId)
    const createNewSession = useFileStore(s => s.createNewSession)
    const loadSession = useFileStore(s => s.loadSession)
    const setCurrentMode = useFileStore(s => s.setCurrentMode)
    const renameHistorySession = useFileStore(s => s.renameHistorySession)
    const deleteHistorySession = useFileStore(s => s.deleteHistorySession)
    const [renameTarget, setRenameTarget] = useState(null)
    const [renameValue, setRenameValue] = useState('')

    const sortedHistory = useMemo(() => {
        return [...history].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    }, [history])

    if (!isExpanded) return null;

    const formatRelativeTime = (ts) => {
        if (!ts) return ''
        const diff = Date.now() - ts
        if (diff < 60 * 1000) return 'just now'
        const mins = Math.floor(diff / (60 * 1000))
        if (mins < 60) return `${mins}m`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days}d`
        const weeks = Math.floor(days / 7)
        if (weeks < 4) return `${weeks}w`
        const months = Math.floor(days / 30)
        return `${months}mo`
    }

    return (
        <div className="pl-6 pr-2 py-1 flex flex-col gap-1 bg-muted/30 border-y shadow-inner">
            <Button
                variant="ghost"
                size="sm"
                className="justify-start gap-2 h-8 text-xs text-primary font-medium w-full"
                onClick={() => {
                    createNewSession(mode);
                    setCurrentMode(mode);
                    if (window.innerWidth < 768) onClose?.(); // close sidebar on mobile if existed
                }}
            >
                <Plus className="h-3 w-3" />
                New Session
            </Button>
            {sortedHistory.map((h, i) => (
                <div key={h.sessionId} className="grid grid-cols-[1fr_auto] items-center gap-1 w-full min-w-0">
                    <div className="relative group min-w-0">
                        <Button
                            variant={sessionId === h.sessionId ? "secondary" : "ghost"}
                            size="sm"
                            className="justify-start h-8 text-xs font-normal text-muted-foreground hover:text-foreground w-full min-w-0"
                            onClick={() => {
                                loadSession(mode, h.sessionId);
                                setCurrentMode(mode);
                            }}
                            title={h.sessionTitle}
                        >
                            <MessageSquare className="h-3 w-3 mr-2 shrink-0" />
                            <span className="truncate">{h.sessionTitle || `Session ${sortedHistory.length - i}`}</span>
                        </Button>
                        <div className="pointer-events-none absolute left-6 top-full mt-1 z-50 hidden max-w-[280px] rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-md group-hover:block">
                            <div className="whitespace-normal break-words">
                                {h.sessionTitle || `Session ${sortedHistory.length - i}`}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground/70 w-8 text-right">
                            {formatRelativeTime(h.updatedAt || h.createdAt)}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                                e.stopPropagation()
                                setRenameTarget({ sessionId: h.sessionId, title: h.sessionTitle || '' })
                                setRenameValue(h.sessionTitle || '')
                            }}
                            title="Rename"
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm('Delete this session history?')) {
                                    deleteHistorySession(mode, h.sessionId)
                                }
                            }}
                            title="Delete"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            ))}
            {history.length === 0 && (
                <div className="text-xs text-muted-foreground/50 px-3 py-2 text-center">No history format</div>
            )}

            {renameTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-[320px] rounded-lg bg-background p-4 shadow-lg border">
                        <h3 className="text-sm font-semibold mb-2">Rename session</h3>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder="Enter session title"
                            className="text-sm"
                            autoFocus
                        />
                        <div className="mt-3 flex items-center gap-2 justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setRenameTarget(null)
                                    setRenameValue('')
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (renameTarget?.sessionId) {
                                        renameHistorySession(mode, renameTarget.sessionId, renameValue)
                                    }
                                    setRenameTarget(null)
                                    setRenameValue('')
                                }}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function TokenWidget() {
    const tokensUsed = useFileStore(s => s.tokensUsed || 0);
    const MAX_TOKENS = 2000000; // 2M limit assumption

    const percentage = Math.min((tokensUsed / MAX_TOKENS) * 100, 100);

    let progressColor = "bg-primary";
    if (percentage > 80) progressColor = "bg-orange-500";
    if (percentage > 95) progressColor = "bg-destructive";

    const formatTokens = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="px-4 py-3 border-t bg-muted/10">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Token Usage
                </span>
                <span className="text-xs font-medium">{formatTokens(tokensUsed)} / 2M</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500", progressColor)}
                    style={{ width: percentage + '%' }}
                />
            </div>
        </div>
    );
}

export function Sidebar({ collapsed = false, onToggle }) {
    const { currentMode, setCurrentMode } = useFileStore()
    const [expandedMenu, setExpandedMenu] = useState(null)
    const [showSettings, setShowSettings] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [clearOptions, setClearOptions] = useState({
        files: true,
        history: false,
        tokens: false,
    })

    const clearFilePoolAndReferences = useFileStore((s) => s.clearFilePoolAndReferences)
    const clearChatsAndHistory = useFileStore((s) => s.clearChatsAndHistory)
    const resetTokensUsed = useFileStore((s) => s.resetTokensUsed)

    const navItems = [
        { mode: 'study', label: 'Study Mode', icon: BookOpen },
        { mode: 'assignment', label: 'Assignment Help', icon: FileText },
        { mode: 'revision', label: 'Revision & Exam', icon: GraduationCap },
    ]

    const toggleMenu = (mode, e) => {
        e.stopPropagation()
        setExpandedMenu(prev => prev === mode ? null : mode)
    }

    return (
        <div className="flex flex-col h-full">
            <div className={cn("border-b", collapsed ? "px-2 py-3" : "p-4")}>
                <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
                    <div className={cn("flex items-center gap-2 min-w-0", collapsed && "justify-center")}>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent truncate">UniPilot AI</h1>
                                <p className="text-xs text-muted-foreground truncate">Academic Assistant</p>
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onToggle}
                            title="Collapse sidebar"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                {collapsed && (
                    <div className="mt-2 flex justify-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onToggle}
                            title="Expand sidebar"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <ScrollArea className={cn("flex-1 py-4", collapsed ? "px-1" : "px-2")}>
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => (
                        <div key={item.mode} className="flex flex-col">
                            <div className="flex items-center">
                                <Button
                                    variant={currentMode === item.mode ? "secondary" : "ghost"}
                                    className={cn("flex-1 overflow-hidden", collapsed ? "justify-center" : "justify-start gap-3")}
                                    onClick={() => setCurrentMode(item.mode)}
                                    title={item.label}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    {!collapsed && <span className="truncate">{item.label}</span>}
                                </Button>
                                {!collapsed && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 shrink-0 ml-1 text-muted-foreground"
                                        onClick={(e) => toggleMenu(item.mode, e)}
                                    >
                                        {expandedMenu === item.mode ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                            {!collapsed && <NavHistory mode={item.mode} isExpanded={expandedMenu === item.mode} />}
                        </div>
                    ))}
                </nav>
            </ScrollArea>

            <div className="mt-auto">
                {!collapsed && <TokenWidget />}
                <div className={cn("border-t", collapsed ? "p-2" : "p-4")}>
                    <Button
                        variant="ghost"
                        className={cn("w-full", collapsed ? "justify-center" : "justify-start gap-3")}
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                    >
                        <Settings className="h-4 w-4" />
                        {!collapsed && "Settings"}
                    </Button>
                </div>
            </div>

            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-[420px] max-w-[90vw] rounded-lg bg-background p-4 shadow-lg border">
                        <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">设置</h3>
                        <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                            关闭
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                        请选择要清理的本地缓存。此操作不可撤销。
                    </p>

                        <div className="space-y-2">
                            <label className="flex items-center gap-3 text-sm">
                                <Checkbox
                                    checked={clearOptions.files}
                                    onCheckedChange={(v) => setClearOptions(s => ({ ...s, files: Boolean(v) }))}
                                />
                                <span>已上传文件缓存（PDF/PPT）</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm">
                                <Checkbox
                                    checked={clearOptions.history}
                                    onCheckedChange={(v) => setClearOptions(s => ({ ...s, history: Boolean(v) }))}
                                />
                                <span>会话历史与聊天记录</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm">
                                <Checkbox
                                    checked={clearOptions.tokens}
                                    onCheckedChange={(v) => setClearOptions(s => ({ ...s, tokens: Boolean(v) }))}
                                />
                                <span>Token 使用统计</span>
                            </label>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setClearOptions({ files: true, history: true, tokens: true })}
                        >
                            全选
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setClearOptions({ files: false, history: false, tokens: false })}
                            >
                                清空选择
                            </Button>
                            <Button
                                size="sm"
                                disabled={isClearing || (!clearOptions.files && !clearOptions.history && !clearOptions.tokens)}
                                onClick={async () => {
                                        setIsClearing(true)
                                        try {
                                            if (clearOptions.files) {
                                                await clearFileCache()
                                                clearFilePoolAndReferences()
                                            }
                                            if (clearOptions.history) {
                                                clearChatsAndHistory()
                                            }
                                            if (clearOptions.tokens) {
                                                resetTokensUsed()
                                            }
                                            setShowSettings(false)
                                        } finally {
                                            setIsClearing(false)
                                        }
                                    }}
                                >
                                {isClearing ? "清理中..." : "清理所选"}
                            </Button>
                        </div>
                    </div>
                    </div>
                </div>
            )}
        </div>
    )
}
