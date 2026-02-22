import React, { useState } from 'react'
import { PDFViewer } from "@/components/PDF/PDFViewer"
import { FileUploader } from "@/components/Upload/FileUploader"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, Languages, Lightbulb, Upload } from 'lucide-react'
import useFileStore, { useModuleFiles, useActiveFile } from "@/store/useFileStore"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { analyzeAssignment } from "@/lib/ai-service"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn } from "../../lib/utils"

export function AssignmentView() {
    const pdfTextContent = useFileStore((s) => s.assignment.pdfTextContent)
    const result = useFileStore((s) => s.assignment.result)
    const setAssignmentResult = useFileStore((s) => s.setAssignmentResult)
    const files = useModuleFiles('assignment')
    const activeFile = useActiveFile('assignment')

    const [analyzing, setAnalyzing] = useState(false)
    const [error, setError] = useState(null)
    const [showUploader, setShowUploader] = useState(false)

    const handleAnalyze = async () => {
        if (!pdfTextContent) return
        setAnalyzing(true)
        setError(null)
        try {
            const analysis = await analyzeAssignment(pdfTextContent)
            setAssignmentResult(analysis)
        } catch (err) {
            console.error(err)
            setError(err.message)
        } finally {
            setAnalyzing(false)
        }
    }

    if (files.length === 0) {
        return <FileUploader mode="assignment" />
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full overflow-hidden border-r flex flex-col">
                    {showUploader && (
                        <div className="border-b bg-muted/20 max-h-[250px] overflow-auto">
                            <FileUploader mode="assignment" />
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
                        <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                            <Languages className="w-4 h-4" />
                            <span>Assignment Analysis</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowUploader(!showUploader)} className="gap-1 h-7">
                                <Upload className="w-3 h-3" /> Files
                            </Button>
                            {activeFile && (
                                <span className="text-xs text-muted-foreground break-words line-clamp-1 bg-muted/50 px-2 py-1 rounded max-w-[150px]">
                                    {activeFile.name}
                                </span>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-8 max-w-3xl mx-auto">
                            {analyzing ? (
                                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                    <div className="relative">
                                        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                                        <Languages className="absolute inset-0 m-auto h-4 w-4 text-primary/50" />
                                    </div>
                                    <p className="text-base font-medium text-foreground">Analyzing assignment...</p>
                                    <p className="text-sm mt-1">Extracting academic terminology & solving steps</p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-20 bg-destructive/5 rounded-xl border border-destructive/20 p-6">
                                    <p className="font-semibold text-destructive mb-2">Analysis Failed</p>
                                    <p className="text-sm opacity-80">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-4" onClick={handleAnalyze}>Retry</Button>
                                </div>
                            ) : result ? (
                                <article className="prose prose-slate dark:prose-invert max-w-none 
                                    prose-headings:font-bold 
                                    prose-h3:text-primary prose-h3:text-xl prose-h3:border-b prose-h3:pb-2 prose-h3:mt-8 
                                    prose-h4:text-blue-700 prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-3
                                    prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:bg-primary/5 prose-blockquote:py-1.5 prose-blockquote:px-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-slate-700 prose-blockquote:my-4 prose-blockquote:text-[15px]
                                    prose-strong:text-slate-900 prose-strong:font-semibold
                                    prose-table:border prose-table:rounded-lg prose-thead:bg-muted/50 prose-td:p-3 prose-th:p-3 
                                    prose-p:leading-relaxed prose-li:my-1">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result}</ReactMarkdown>
                                </article>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                                        <Lightbulb className="w-10 h-10 text-primary animate-pulse" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">Academic Translation & Deep Analysis</h3>
                                    <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                                        I will break down complex questions, translate technical jargon, and provide step-by-step guidance.
                                    </p>
                                    <Button onClick={handleAnalyze} disabled={!pdfTextContent} size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                                        <Languages className="w-5 h-5 mr-3" /> Start Deep Analysis
                                    </Button>
                                    {!pdfTextContent && <p className="text-sm text-amber-600 mt-4">Please upload an assignment PDF first.</p>}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
