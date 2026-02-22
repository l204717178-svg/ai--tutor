import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

const createModuleSlice = () => ({
    sessionId: Date.now().toString(),
    sessionTitle: 'New Session',
    fileIds: [],
    activeFileId: null,
    pdfTextContent: null,
    history: []
})

const useFileStore = create((set, get) => ({
    // --- Shared file pool ---
    filePool: {},

    // --- Per-module slices ---
    study: { ...createModuleSlice(), studyPlan: null },
    assignment: { ...createModuleSlice(), result: null },
    revision: { ...createModuleSlice(), revisionData: null },

    // --- Global ---
    currentMode: 'study',
    chatHistory: [],

    // ========== POOL ACTIONS ==========
    addFileToPool: (file) => set((state) => ({
        filePool: { ...state.filePool, [file.id]: file }
    })),

    // ========== MODULE ACTIONS ==========
    addFileToModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod || mod.fileIds.includes(fileId)) return {}
        return {
            [mode]: {
                ...mod,
                fileIds: [...mod.fileIds, fileId],
                activeFileId: fileId,
            }
        }
    }),

    removeFileFromModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const newIds = mod.fileIds.filter(id => id !== fileId)
        const newActiveId = mod.activeFileId === fileId
            ? (newIds.length > 0 ? newIds[newIds.length - 1] : null)
            : mod.activeFileId
        return {
            [mode]: {
                ...mod,
                fileIds: newIds,
                activeFileId: newActiveId,
                pdfTextContent: newIds.length === 0 ? null : mod.pdfTextContent,
                sessionTitle: newIds.length === 0 ? 'New Session' : mod.sessionTitle
            }
        }
    }),

    setActiveFileForModule: (mode, fileId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        return { [mode]: { ...mod, activeFileId: fileId } }
    }),

    setPdfTextForModule: (mode, text) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        return { [mode]: { ...mod, pdfTextContent: text } }
    }),

    appendPdfTextForModule: (mode, text) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}
        const existing = mod.pdfTextContent
        const firstFileName = mod.fileIds.length > 0 ? state.filePool[mod.fileIds[0]]?.name : 'Untitled Session'
        return {
            [mode]: {
                ...mod,
                pdfTextContent: existing ? existing + '\n\n--- NEW DOCUMENT ---\n\n' + text : text,
                sessionTitle: mod.sessionTitle === 'New Session' && firstFileName ? firstFileName : mod.sessionTitle
            }
        }
    }),

    // ========== SESSION ACTIONS ==========
    createNewSession: (mode) => set((state) => {
        const mod = state[mode]
        if (!mod || (mod.fileIds.length === 0 && !mod.pdfTextContent)) return {} // Don't create if empty

        // Save current state to history
        const currentData = { ...mod }
        delete currentData.history // Don't nest history arrays

        return {
            [mode]: {
                ...createModuleSlice(),
                history: [currentData, ...mod.history]
            }
        }
    }),

    loadSession: (mode, targetSessionId) => set((state) => {
        const mod = state[mode]
        if (!mod) return {}

        // Find the target session
        const targetSession = mod.history.find(h => h.sessionId === targetSessionId)
        if (!targetSession) return {}

        // 1. Pack current state if not empty
        let currentToSave = null;
        if (mod.fileIds.length > 0 || mod.pdfTextContent) {
            currentToSave = { ...mod }
            delete currentToSave.history
        }

        // 2. Remove target from history and add current (if any)
        const newHistory = mod.history.filter(h => h.sessionId !== targetSessionId)
        if (currentToSave) {
            newHistory.unshift(currentToSave)
        }

        return {
            [mode]: {
                ...targetSession,
                history: newHistory
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

    // ========== GLOBAL ACTIONS ==========
    setCurrentMode: (mode) => set({ currentMode: mode }),
    setChatHistory: (history) => set({ chatHistory: history }),
    addChatMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message]
    })),
}))

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
