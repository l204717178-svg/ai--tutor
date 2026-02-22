import React, { useState, useCallback, useEffect, useRef } from 'react'
import { PDFViewer } from "@/components/PDF/PDFViewer"
import { FileUploader } from "@/components/Upload/FileUploader"
import { StudyPlanDisplay } from "@/components/Study/StudyPlan"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, ListChecks, FileText, Upload } from 'lucide-react'
import useFileStore, { useModuleFiles, useActiveFile } from "@/store/useFileStore"
import { generateStudyPlan } from "@/lib/ai-service"
import { cn } from "../../lib/utils"

export function StudyView() {
    const [activeTab, setActiveTab] = useState('document')
    const pdfTextContent = useFileStore((s) => s.study.pdfTextContent)
    const studyPlan = useFileStore((s) => s.study.studyPlan)
    const setStudyPlan = useFileStore((s) => s.setStudyPlan)
    const setActiveFileForModule = useFileStore((s) => s.setActiveFileForModule)
    const [generating, setGenerating] = useState(false)

    const files = useModuleFiles('study')
    const activeFile = useActiveFile('study')

    const [sidebarWidth, setSidebarWidth] = useState(200)
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef(null)
    const [showUploader, setShowUploader] = useState(false)

    const handleGeneratePlan = async () => {
        if (!pdfTextContent) return
        setGenerating(true)
        setActiveTab('plan')
        try {
            const plan = await generateStudyPlan(pdfTextContent)
            setStudyPlan(plan)
        } catch (error) {
            console.error(error)
        } finally {
            setGenerating(false)
        }
    }

    const startResizing = useCallback((e) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    const stopResizing = useCallback(() => {
        setIsResizing(false)
    }, [])

    const resize = useCallback((e) => {
        if (isResizing && containerRef.current) {
            const containerLeft = containerRef.current.getBoundingClientRect().left
            const newWidth = e.clientX - containerLeft
            if (newWidth > 120 && newWidth < 450) {
                setSidebarWidth(newWidth)
            }
        }
    }, [isResizing])

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize)
            window.addEventListener("mouseup", stopResizing)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
        } else {
            window.removeEventListener("mousemove", resize)
            window.removeEventListener("mouseup", stopResizing)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        return () => {
            window.removeEventListener("mousemove", resize)
            window.removeEventListener("mouseup", stopResizing)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing, resize, stopResizing])

    if (files.length === 0) {
        return <FileUploader mode="study" />
    }

    return (
        <div className="h-full flex flex-col overflow-hidden" ref={containerRef}>
            <div className="border-b px-4 py-2 flex items-center justify-between bg-background z-20">
                <div className="flex gap-2">
                    <Button variant={activeTab === 'document' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab('document')} className="gap-2">
                        <BookOpen className="h-4 w-4" /> Documents ({files.length})
                    </Button>
                    <Button variant={activeTab === 'plan' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab('plan')} className="gap-2">
                        <ListChecks className="h-4 w-4" /> Study Plan
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowUploader(!showUploader)} className="gap-1">
                        <Upload className="h-3.5 w-3.5" /> Add
                    </Button>
                    {!studyPlan && pdfTextContent && (
                        <Button size="sm" onClick={handleGeneratePlan} disabled={generating}>
                            {generating ? "Generating..." : "Generate Plan"}
                        </Button>
                    )}
                </div>
            </div>

            {showUploader && (
                <div className="border-b bg-muted/20 max-h-[300px] overflow-auto">
                    <FileUploader mode="study" />
                </div>
            )}

            <div className="flex-1 overflow-hidden relative flex min-w-0">
                <div className={`${activeTab === 'document' ? 'flex' : 'hidden'} flex-1 h-full overflow-hidden min-w-0`}>
                    {files.length > 1 && (
                        <>
                            <div className="h-full bg-muted/30 flex flex-col border-r select-none min-w-[100px] shrink-0" style={{ width: sidebarWidth, maxWidth: '40%' }}>
                                <div className="px-3 py-2 border-b flex-shrink-0">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Materials</span>
                                </div>
                                <ScrollArea className="flex-1 min-h-0">
                                    <div className="p-1 space-y-0.5">
                                        {files.map((file) => (
                                            <button
                                                key={file.id}
                                                onClick={() => setActiveFileForModule('study', file.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors",
                                                    activeFile?.id === file.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                )}
                                            >
                                                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span className="break-words flex-1 min-w-0">{file.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                            <div onMouseDown={startResizing} className={cn("w-1 hover:w-1.5 transition-all cursor-col-resize self-stretch hover:bg-primary/30 z-30 relative shrink-0", isResizing && "bg-primary/50 w-1.5")}>
                                <div className="absolute inset-0 -left-1 -right-1" />
                            </div>
                        </>
                    )}
                    <div className={cn("flex-1 h-full overflow-hidden min-w-0", isResizing && "pointer-events-none")}>
                        <PDFViewer file={activeFile} />
                    </div>
                </div>
                <div className={cn(activeTab === 'plan' ? 'block' : 'hidden', "flex-1 h-full bg-background min-w-0", isResizing && "pointer-events-none")}>
                    <StudyPlanDisplay plan={studyPlan} loading={generating} />
                </div>
            </div>
        </div>
    )
}
