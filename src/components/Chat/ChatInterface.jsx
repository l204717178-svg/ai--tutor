import React, { useState, useEffect, useRef } from 'react'
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Sparkles, Loader2, FileText, ChevronRight, Paperclip } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import useFileStore, { useActiveFile, useModulePdfText, useModuleChatHistory } from "@/store/useFileStore"
import { chatWithMentor } from "@/lib/ai-service"
import { cn } from "../../lib/utils"

const MODE_LABELS = {
    study: 'Study Mode',
    assignment: 'Assignment Help',
    revision: 'Revision & Exam',
}

export function ChatInterface() {
    const currentMode = useFileStore((s) => s.currentMode)
    const chatHistory = useModuleChatHistory(currentMode)
    const addChatMessageToModule = useFileStore((s) => s.addChatMessageToModule)

    const activeFile = useActiveFile(currentMode)
    const pdfTextContent = useModulePdfText(currentMode)

    const chatInputValue = useFileStore((s) => s.chatInputValue)
    const setChatInputValue = useFileStore((s) => s.setChatInputValue)
    const directAIRequestTrigger = useFileStore((s) => s.directAIRequestTrigger)

    const [loading, setLoading] = useState(false)
    const scrollRef = useRef(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
    }, [chatHistory, loading])

    const handleSend = async (overrideInput = null) => {
        const messageText = overrideInput || chatInputValue
        if (!messageText.trim() || loading) return

        const userMsg = { role: 'user', content: messageText }
        const nextHistory = [...chatHistory, userMsg]
        addChatMessageToModule(currentMode, userMsg)

        if (!overrideInput) {
            setChatInputValue('') // Only clear if it was a manual send from the input box
        }

        setLoading(true)

        try {
            const context = pdfTextContent || "No document loaded."
            const text = await chatWithMentor(messageText, nextHistory, context)
            addChatMessageToModule(currentMode, { role: 'assistant', content: text })
        } catch (e) {
            console.error(e)
            addChatMessageToModule(currentMode, { role: 'assistant', content: `Error: ${e.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Direct AI Request listener (e.g. from Text Selection "Explain")
    useEffect(() => {
        if (directAIRequestTrigger > 0 && chatInputValue) {
            handleSend(chatInputValue)
            setChatInputValue('');
        }
    }, [directAIRequestTrigger])

    // Focus listener (e.g. from Text Selection "Ask AI")
    useEffect(() => {
        if (chatInputValue.startsWith('> ') && textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to the end
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
        }
    }, [chatInputValue])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 border-b flex items-center gap-2 bg-background flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-sm">UniPilot AI</h2>
            </div>

            {/* AI Context Indicator */}
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2 text-xs">
                <Paperclip className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">AI Context:</span>
                {activeFile ? (
                    <span className="font-medium text-foreground break-words line-clamp-1">{activeFile.name}</span>
                ) : (
                    <span className="text-muted-foreground italic">No document loaded</span>
                )}
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                    {MODE_LABELS[currentMode] || currentMode}
                </span>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-8">
                    {chatHistory.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-16 h-16 bg-blue-50/50 rounded-3xl flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-slate-800">How can I help you today?</h3>
                                <p className="text-sm text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                                    Upload materials and ask me to summarize or explain complex topics.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 w-full max-w-[280px]">
                                <Button variant="ghost" className="justify-between text-xs h-10 px-4 bg-muted/40 hover:bg-muted" onClick={() => setInput("Summarize the key sections")}>
                                    Summarize lecture contents <ChevronRight className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" className="justify-between text-xs h-10 px-4 bg-muted/40 hover:bg-muted" onClick={() => setInput("What are the core technical concepts?")}>
                                    Explain core concepts <ChevronRight className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        chatHistory.map((msg, index) => (
                            <div key={index} className="flex flex-col space-y-2">
                                {msg.role === 'user' ? (
                                    <div className="flex justify-end">
                                        <div className="bg-slate-100 text-slate-900 rounded-2xl px-4 py-2.5 max-w-[90%] text-sm shadow-sm break-words">
                                            {msg.content}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-4 min-w-0">
                                        <div className="mt-1 flex-shrink-0">
                                            <Sparkles className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className={cn(
                                                "prose prose-sm max-w-none prose-slate dark:prose-invert",
                                                "prose-p:leading-relaxed prose-p:my-2 break-words",
                                                "prose-headings:text-slate-900 prose-headings:font-bold prose-headings:my-3",
                                                "prose-ul:my-2 prose-li:my-1",
                                                "prose-table:block prose-table:overflow-x-auto prose-table:my-4 prose-table:border prose-table:rounded-lg",
                                                "prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
                                                "prose-pre:bg-slate-900 prose-pre:rounded-xl prose-pre:p-4",
                                                "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2"
                                            )}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {loading && (
                        <div className="flex gap-4 animate-pulse">
                            <Sparkles className="w-4 h-4 text-blue-300 mt-1" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-4 bg-background border-t">
                <div className="relative max-w-2xl mx-auto group">
                    <Textarea
                        ref={textareaRef}
                        value={chatInputValue}
                        onChange={(e) => setChatInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your question..."
                        className="min-h-[60px] max-h-[200px] w-full pr-12 pl-4 py-4 resize-none rounded-2xl border-slate-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all shadow-sm bg-white"
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                            "absolute bottom-3 right-3 h-8 w-8 rounded-full transition-all",
                            chatInputValue.trim() ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-300 pointer-events-none"
                        )}
                        disabled={loading || !chatInputValue.trim()}
                        onClick={() => handleSend()}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2">UniPilot AI may provide information that needs verification.</p>
            </div>
        </div>
    )
}
