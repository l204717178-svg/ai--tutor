import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { loadAllCachedFiles } from "@/lib/file-cache"

const createTranslationState = () => ({
    status: 'idle',
    fileId: null,
    pages: [],
    error: null,
    updatedAt: Date.now(),
})

const createModuleSlice = () => ({
    sessionId: Date.now().toString(),
    sessionTitle: 'New Session',
    fileIds: [],
    activeFileId: null,
    pdfTextContent: null,
    chatHistory: [],
    translation: createTranslationState(),
    zoomLevel: 1, // Add zoomLevel here
    createdAt: Date.now(),
    updatedAt: Date.now(),
    history: []
})

const MAX_HISTORY = 50

const useFileStore = create(persist((set, get) => ({
    // --- Shared file pool ---
    filePool: {},

    // --- Per-module slices ---
    study: { ...createModuleSlice(), studyPlan: null },
    assignment: { ...createModuleSlice(), result: null },
    revision: { ...createModuleSlice(), revisionData: null },

    // --- Global ---
    currentMode: 'study',
    tokensUsed: 0,
    addTokensUsed: (amount) => set((state) => ({ tokensUsed: state.tokensUsed + amount })),

    // ========== POOL ACTIONS ==========
    addFileToPool: (file) => set((state) => ({
        filePool: { ...state.filePool, [file.id]: file }
    })),

    hydrateFilePoolFromCache: async () => {
        try {
            const cached = await loadAllCachedFiles()
            if (!cached || cached.length === 0) return
            set((state) => {
                const nextPool = { ...state.filePool }
                for (const item of cached) {
                    if (!nextPool[item.id]) {
                        const url = URL.createObjectURL(item.blob)
                        nextPool[item.id] = {
                            id: item.id,
                            name: item.name,
                            type: item.type,
                            size: item.size,
                            lastModified: item.lastModified,
                            fileObject: item.blob,
                            url
                        }
                    }
                }
                return { filePool: nextPool }
            })
        } catch (err) {
            console.error('Failed to hydrate file cache:', err)
        }
    },

    clearFilePoolAndReferences: () => set((state) => {
        Object.values(state.filePool).forEach((f) => {
            if (f?.url) URL.revokeObjectURL(f.url)
        })
        return {
            filePool: {},
            study: stripFilesFromModule(state.study),
            assignment: stripFilesFromModule(state.assignment),
            revision: stripFilesFromModule(state.revision),
        }
    }),

    clearChatsAndHistory: () => set((state) => ({
        study: { ...state.study, chatHistory: [], history: [], updatedAt: Date.now() },
        assignment: { ...state.assignment, chatHistory: [], history: [], updatedAt: Date.now() },
        revision: { ...state.revision, chatHistory: [], history: [], updatedAt: Date.now() },
    })),

    resetTokensUsed: () => set({ tokensUsed: 0 }),

    // ========== MODULE ACTIONS ==========
    addFileToModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod || mod.fileIds.includes(fileId)) return {}
        const nextModule = {
            ...mod,
            fileIds: [...mod.fileIds, fileId],
            activeFileId: fileId,
            updatedAt: Date.now(),
        }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    removeFileFromModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const newIds = mod.fileIds.filter(id => id !== fileId)
        const newActiveId = mod.activeFileId === fileId
            ? (newIds.length > 0 ? newIds[newIds.length - 1] : null)
            : mod.activeFileId
        const nextModule = {
            ...mod,
            fileIds: newIds,
            activeFileId: newActiveId,
            pdfTextContent: newIds.length === 0 ? null : mod.pdfTextContent,
            sessionTitle: newIds.length === 0 ? 'New Session' : mod.sessionTitle,
            updatedAt: Date.now(),
        }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setActiveFileForModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextModule = { ...mod, activeFileId: fileId, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setZoomLevelForModule: (mode, level) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextModule = { ...mod, zoomLevel: level, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setPdfTextForModule: (mode, text) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextModule = { ...mod, pdfTextContent: text, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    appendPdfTextForModule: (mode, text) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const existing = mod.pdfTextContent
        const firstFileName = mod.fileIds.length > 0 ? state.filePool[mod.fileIds[0]]?.name : 'Untitled Session'
        const nextModule = {
            ...mod,
            pdfTextContent: existing ? existing + '\n\n--- NEW DOCUMENT ---\n\n' + text : text,
            sessionTitle: mod.sessionTitle === 'New Session' && firstFileName ? firstFileName : mod.sessionTitle,
            updatedAt: Date.now(),
        }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    // ========== SESSION ACTIONS ==========
    createNewSession: (mode) => set((state) => {
        const mod = state[mode]
        if (!mod || (mod.fileIds.length === 0 && !mod.pdfTextContent)) return {} // Don't create if empty

        const shouldRecord = mod.chatHistory.length > 0 && mod.fileIds.length > 0
        let nextHistory = mod.history

        if (shouldRecord) {
            const currentData = { ...mod }
            delete currentData.history // Don't nest history arrays
            nextHistory = upsertHistoryEntry(nextHistory, currentData)
        }

        return {
            [mode]: {
                ...createModuleSlice(),
                history: nextHistory
            }
        }
    }),

    loadSession: (mode, targetSessionId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}

        // Find the target session
        const targetSession = mod.history.find(h => h.sessionId === targetSessionId)
        if (!targetSession) return {}

        return {
            [mode]: {
                ...targetSession,
                history: mod.history
            }
        }
    }),

    // ========== MODULE-SPECIFIC SETTERS ==========
    setStudyPlan: (plan) => set((state) => ({
        study: { ...state.study, studyPlan: plan }
    })),

    setAssignmentResult: (result) => set((state) => ({
        assignment: { ...state.assignment, result }
    })),

    setRevisionData: (data) => set((state) => ({
        revision: { ...state.revision, revisionData: data }
    })),

    // ========== CHAT ACTIONS ==========
    chatInputValue: "",
    setChatInputValue: (val) => set({ chatInputValue: val }),

    directAIRequestTrigger: 0,
    triggerDirectAIRequest: (val) => set((state) => ({
        chatInputValue: val,
        directAIRequestTrigger: state.directAIRequestTrigger + 1
    })),

    setModuleChatHistory: (mode, history) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const next = { ...mod, chatHistory: history, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, next) }
    }),

    addChatMessageToModule: (mode, message) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}

        const nextTitle = deriveSessionTitle(state, mod, message)
        const nextModule = {
            ...mod,
            sessionTitle: nextTitle,
            chatHistory: [...mod.chatHistory, message],
            updatedAt: Date.now(),
        }

        const shouldRecord = message.role === 'user' && mod.fileIds.length > 0
        const nextHistory = shouldRecord
            ? upsertHistoryEntry(mod.history, nextModule)
            : (mod.history.find(h => h.sessionId === mod.sessionId)
                ? upsertHistoryEntry(mod.history, nextModule)
                : mod.history)

        return {
            [mode]: {
                ...nextModule,
                history: nextHistory
            }
        }
    }),

    // ========== TRANSLATION ==========
    initTranslationForModule: (mode, fileId, pages) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextTranslation = {
            status: 'ready',
            fileId,
            pages: pages.map((p) => ({
                pageNumber: p.pageNumber,
                sourceText: p.text || '',
                lines: (p.lines || []).map((l) => ({
                    ...l,
                    translatedText: '',
                    status: 'pending',
                    error: null,
                })),
                translatedText: '',
                status: 'pending',
                error: null,
            })),
            error: null,
            updatedAt: Date.now(),
        }
        const nextModule = { ...mod, translation: nextTranslation, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setTranslationStatusForModule: (mode, status, error = null) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextTranslation = {
            ...mod.translation,
            status,
            error,
            updatedAt: Date.now(),
        }
        const nextModule = { ...mod, translation: nextTranslation, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setTranslationPageForModule: (mode, pageNumber, translatedText, status = 'done', error = null) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextPages = mod.translation.pages.map((p) => {
            if (p.pageNumber !== pageNumber) return p
            return { ...p, translatedText: translatedText ?? p.translatedText, status, error }
        })
        const nextTranslation = { ...mod.translation, pages: nextPages, updatedAt: Date.now() }
        const nextModule = { ...mod, translation: nextTranslation, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setTranslationPageStatusForModule: (mode, pageNumber, status, error = null) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextPages = mod.translation.pages.map((p) => {
            if (p.pageNumber !== pageNumber) return p
            return { ...p, status, error }
        })
        const nextTranslation = { ...mod.translation, pages: nextPages, updatedAt: Date.now() }
        const nextModule = { ...mod, translation: nextTranslation, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    setTranslationLineForModule: (mode, pageNumber, lineIndex, translatedText, status = 'done', error = null) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextPages = mod.translation.pages.map((p) => {
            if (p.pageNumber !== pageNumber) return p
            const nextLines = (p.lines || []).map((l, idx) => {
                if (idx !== lineIndex) return l
                return { ...l, translatedText: translatedText ?? l.translatedText, status, error }
            })
            return { ...p, lines: nextLines, status, error }
        })
        const nextTranslation = { ...mod.translation, pages: nextPages, updatedAt: Date.now() }
        const nextModule = { ...mod, translation: nextTranslation, updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    clearTranslationForModule: (mode) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextModule = { ...mod, translation: createTranslationState(), updatedAt: Date.now() }
        return { [mode]: syncHistoryForModule(state, mode, nextModule) }
    }),

    renameHistorySession: (mode, sessionId, title) => set((state) => {
        const mod = state[mode]
        if (!mod || !title) return {}
        const trimmed = title.trim()
        if (!trimmed) return {}

        const nextHistory = mod.history.map(h =>
            h.sessionId === sessionId ? { ...h, sessionTitle: trimmed, updatedAt: Date.now() } : h
        )

        const nextModule = mod.sessionId === sessionId
            ? { ...mod, sessionTitle: trimmed, updatedAt: Date.now() }
            : mod

        return { [mode]: { ...nextModule, history: nextHistory } }
    }),

    deleteHistorySession: (mode, sessionId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const nextHistory = mod.history.filter(h => h.sessionId !== sessionId)
        return { [mode]: { ...mod, history: nextHistory, updatedAt: Date.now() } }
    }),

    // ========== GLOBAL ACTIONS ==========
    setCurrentMode: (mode) => set({ currentMode: mode }),
}), {
    name: 'unipilot-store-v1',
    partialize: (state) => ({
        study: serializeModule(state.study),
        assignment: serializeModule(state.assignment),
        revision: serializeModule(state.revision),
        currentMode: state.currentMode,
        tokensUsed: state.tokensUsed,
    }),
}))

function deriveSessionTitle(state, mod, message) {
    if (mod.sessionTitle !== 'New Session') return mod.sessionTitle
    const firstFileName = mod.fileIds.length > 0 ? state.filePool[mod.fileIds[0]]?.name : null
    if (firstFileName) return firstFileName
    const content = message?.content || ''
    if (!content.trim()) return mod.sessionTitle
    return content.trim().slice(0, 40)
}

function upsertHistoryEntry(history, sessionData) {
    const entry = { ...sessionData }
    delete entry.history
    const existingIndex = history.findIndex(h => h.sessionId === entry.sessionId)
    if (existingIndex === -1) {
        return [entry, ...history].slice(0, MAX_HISTORY)
    }
    const next = [...history]
    next.splice(existingIndex, 1)
    return [entry, ...next].slice(0, MAX_HISTORY)
}

function syncHistoryForModule(state, mode, nextModule) {
    const mod = state[mode]
    if (!mod) return nextModule
    if (!mod.history.find(h => h.sessionId === nextModule.sessionId)) {
        return nextModule
    }
    const nextHistory = upsertHistoryEntry(mod.history, nextModule)
    return { ...nextModule, history: nextHistory }
}

function stripFilesFromHistoryEntry(entry) {
    return {
        ...entry,
        fileIds: [],
        activeFileId: null,
        pdfTextContent: null,
        translation: createTranslationState(),
    }
}

function stripFilesFromModule(mod) {
    if (!mod) return mod
    return {
        ...mod,
        fileIds: [],
        activeFileId: null,
        pdfTextContent: null,
        translation: createTranslationState(),
        updatedAt: Date.now(),
        history: mod.history.map(stripFilesFromHistoryEntry),
    }
}

function serializeModule(mod) {
    if (!mod) return mod
    const {
        sessionId,
        sessionTitle,
        fileIds,
        activeFileId,
        pdfTextContent,
        translation,
        chatHistory,
        createdAt,
        updatedAt,
        history
    } = mod
    return {
        sessionId,
        sessionTitle,
        fileIds,
        activeFileId,
        pdfTextContent,
        chatHistory,
        createdAt,
        updatedAt,
        history
    }
}

// ========== SAFE SELECTOR HOOKS ==========
// These use useShallow to avoid infinite re-render loops

export function useModuleFiles(mode) {
    return useFileStore(
        useShallow((s) => {
            const mod = s[mode]
            if (!mod) return []
            return mod.fileIds.map(id => s.filePool[id]).filter(Boolean)
        })
    )
}

export function useActiveFile(mode) {
    return useFileStore((s) => {
        const mod = s[mode]
        if (!mod || !mod.activeFileId) return null
        return s.filePool[mod.activeFileId] || null
    })
}

export function useModulePdfText(mode) {
    return useFileStore((s) => {
        const mod = s[mode]
        return mod ? mod.pdfTextContent : null
    })
}

export function useModuleChatHistory(mode) {
    return useFileStore((s) => {
        const mod = s[mode]
        return mod ? mod.chatHistory : []
    })
}

export function useHistoryFiles(mode) {
    return useFileStore(
        useShallow((s) => {
            const mod = s[mode]
            if (!mod) return []
            return Object.values(s.filePool).filter(f => !mod.fileIds.includes(f.id))
        })
    )
}

export default useFileStore
