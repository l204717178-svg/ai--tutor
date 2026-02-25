import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { PDFViewer } from "@/components/PDF/PDFViewer"
import { FileUploader } from "@/components/Upload/FileUploader"
import { StudyTranslate } from "@/components/Study/StudyTranslate"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Languages, FileText, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import useFileStore, { useModuleFiles, useActiveFile } from "@/store/useFileStore"
import { extractTextByPage } from "@/lib/pdf-utils"
import { translateToChinese } from "@/lib/ai-service"
import { extractTextBySlide } from "@/lib/pptx-utils"
import { cn } from "../../lib/utils"

export function StudyView() {
    const [activeTab, setActiveTab] = useState('document')
    const setActiveFileForModule = useFileStore((s) => s.setActiveFileForModule)
    const translation = useFileStore((s) => s.study.translation)
    const initTranslationForModule = useFileStore((s) => s.initTranslationForModule)
    const setTranslationStatusForModule = useFileStore((s) => s.setTranslationStatusForModule)
    const setTranslationPageForModule = useFileStore((s) => s.setTranslationPageForModule)
    const setTranslationPageStatusForModule = useFileStore((s) => s.setTranslationPageStatusForModule)
    const clearTranslationForModule = useFileStore((s) => s.clearTranslationForModule)
    const storeZoomLevel = useFileStore((s) => s.study.zoomLevel)
    const zoomLevel = storeZoomLevel || 1
    const setZoomLevelForModule = useFileStore((s) => s.setZoomLevelForModule)
    const [translating, setTranslating] = useState(false)

    const handleZoomIn = () => setZoomLevelForModule('study', Math.min(zoomLevel + 0.2, 3))
    const handleZoomOut = () => setZoomLevelForModule('study', Math.max(zoomLevel - 0.2, 0.5))

    const files = useModuleFiles('study')
    const activeFile = useActiveFile('study')
    const activeFileId = activeFile?.id

    const [sidebarWidth, setSidebarWidth] = useState(200)
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef(null)
    const [showUploader, setShowUploader] = useState(false)
    const translateAbortRef = useRef({ cancelled: false, fileId: null })
    const translatePauseRef = useRef(false)
    const translationRef = useRef(translation)
    const translateQueueRef = useRef([])
    const processingRef = useRef(false)
    const retryCountsRef = useRef(new Map())
    const translateCacheRef = useRef(new Map())
    const donePages = useMemo(
        () => (translation?.pages || []).filter(p => p.status === 'done').length,
        [translation?.pages]
    )
    const totalPages = translation?.pages?.length || 0

    const waitForResume = useCallback(() => {
        return new Promise((resolve) => {
            const check = () => {
                if (translateAbortRef.current.cancelled) return resolve(false)
                if (!translatePauseRef.current) return resolve(true)
                setTimeout(check, 200)
            }
            check()
        })
    }, [])

    const prepareTranslation = async () => {
        if (!activeFile?.url || translating) return
        if (
            activeFile.type !== 'application/pdf' &&
            activeFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ) {
            return
        }
        setActiveTab('translate')
        setTranslating(true)
        translateAbortRef.current = { cancelled: false, fileId: activeFile.id }
        translatePauseRef.current = false

        try {
            const pages = activeFile.type === 'application/pdf'
                ? await extractTextByPage(activeFile.url)
                : await extractTextBySlide(activeFile.fileObject || activeFile.blob || activeFile)
            initTranslationForModule('study', activeFile.id, pages)
            setTranslationStatusForModule('study', 'ready')
            translationRef.current = useFileStore.getState().study.translation
            setTimeout(() => {
                requestTranslatePage(1)
            }, 0)
        } catch (error) {
            console.error(error)
            setTranslationStatusForModule('study', 'error', error.message)
        } finally {
            setTranslating(false)
        }
    }

    const processQueue = useCallback(async () => {
        if (processingRef.current) return
        processingRef.current = true

        while (translateQueueRef.current.length > 0) {
            if (translateAbortRef.current.cancelled) break
            if (translatePauseRef.current) {
                setTranslationStatusForModule('study', 'paused')
                break
            }

            const pageNumber = translateQueueRef.current.shift()
            const t = translationRef.current
            if (!t) continue
            const page = t.pages.find(p => p.pageNumber === pageNumber)
            if (!page || page.status === 'done' || page.status === 'translating') continue

            setTranslationStatusForModule('study', 'translating')
            setTranslationPageStatusForModule('study', pageNumber, 'translating')

            const retryKey = `${t.fileId || ''}:${pageNumber}`
            const retryTimes = retryCountsRef.current.get(retryKey) || 0

            try {
                if (activeFile?.type === 'application/pdf') {
                    if (!page.sourceText || !page.sourceText.trim()) {
                        setTranslationPageStatusForModule('study', pageNumber, 'done')
                        continue
                    }
                    const cacheKey = page.sourceText.trim()
                    const cached = translateCacheRef.current.get(cacheKey)
                    if (cached) {
                        setTranslationPageForModule('study', pageNumber, cached, 'done')
                        continue
                    }
                    const translated = await translateToChinese(page.sourceText, {
                        isCancelled: () => translateAbortRef.current.cancelled || translateAbortRef.current.fileId !== activeFile?.id,
                        waitIfPaused: async () => {
                            if (!translatePauseRef.current) return
                            setTranslationStatusForModule('study', 'paused')
                            const resumed = await waitForResume()
                            if (!resumed) throw new Error('Translation cancelled')
                            setTranslationStatusForModule('study', 'translating')
                        }
                    })
                    translateCacheRef.current.set(cacheKey, translated)
                    setTranslationPageForModule('study', pageNumber, translated, 'done')
                } else {
                    if (!page.sourceText || !page.sourceText.trim()) {
                        setTranslationPageStatusForModule('study', pageNumber, 'done')
                        continue
                    }
                    const translated = await translateToChinese(page.sourceText, {
                        isCancelled: () => translateAbortRef.current.cancelled || translateAbortRef.current.fileId !== activeFile?.id,
                        waitIfPaused: async () => {
                            if (!translatePauseRef.current) return
                            setTranslationStatusForModule('study', 'paused')
                            const resumed = await waitForResume()
                            if (!resumed) throw new Error('Translation cancelled')
                            setTranslationStatusForModule('study', 'translating')
                        }
                    })
                    translateCacheRef.current.set(page.sourceText.trim(), translated)
                    setTranslationPageForModule('study', pageNumber, translated, 'done')
                }

                retryCountsRef.current.delete(retryKey)
            } catch (err) {
                console.error(err)
                if (retryTimes < 2) {
                    retryCountsRef.current.set(retryKey, retryTimes + 1)
                    translateQueueRef.current.unshift(pageNumber)
                } else {
                    setTranslationPageStatusForModule('study', pageNumber, 'error', err.message)
                }
            }
        }

        const t = translationRef.current
        if (t) {
            const allDone = t.pages.length > 0 && t.pages.every(p => p.status === 'done')
            if (translatePauseRef.current) {
                setTranslationStatusForModule('study', 'paused')
            } else if (allDone) {
                setTranslationStatusForModule('study', 'done')
            } else {
                setTranslationStatusForModule('study', 'ready')
            }
        }
        processingRef.current = false
    }, [activeFile?.id, setTranslationPageForModule, setTranslationPageStatusForModule, setTranslationStatusForModule, waitForResume])

    const requestTranslatePage = useCallback((pageNumber) => {
        const t = useFileStore.getState().study.translation
        if (!t || t.status === 'idle' || t.status === 'error') return
        if (t.fileId !== activeFile?.id) return
        const page = t.pages.find(p => p.pageNumber === pageNumber)
        if (!page || page.status === 'done' || page.status === 'translating') return
        if (translateQueueRef.current.includes(pageNumber)) return
        translateQueueRef.current.push(pageNumber)
        const nextPage = pageNumber + 1
        if (t.pages.find(p => p.pageNumber === nextPage)) {
            if (!translateQueueRef.current.includes(nextPage)) {
                translateQueueRef.current.push(nextPage)
            }
        }
        processQueue()
    }, [activeFile?.id, processQueue])

    const handlePauseTranslate = () => {
        if (translation?.status === 'translating') {
            translatePauseRef.current = true
            setTranslationStatusForModule('study', 'paused')
        }
    }

    const handleResumeTranslate = () => {
        if (translation?.status === 'paused') {
            translatePauseRef.current = false
            setTranslationStatusForModule('study', 'translating')
            processQueue()
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

    useEffect(() => {
        translationRef.current = translation
    }, [translation])

    useEffect(() => {
        if (!activeFileId) return
        if (translation?.fileId && translation.fileId !== activeFileId) {
            translateAbortRef.current = { cancelled: true, fileId: activeFileId }
            translatePauseRef.current = false
            translateQueueRef.current = []
            retryCountsRef.current = new Map()
            translateCacheRef.current = new Map()
            clearTranslationForModule('study')
        }
    }, [activeFileId, translation?.fileId, clearTranslationForModule])

    useEffect(() => {
        if (activeTab !== 'translate') return
        if (!activeFile) return
        if (
            activeFile.type !== 'application/pdf' &&
            activeFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ) {
            return
        }
        if (translation?.fileId === activeFile.id && translation.status === 'ready') {
            requestTranslatePage(1)
            return
        }
        if (translation?.fileId === activeFile.id && translation.status !== 'idle' && translation.status !== 'error') {
            return
        }
        prepareTranslation()
    }, [activeTab, activeFile, translation?.fileId, translation?.status])

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
                    <Button variant={activeTab === 'translate' ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab('translate')} className="gap-2">
                        <Languages className="h-4 w-4" /> Translate
                    </Button>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-1 border border-input rounded-md bg-background px-1 h-8">
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-6 w-6">
                            <ZoomOut className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <span className="text-xs font-medium w-12 text-center text-muted-foreground">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-6 w-6">
                            <ZoomIn className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowUploader(!showUploader)} className="gap-1">
                        <Upload className="h-3.5 w-3.5" /> Add
                    </Button>
                    {activeTab === 'translate' && translation?.fileId === activeFile?.id && translation.status === 'translating' && (
                        <Button size="sm" variant="outline" onClick={handlePauseTranslate}>
                            暂停
                        </Button>
                    )}
                    {activeTab === 'translate' && translation?.fileId === activeFile?.id && translation.status === 'paused' && (
                        <Button size="sm" onClick={handleResumeTranslate}>
                            继续
                        </Button>
                    )}
                    {activeTab === 'translate' && translation?.fileId === activeFile?.id && (translation.status === 'translating' || translation.status === 'paused') && (
                        <span className="text-xs text-muted-foreground self-center">
                            {translation.status === 'paused' ? '已暂停' : '翻译中'} {donePages}/{totalPages}
                        </span>
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
                <div className={cn(activeTab === 'translate' ? 'block' : 'hidden', "flex-1 h-full bg-background min-w-0", isResizing && "pointer-events-none")}>
                    <StudyTranslate
                        file={activeFile}
                        translation={translation}
                        onStartTranslate={prepareTranslation}
                        onPauseTranslate={handlePauseTranslate}
                        onResumeTranslate={handleResumeTranslate}
                        onRequestTranslatePage={requestTranslatePage}
                        isResizing={isResizing}
                    />
                </div>
            </div>
        </div>
    )
}
