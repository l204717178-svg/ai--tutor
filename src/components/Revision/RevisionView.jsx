import React, { useState, useEffect } from 'react'
import { PDFViewer } from "@/components/PDF/PDFViewer"
import { FileUploader } from "@/components/Upload/FileUploader"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, GraduationCap, ClipboardCheck, Sparkles, Upload, Search } from 'lucide-react'
import useFileStore, { useModuleFiles, useActiveFile } from "@/store/useFileStore"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { generateMockExam } from "@/lib/ai-service"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn } from "../../lib/utils"

export function RevisionView() {
    const pdfTextContent = useFileStore((s) => s.revision.pdfTextContent)
    const revisionData = useFileStore((s) => s.revision.revisionData)
    const setRevisionData = useFileStore((s) => s.setRevisionData)
    const files = useModuleFiles('revision')
    const activeFile = useActiveFile('revision')

    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState(null)
    const [showUploader, setShowUploader] = useState(false)
    const [loadingText, setLoadingText] = useState("正在解析多份课件关联性...")

    useEffect(() => {
        if (!generating) return;
        const t1 = setTimeout(() => setLoadingText("正在检索学术数据库以获取参考题型..."), 5000);
        const t2 = setTimeout(() => setLoadingText("正在基于考试权重生成预测卷..."), 15000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            setLoadingText("正在解析多份课件关联性...");
        };
    }, [generating]);

    const handleGenerateMock = async () => {
        if (!pdfTextContent) return
        setGenerating(true)
        setError(null)
        try {
            const examData = await generateMockExam(pdfTextContent)
            setRevisionData(examData)
        } catch (err) {
            console.error(err)
            setError(err.message)
        } finally {
            setGenerating(false)
        }
    }

    if (files.length === 0) {
        return <FileUploader mode="revision" />
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full overflow-hidden border-r flex flex-col">
                    {showUploader && (
                        <div className="border-b bg-muted/20 max-h-[250px] overflow-auto">
                            <FileUploader mode="revision" />
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                        <PDFViewer file={activeFile} />
                    </div>
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full bg-background flex flex-col min-w-0">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2 font-semibold text-sm text-purple-600">
                            <GraduationCap className="w-4 h-4" />
                            <span>Deep Research Exam Prep</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowUploader(!showUploader)} className="gap-1 h-7">
                            <Upload className="w-3 h-3" /> Files
                        </Button>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-8 max-w-3xl mx-auto">
                            {generating ? (
                                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                    <div className="relative">
                                        <Loader2 className="h-10 w-10 animate-spin mb-4 text-purple-600" />
                                        <Search className="absolute inset-0 m-auto h-4 w-4 text-purple-400 animate-pulse" />
                                    </div>
                                    <p className="text-base font-medium text-purple-700 animate-pulse">Executing Deep Research (gemini-3.1-pro-high)...</p>
                                    <p className="text-sm mt-2 text-muted-foreground transition-all duration-500 ease-in-out">
                                        {loadingText}
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-20 bg-destructive/5 rounded-xl border border-destructive/20 p-6">
                                    <p className="font-semibold text-destructive mb-2">Deep Research Failed</p>
                                    <p className="text-sm opacity-80">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-4" onClick={handleGenerateMock}>Retry</Button>
                                </div>
                            ) : revisionData ? (
                                <article className="prose prose-slate dark:prose-invert max-w-none 
                                    prose-headings:font-bold 
                                    prose-h1:text-center prose-h1:text-3xl prose-h1:text-purple-700 prose-h1:mb-8
                                    prose-h2:text-purple-600 prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-10
                                    prose-h3:text-slate-800 prose-h3:text-lg prose-h3:mt-6
                                    prose-blockquote:border-l-4 prose-blockquote:border-purple-300 prose-blockquote:bg-purple-50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-700 prose-blockquote:not-italic
                                    prose-p:leading-relaxed prose-li:my-1">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{revisionData}</ReactMarkdown>
                                </article>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                                        <Search className="w-10 h-10 text-purple-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">Deep Research Mode</h3>
                                    <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                                        Upload multiple lectures or materials. I will cross-reference them, search external academic databases, and synthesize a comprehensive Mock Exam.
                                    </p>
                                    <Button onClick={handleGenerateMock} disabled={!pdfTextContent} size="lg" className="bg-purple-600 hover:bg-purple-700 h-12 px-8 text-base shadow-lg shadow-purple-600/20">
                                        <Search className="w-5 h-5 mr-3" /> Start Deep Research
                                    </Button>
                                    {!pdfTextContent && <p className="text-sm text-purple-600 mt-4 animate-pulse">Upload materials to unlock Deep Research.</p>}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
