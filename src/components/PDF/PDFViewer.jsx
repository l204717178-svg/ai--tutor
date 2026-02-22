import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, AlertCircle, FileUp } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFViewer({ file }) {
    const [numPages, setNumPages] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [containerWidth, setContainerWidth] = useState(600) // Default fallback
    const containerRef = useRef(null)

    useEffect(() => {
        const currentContainer = containerRef.current;
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

    return (
        <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden relative">
            <ScrollArea className="h-full w-full">
                <div ref={containerRef} className="flex flex-col items-center min-h-full py-2 px-2 max-w-full">
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
                        className="shadow-lg max-w-full"
                    >
                        {numPages && Array.from(new Array(numPages), (el, index) => (
                            <Page
                                key={`page_${index + 1}`}
                                pageNumber={index + 1}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="mb-4 shadow-md bg-white rounded-sm overflow-hidden"
                                width={optimalPageWidth}
                                error={<div className="p-4 text-red-500">Page Error</div>}
                            />
                        ))}
                    </Document>
                </div>
            </ScrollArea>
        </div>
    );
}
