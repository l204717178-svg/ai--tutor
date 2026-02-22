import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Loader2, BookCheck } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from "../../lib/utils"

export function StudyPlanDisplay({ plan, loading }) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground h-full">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Analyzing document & generating study plan...</p>
            </div>
        )
    }

    if (!plan) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                <BookCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No study plan generated yet.</p>
                <p className="text-sm">Upload a PDF to create your roadmap.</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-2">{plan.title}</h2>
                    <p className="text-muted-foreground">{plan.summary}</p>
                </div>

                <Separator />

                {plan.modules.map((module, mIndex) => (
                    <Card key={mIndex} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{module.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3">
                                {module.topics.map((topic, tIndex) => (
                                    <div key={tIndex} className="flex items-start space-x-2">
                                        <Checkbox id={`m${mIndex}-t${tIndex}`} />
                                        <label
                                            htmlFor={`m${mIndex}-t${tIndex}`}
                                            className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 pt-0.5"
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                className="prose prose-sm max-w-none"
                                            >
                                                {topic}
                                            </ReactMarkdown>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    )
}
