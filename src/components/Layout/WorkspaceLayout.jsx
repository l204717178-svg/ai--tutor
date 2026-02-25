import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sidebar } from "@/components/Layout/Sidebar"
import useFileStore from "@/store/useFileStore"
import { ChatInterface } from "@/components/Chat/ChatInterface"

export function WorkspaceLayout({ children }) {
    const { currentMode, setCurrentMode } = useFileStore()
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)
    const SIDEBAR_WIDTH = 280
    const SIDEBAR_COLLAPSED_WIDTH = 56

    // Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            // Cmd+J to toggle mode (cycle)
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
                e.preventDefault()
                const modes = ['study', 'assignment', 'revision']
                const currentIndex = modes.indexOf(currentMode)
                const nextIndex = (currentIndex + 1) % modes.length
                setCurrentMode(modes[nextIndex])
                console.log(`Switched to ${modes[nextIndex]}`)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentMode, setCurrentMode])

    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex">
            {/* Left Sidebar (fixed width, collapsible) */}
            <div
                className="h-full border-r bg-background flex-shrink-0 transition-[width] duration-200 ease-in-out"
                style={{ width: isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
            >
                <Sidebar
                    collapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarCollapsed(v => !v)}
                />
            </div>

            {/* Middle + Right Panels */}
            <div className="flex-1 min-w-0">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={62} minSize={30}>
                        <div className="h-full flex flex-col bg-muted/20 min-w-0">
                            <div className="flex-1 overflow-auto relative min-w-0">
                                {children}
                            </div>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={38} minSize={20} className="bg-card min-w-0">
                        <ChatInterface />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
