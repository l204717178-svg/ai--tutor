import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { PDFViewer } from "@/components/PDF/PDFViewer"
import { Loader2, Languages, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import useFileStore from "@/store/useFileStore"

export function StudyTranslate({ file, translation, onStartTranslate, onPauseTranslate, onResumeTranslate, onRequestTranslatePage, isResizing }) {
    const mainViewportRef = useRef(null)
    const pptPageRefs = useRef({})
    const autoStartAtRef = useRef(0)
    const firstVisibleRef = useRef(false)
    const setPdfTextForModule = useFileStore(s => s.setPdfTextForModule)

    const totalPages = translation?.pages?.length || 0
    const donePages = useMemo(
        () => (translation?.pages || []).filter(p => p.status === 'done').length,
        [translation?.pages]
    )

    const handlePdfVisiblePage = useCallback((pageNumber) => {
        if (!pageNumber) return

        // Handle Translation requests
        if (translation && translation.status !== 'idle' && translation.status !== 'error' && file && translation.fileId === file.id) {
            firstVisibleRef.current = true
            if (onRequestTranslatePage) onRequestTranslatePage(pageNumber)
        }

        // Update Context for AI Anchor
        if (translation?.pages) {
            const pageData = translation.pages.find(p => p.pageNumber === pageNumber)
            if (pageData && pageData.sourceText) {
                setPdfTextForModule('study', `[Page ${pageNumber}]\n${pageData.sourceText}`)
            }
        }
    }, [file?.id, onRequestTranslatePage, translation?.fileId, translation?.status, translation?.pages, setPdfTextForModule])

    useEffect(() => {
        if (!onRequestTranslatePage) return
        if (!translation || translation.status !== 'ready') return
        if (!file || translation.fileId !== file.id) return
        if (file.type !== 'application/pdf') return
        const id = window.setTimeout(() => {
            if (!firstVisibleRef.current) onRequestTranslatePage(1)
        }, 500)
        return () => window.clearTimeout(id)
    }, [file?.id, file?.type, onRequestTranslatePage, translation?.fileId, translation?.status])

    useEffect(() => {
        if (!onStartTranslate) return
        if (!file) return
        if (translation && translation.fileId === file.id && translation.status !== 'idle') return
        const isSupported =
            file.type === 'application/pdf' ||
            file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        if (!isSupported) return
        const now = Date.now()
        if (now - autoStartAtRef.current < 1500) return
        autoStartAtRef.current = now
        onStartTranslate()
    }, [file?.id, onStartTranslate, translation?.fileId, translation?.status])

    useEffect(() => {
        autoStartAtRef.current = 0
        firstVisibleRef.current = false
    }, [file?.id])

    useEffect(() => {
        if (!mainViewportRef.current) return
        if (!file) return
        const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        if (!isPptx) return

        const rootEl = mainViewportRef.current
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return
                    const page = Number(entry.target.dataset.page || 0)
                    if (page) handlePdfVisiblePage(page)
                })
            },
            { root: rootEl, threshold: 0.2 }
        )

        Object.values(pptPageRefs.current).forEach((el) => {
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [file, handlePdfVisiblePage, translation?.pages?.length])

    if (!file) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                    <Languages className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm">请先上传并选择一个 PDF 文件</p>
                </div>
            </div>
        )
    }

    const isPdf = file.type === 'application/pdf'
    const isPptx = file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    const zoomLevel = useFileStore((s) => s.study?.zoomLevel || 1)

    if (!translation || translation.status === 'idle' || translation.fileId !== file.id) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-4">
                    <Languages className="w-12 h-12 mx-auto opacity-50" />
                    <div>
                        <p className="text-sm">进入 Translate 即会自动准备并翻译</p>
                        <p className="text-xs opacity-70 mt-1">翻译结果会按页展示并可同步滚动</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("h-full w-full relative bg-muted/10", isResizing && "pointer-events-none")}>
            {isPdf && (
                <PDFViewer
                    file={file}
                    viewportRef={mainViewportRef}
                    onVisiblePage={handlePdfVisiblePage}
                    renderPagePair={({ pageNumber, pageRef, PageNode }) => {
                        const p = translation.pages.find(x => x.pageNumber === pageNumber) || { pageNumber, status: 'pending' }
                        return (
                            <div
                                key={`page_pair_${pageNumber}`}
                                data-page={pageNumber}
                                ref={pageRef}
                                className="grid grid-cols-2 gap-4 items-stretch mb-8 px-6 mx-auto"
                                style={{ width: `calc(min(100%, 1200px) * ${zoomLevel})`, minWidth: 'min(100%, 1200px)' }}
                            >
                                {/* Left: Original PDF Page */}
                                <div className="flex justify-end items-start min-w-0 sticky top-4 self-start">
                                    {PageNode}
                                </div>

                                {/* Right: Translation Card */}
                                <div className={cn("flex flex-col rounded-lg border bg-background shadow-sm transition-colors min-w-0", p.status === 'translating' && "border-primary")}>
                                    <div className="px-3 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground flex justify-between items-center shrink-0">
                                        <span>第 {p.pageNumber} 页</span>
                                        {p.status === 'translating' && <span className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {p.sourceText?.length || 0} 字符处理中...</span>}
                                        {p.status === 'done' && <span className="text-green-500">已完成</span>}
                                        {p.status === 'error' && <span className="text-destructive">发生错误</span>}
                                    </div>
                                    <div className="flex-1 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                        {p.status === 'pending' && translation.status === 'translating' && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                等待翻译...
                                            </div>
                                        )}
                                        {p.status === 'error' && (
                                            <div className="text-xs text-destructive bg-destructive/5 p-3 rounded">
                                                <span className="font-semibold block mb-1">该页翻译失败:</span>
                                                {p.error || '未知错误'}
                                                <div className="mt-2 text-muted-foreground opacity-70">系统将在后台自动重试。</div>
                                            </div>
                                        )}
                                        {p.status === 'done' && (p.translatedText || '')}
                                    </div>
                                </div>
                            </div>
                        )
                    }}
                />
            )}

            {isPptx && (
                <ScrollArea className="h-full w-full" viewportRef={mainViewportRef}>
                    <div className="py-6 space-y-8 mx-auto px-6" style={{ width: `calc(min(100%, 1200px) * ${zoomLevel})`, minWidth: 'min(100%, 1200px)' }}>
                        {translation.pages.map((p) => (
                            <div
                                key={p.pageNumber}
                                data-page={p.pageNumber}
                                ref={(el) => {
                                    if (el) {
                                        pptPageRefs.current[p.pageNumber] = el
                                    } else {
                                        delete pptPageRefs.current[p.pageNumber]
                                    }
                                }}
                                className="grid grid-cols-2 gap-4 items-stretch"
                            >
                                {/* Left: Original Text */}
                                <div className="rounded-lg border bg-background shadow-sm overflow-hidden flex flex-col min-w-0 sticky top-4 self-start">
                                    <div className="px-3 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground flex items-center gap-2 shrink-0">
                                        <Languages className="w-3.5 h-3.5" />
                                        原文（幻灯片 {p.pageNumber}）
                                    </div>
                                    <div className="p-4 text-sm whitespace-pre-wrap leading-relaxed flex-1">
                                        {p.sourceText || ''}
                                    </div>
                                </div>
                                {/* Right: Translation Card */}
                                <div className={cn("flex flex-col rounded-lg border bg-background shadow-sm transition-colors min-w-0", p.status === 'translating' && "border-primary")}>
                                    <div className="px-3 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground flex justify-between items-center shrink-0">
                                        <span>第 {p.pageNumber} 页</span>
                                        {p.status === 'translating' && <span className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {p.sourceText?.length || 0} 字符处理中...</span>}
                                        {p.status === 'done' && <span className="text-green-500">已完成</span>}
                                        {p.status === 'error' && <span className="text-destructive">发生错误</span>}
                                    </div>
                                    <div className="flex-1 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                                        {p.status === 'pending' && translation.status === 'translating' && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                等待翻译...
                                            </div>
                                        )}
                                        {p.status === 'error' && (
                                            <div className="text-xs text-destructive bg-destructive/5 p-3 rounded">
                                                <span className="font-semibold block mb-1">该页翻译失败:</span>
                                                {p.error || '未知错误'}
                                                <div className="mt-2 text-muted-foreground opacity-70">系统将在后台自动重试。</div>
                                            </div>
                                        )}
                                        {p.status === 'done' && (p.translatedText || '')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}

            {!isPdf && !isPptx && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                        <Languages className="w-10 h-10 mx-auto opacity-40" />
                        <p className="text-sm">当前仅支持 PDF / PPT 翻译</p>
                    </div>
                </div>
            )}
        </div>
    )
}

