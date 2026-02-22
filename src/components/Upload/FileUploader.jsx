import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle2, Loader2, FilePlus, History } from 'lucide-react'
import { cn } from "../../lib/utils"
import useFileStore, { useModuleFiles, useHistoryFiles } from "@/store/useFileStore"
import { extractTextFromPDF } from "@/lib/pdf-utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export function FileUploader({ mode }) {
    const addFileToPool = useFileStore((s) => s.addFileToPool)
    const addFileToModule = useFileStore((s) => s.addFileToModule)
    const setActiveFileForModule = useFileStore((s) => s.setActiveFileForModule)
    const appendPdfTextForModule = useFileStore((s) => s.appendPdfTextForModule)
    const removeFileFromModule = useFileStore((s) => s.removeFileFromModule)

    const files = useModuleFiles(mode)
    const historyFiles = useHistoryFiles(mode)
    const [processing, setProcessing] = useState({})
    const [showHistory, setShowHistory] = useState(false)

    const onDrop = useCallback(async (acceptedFiles) => {
        if (!acceptedFiles.length) return

        for (const file of acceptedFiles) {
            const currentFiles = useFileStore.getState()[mode]?.fileIds || []
            const pool = useFileStore.getState().filePool
            const existing = currentFiles.some(id => pool[id]?.name === file.name)
            if (existing) continue

            const url = URL.createObjectURL(file)
            const newFile = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: file.type,
                size: file.size,
                fileObject: file,
                url: url
            }

            addFileToPool(newFile)
            addFileToModule(mode, newFile.id)

            if (file.type === 'application/pdf') {
                setProcessing(prev => ({ ...prev, [newFile.id]: 'extracting' }))
                try {
                    const text = await extractTextFromPDF(url)
                    appendPdfTextForModule(mode, text)
                    setProcessing(prev => ({ ...prev, [newFile.id]: 'done' }))
                } catch (err) {
                    console.error(`Failed to extract text from ${file.name}:`, err)
                    setProcessing(prev => ({ ...prev, [newFile.id]: 'error' }))
                }
            }
        }
    }, [mode, addFileToPool, addFileToModule, appendPdfTextForModule])

    const handleRemoveFile = (fileId) => {
        removeFileFromModule(mode, fileId)
        setProcessing(prev => {
            const next = { ...prev }
            delete next[fileId]
            return next
        })
    }

    const handleSelectFromHistory = (file) => {
        addFileToModule(mode, file.id)
        if (file.url && file.type === 'application/pdf') {
            setProcessing(prev => ({ ...prev, [file.id]: 'extracting' }))
            extractTextFromPDF(file.url).then(text => {
                appendPdfTextForModule(mode, text)
                setProcessing(prev => ({ ...prev, [file.id]: 'done' }))
            }).catch(() => {
                setProcessing(prev => ({ ...prev, [file.id]: 'error' }))
            })
        }
        setShowHistory(false)
    }

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
        },
        multiple: true,
        noClick: files.length > 0,
    })

    // Empty state
    if (files.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8">
                <div
                    {...getRootProps()}
                    className={cn(
                        "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors max-w-xl w-full",
                        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/10 hover:border-muted-foreground/50"
                    )}
                >
                    <input {...getInputProps()} />
                    <div className="bg-muted p-4 rounded-full mb-4">
                        {isDragActive ? <FileText className="w-8 h-8 text-primary animate-bounce" /> : <Upload className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                        {isDragActive ? "Drop files here" : "Upload Course Materials"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Drag & drop PDF/PPT files, or click to browse.
                    </p>
                </div>

                {historyFiles.length > 0 && (
                    <div className="mt-4 w-full max-w-xl">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full gap-2 text-muted-foreground"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            <History className="w-4 h-4" />
                            Select from uploaded history ({historyFiles.length})
                        </Button>
                        {showHistory && (
                            <div className="mt-2 border rounded-lg divide-y max-h-[200px] overflow-auto">
                                {historyFiles.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => handleSelectFromHistory(f)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                                    >
                                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                        <span className="flex-1 break-words min-w-0">{f.name}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // Has files
    return (
        <ScrollArea className="h-full">
            <div className="max-w-2xl mx-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Materials ({files.length})
                    </h3>
                    <div className="flex gap-2">
                        {historyFiles.length > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-1">
                                <History className="w-3.5 h-3.5" />
                                History
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={open} className="gap-2">
                            <FilePlus className="w-4 h-4" />
                            Add Files
                        </Button>
                    </div>
                </div>

                <div {...getRootProps()} className="contents">
                    <input {...getInputProps()} />
                </div>

                {showHistory && historyFiles.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-[150px] overflow-auto bg-muted/20">
                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">From other modules</div>
                        {historyFiles.map(f => (
                            <button
                                key={f.id}
                                onClick={() => handleSelectFromHistory(f)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                            >
                                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="flex-1 break-words min-w-0">{f.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="space-y-2">
                    {files.map((file) => {
                        const activeFileId = useFileStore.getState()[mode]?.activeFileId
                        return (
                            <div
                                key={file.id}
                                onClick={() => setActiveFileForModule(mode, file.id)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                                    activeFileId === file.id
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-border"
                                )}
                            >
                                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium break-words">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {processing[file.id] === 'extracting' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                    {processing[file.id] === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                    {processing[file.id] === 'error' && <span className="text-xs text-destructive">Error</span>}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id); }}
                                        className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div
                    {...getRootProps()}
                    className={cn(
                        "border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-sm",
                        isDragActive ? "border-primary bg-primary/5 text-primary" : "border-muted-foreground/25 text-muted-foreground hover:border-primary/50"
                    )}
                >
                    <input {...getInputProps()} />
                    {isDragActive ? "Drop more files here..." : "Drag additional files here"}
                </div>
            </div>
        </ScrollArea>
    )
}
