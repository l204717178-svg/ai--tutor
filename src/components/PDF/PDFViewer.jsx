import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Loader2, AlertCircle, FileUp } from 'lucide-react'
import { TextSelectionToolbar } from './TextSelectionToolbar';
import useFileStore from "@/store/useFileStore"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFViewer({ file, viewportRef, onViewportScroll, onVisiblePage, renderPagePair }) {
    const zoomLevel = useFileStore((s) => s.study?.zoomLevel || 1)
    const [numPages, setNumPages] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [containerWidth, setContainerWidth] = useState(600) // Default fallback
    const [observerRoot, setObserverRoot] = useState(null)
    const containerRef = useRef(null)
    const wrapperRef = useRef(null)
    const pageRefs = useRef({})

    useEffect(() => {
        const currentContainer = wrapperRef.current;
        if (!currentContainer) return;

        // Use ResizeObserver to update width on container resize
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentBoxSize) {
                    // contentBoxSize is an array, we take the first element (for standard css box model)
                    const newWidth = entry.contentBoxSize[0].inlineSize;
                    setContainerWidth(newWidth);
                } else {
                    // Fallback for older browsers
                    setContainerWidth(entry.contentRect.width);
                }
            }
        });

        resizeObserver.observe(currentContainer);

        return () => {
            resizeObserver.unobserve(currentContainer);
        };
    }, []);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
    }

    function onDocumentLoadError(err) {
        console.error('PDF Load Error:', err);
        setLoading(false);
        setError(err);
    }

    useEffect(() => {
        if (!viewportRef) return
        let rafId = null
        const tick = () => {
            if (viewportRef.current) {
                setObserverRoot(viewportRef.current)
                return
            }
            rafId = window.requestAnimationFrame(tick)
        }
        tick()
        return () => {
            if (rafId) window.cancelAnimationFrame(rafId)
        }
    }, [viewportRef])

    useEffect(() => {
        if (!onVisiblePage) return
        if (!numPages) return
        if (!observerRoot) return
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return
                    const page = Number(entry.target.dataset.page || 0)
                    if (page) onVisiblePage(page)
                })
            },
            { root: observerRoot, threshold: 0.2 }
        )

        Object.values(pageRefs.current).forEach((el) => {
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [numPages, onVisiblePage, observerRoot])

    if (!file) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
                <div className="space-y-2">
                    <FileUp className="w-10 h-10 mx-auto opacity-30" />
                    <p className="text-sm">No document selected.</p>
                    <p className="text-xs opacity-60">Upload a file to begin.</p>
                </div>
            </div>
        )
    }

    // Calculate optimal width for the page (leaving room for scrollbar and padding)
    const optimalPageWidth = Math.max(containerWidth - 16, 200); // 16px = 8px padding * 2
    const effectWidth = renderPagePair ? Math.min(containerWidth, 1200) : containerWidth;
    const pairPageWidth = Math.max((effectWidth - 72) / 2, 200); // Adjust for grid-cols-2, gap-6 (24px), px-6 (48px)

    return (
        <div ref={wrapperRef} className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden relative">
            <ScrollArea className="h-full w-full" viewportRef={viewportRef} onViewportScroll={onViewportScroll}>
                <div ref={containerRef} className="flex flex-col min-h-full py-2 px-2 min-w-full w-max">
                    <Document
                        file={file.url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span>Loading PDF...</span>
                                </div>
                            </div>
                        }
                        error={
                            <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
                                <div className="flex flex-col items-center gap-2 text-destructive max-w-md text-center">
                                    <AlertCircle className="h-8 w-8" />
                                    <h3 className="font-semibold">Failed to load PDF</h3>
                                    <p className="text-sm text-foreground/70">{error?.message || "Unknown error"}</p>
                                    <p className="text-xs text-muted-foreground mt-2 break-all">File: {file.name}</p>
                                </div>
                            </div>
                        }
                        className="shadow-lg min-w-full flex-col flex"
                    >
                        {numPages && Array.from(new Array(numPages), (el, index) => {
                            const pageNumber = index + 1
                            if (renderPagePair) {
                                return renderPagePair({
                                    pageNumber,
                                    pageRef: (el) => {
                                        if (el) {
                                            pageRefs.current[pageNumber] = el
                                        } else {
                                            delete pageRefs.current[pageNumber]
                                        }
                                    },
                                    PageNode: (
                                        <Page
                                            key={`page_${pageNumber}`}
                                            pageNumber={pageNumber}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={false}
                                            className="shadow-md bg-white rounded-sm overflow-hidden"
                                            width={pairPageWidth}
                                            scale={zoomLevel}
                                            error={<div className="p-4 text-red-500">Page Error</div>}
                                        />
                                    )
                                })
                            }

                            return (
                                <div
                                    key={`page_wrap_${pageNumber}`}
                                    data-page={pageNumber}
                                    className="mb-4"
                                    ref={(el) => {
                                        if (el) {
                                            pageRefs.current[pageNumber] = el
                                        } else {
                                            delete pageRefs.current[pageNumber]
                                        }
                                    }}
                                >
                                    <Page
                                        key={`page_${pageNumber}`}
                                        pageNumber={pageNumber}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={false}
                                        className="shadow-md bg-white rounded-sm overflow-hidden"
                                        width={optimalPageWidth}
                                        scale={zoomLevel}
                                        error={<div className="p-4 text-red-500">Page Error</div>}
                                    />
                                </div>
                            )
                        })}
                    </Document>
                </div>
                <TextSelectionToolbar containerRef={containerRef} />
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
