import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sidebar } from "@/components/Layout/Sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send, Sparkles } from 'lucide-react'
import { cn } from "@/lib/utils"
import useFileStore from "@/store/useFileStore"
import { ChatInterface } from "@/components/Chat/ChatInterface"

export function WorkspaceLayout({ children }) {
    const { currentMode, setCurrentMode } = useFileStore()

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
        <div className="h-screen w-full bg-background text-foreground overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
                {/* Left Sidebar */}
                <ResizablePanel defaultSize={25} minSize={10} collapsible={true}>
                    <Sidebar />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Middle Content */}
                <ResizablePanel defaultSize={50} minSize={20}>
                    <div className="h-full flex flex-col bg-muted/20 min-w-0">
                        <div className="flex-1 overflow-auto relative min-w-0">
                            {children}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right AI Copilot */}
                <ResizablePanel defaultSize={30} minSize={15} className="bg-card min-w-0">
                    <ChatInterface />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
