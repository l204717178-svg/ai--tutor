import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Document, pdfjs } from 'react-pdf'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFTranslateViewer({ file, translatedPages, viewportRef, onViewportScroll, onVisiblePage }) {
    const [numPages, setNumPages] = useState(null)
    const [pageBaseSizes, setPageBaseSizes] = useState({})
    const [containerWidth, setContainerWidth] = useState(600)
    const [pdfDoc, setPdfDoc] = useState(null)
    const containerRef = useRef(null)

    useEffect(() => {
        const currentContainer = containerRef.current;
        if (!currentContainer) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentBoxSize) {
                    const newWidth = entry.contentBoxSize[0].inlineSize;
                    setContainerWidth(newWidth);
                } else {
                    setContainerWidth(entry.contentRect.width);
                }
            }
        });

        resizeObserver.observe(currentContainer);
        return () => resizeObserver.unobserve(currentContainer);
    }, []);

    const optimalPageWidth = Math.max(containerWidth - 16, 200)

    const translatedMap = useMemo(() => {
        const map = new Map()
        for (const p of translatedPages || []) {
            map.set(p.pageNumber, p)
        }
        return map
    }, [translatedPages])

    const pageRefs = useRef({})

    const handleDocumentLoadSuccess = (pdf) => {
        setNumPages(pdf.numPages)
        setPdfDoc(pdf)
    }

    useEffect(() => {
        if (!pdfDoc) return
        let cancelled = false
        const loadSizes = async () => {
            const sizes = {}
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i)
                const viewport = page.getViewport({ scale: 1 })
                sizes[i] = { width: viewport.width, height: viewport.height }
            }
            if (!cancelled) setPageBaseSizes(sizes)
        }
        loadSizes()
        return () => { cancelled = true }
    }, [pdfDoc])

    useEffect(() => {
        if (!onVisiblePage) return
        if (!viewportRef || !viewportRef.current) return
        if (!numPages) return

        const rootEl = viewportRef.current
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return
                    const page = Number(entry.target.dataset.page || 0)
                    if (page) onVisiblePage(page)
                })
            },
            { root: rootEl, threshold: 0.2 }
        )

        Object.values(pageRefs.current).forEach((el) => {
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [numPages, onVisiblePage, viewportRef])

    return (
        <div className="h-full w-full">
            <ScrollArea className="h-full w-full" viewportRef={viewportRef} onViewportScroll={onViewportScroll}>
                <div ref={containerRef} className="flex flex-col items-center min-h-full py-2 px-2 max-w-full">
                    <Document
                        file={file.url}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        loading={
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span>Loading PDF...</span>
                                </div>
                            </div>
                        }
                        className="shadow-lg max-w-full"
                    >
                        {numPages && Array.from(new Array(numPages), (el, index) => {
                            const pageNumber = index + 1
                            const translated = translatedMap.get(pageNumber)
                            const base = pageBaseSizes[pageNumber]
                            const scale = base ? optimalPageWidth / base.width : 1
                            const pageHeight = base ? base.height * scale : undefined

                            return (
                                <div
                                    key={`page_wrap_${pageNumber}`}
                                    data-page={pageNumber}
                                    ref={(el) => {
                                        if (el) {
                                            pageRefs.current[pageNumber] = el
                                        } else {
                                            delete pageRefs.current[pageNumber]
                                        }
                                    }}
                                    className="relative mb-4 shadow-md bg-white rounded-sm overflow-hidden"
                                >
                                    <div
                                        className="bg-white w-full"
                                        style={{ width: optimalPageWidth, height: pageHeight || 600 }}
                                    >
                                        {translated && translated.lines && (
                                            <PageTextLayout
                                                lines={translated.lines}
                                                width={optimalPageWidth}
                                                height={pageHeight || 600}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </Document>
                </div>
            </ScrollArea>
        </div>
    )
}

function PageTextLayout({ lines, width, height }) {
    const sorted = [...lines]
        .filter(l => (l.translatedText || '').trim())
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))

    const textLines = sorted.map(l => (l.translatedText || '').trim()).filter(Boolean)
    if (textLines.length === 0) return null

    const avgH = sorted.reduce((a, b) => a + (b.h || 0), 0) / sorted.length || 0.02
    const topLines = sorted.filter(l => l.y < 0.22).slice(0, 4)
    const candidate = topLines.find(l =>
        (l.h || 0) >= avgH * 1.25 &&
        !/^[•\-·]/.test((l.translatedText || '').trim())
    ) || topLines[0]

    const titleCandidate = (candidate?.translatedText || '').trim()
    const isTitle =
        titleCandidate.length > 0 &&
        titleCandidate.length <= 50 &&
        !/^[•\-·]/.test(titleCandidate) &&
        (/[?？]$/.test(titleCandidate) ||
            /[：:]/.test(titleCandidate) ||
            /[A-Z]{3,}/.test(titleCandidate) ||
            (titleCandidate.length <= 24 && !/[，。；]/.test(titleCandidate)))

    const title = isTitle ? titleCandidate : null

    const bodyLines = sorted.filter(l => (l.translatedText || '').trim() && (l !== candidate || !isTitle))

    const minX = Math.min(...bodyLines.map(l => l.x))
    const bullets = []
    const rawParagraphs = []
    bodyLines.forEach((line) => {
        const text = (line.translatedText || '').trim()
        if (!text) return
        const isBullet = /^[•\-·]/.test(text) || (line.x - minX) > 0.06
        if (isBullet) {
            bullets.push(text.replace(/^[•\-·]\s*/, ''))
        } else {
            rawParagraphs.push(text)
        }
    })

    const paragraphs = []
    let buffer = ''
    rawParagraphs.forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed) return
        if (!buffer) {
            buffer = trimmed
            return
        }
        const shouldMerge =
            buffer.length < 36 ||
            !/[。！？.!?]$/.test(buffer)
        if (shouldMerge) {
            buffer = `${buffer}${trimmed.startsWith('，') || trimmed.startsWith('。') ? '' : ' '}${trimmed}`
        } else {
            paragraphs.push(buffer)
            buffer = trimmed
        }
    })
    if (buffer) paragraphs.push(buffer)

    return (
        <div
            className="h-full w-full"
            style={{
                padding: '34px 38px',
                boxSizing: 'border-box',
                fontSize: 14,
                lineHeight: 1.7,
                color: '#111',
            }}
        >
            {title && (
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>
                    {title}
                </div>
            )}
            {bullets.length > 0 && (
                <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
                    {bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                            {b}
                        </li>
                    ))}
                </ul>
            )}
            {paragraphs.map((p, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                    {p}
                </div>
            ))}
        </div>
    )
}
