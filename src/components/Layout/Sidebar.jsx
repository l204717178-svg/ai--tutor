import React, { useState } from 'react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, FileText, GraduationCap, Settings, ChevronDown, ChevronRight, Plus, MessageSquare } from 'lucide-react'
import useFileStore from "@/store/useFileStore"

function NavHistory({ mode, isExpanded, onClose }) {
    const history = useFileStore(s => s[mode]?.history || [])
    const sessionId = useFileStore(s => s[mode]?.sessionId)
    const createNewSession = useFileStore(s => s.createNewSession)
    const loadSession = useFileStore(s => s.loadSession)
    const setCurrentMode = useFileStore(s => s.setCurrentMode)

    if (!isExpanded) return null;

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
            {history.map((h, i) => (
                <Button
                    key={h.sessionId}
                    variant={sessionId === h.sessionId ? "secondary" : "ghost"}
                    size="sm"
                    className="justify-start h-8 text-xs font-normal text-muted-foreground hover:text-foreground w-full truncate"
                    onClick={() => {
                        loadSession(mode, h.sessionId);
                        setCurrentMode(mode);
                    }}
                    title={h.sessionTitle}
                >
                    <MessageSquare className="h-3 w-3 mr-2 shrink-0" />
                    <span className="truncate">{h.sessionTitle || `Session ${history.length - i}`}</span>
                </Button>
            ))}
            {history.length === 0 && (
                <div className="text-xs text-muted-foreground/50 px-3 py-2 text-center">No history format</div>
            )}
        </div>
    )
}

export function Sidebar() {
    const { currentMode, setCurrentMode } = useFileStore()
    const [expandedMenu, setExpandedMenu] = useState(null)

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
            <div className="p-4 border-b">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">UniPilot AI</h1>
                <p className="text-xs text-muted-foreground">Academic Assistant</p>
            </div>

            <ScrollArea className="flex-1 px-2 py-4">
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => (
                        <div key={item.mode} className="flex flex-col">
                            <div className="flex items-center">
                                <Button
                                    variant={currentMode === item.mode ? "secondary" : "ghost"}
                                    className="justify-start gap-3 flex-1 overflow-hidden"
                                    onClick={() => setCurrentMode(item.mode)}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 ml-1 text-muted-foreground"
                                    onClick={(e) => toggleMenu(item.mode, e)}
                                >
                                    {expandedMenu === item.mode ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                            </div>
                            <NavHistory mode={item.mode} isExpanded={expandedMenu === item.mode} />
                        </div>
                    ))}
                </nav>
            </ScrollArea>

            <div className="p-4 border-t mt-auto">
                <Button variant="ghost" className="w-full justify-start gap-3">
                    <Settings className="h-4 w-4" />
                    Settings
                </Button>
            </div>
        </div>
    )
}
