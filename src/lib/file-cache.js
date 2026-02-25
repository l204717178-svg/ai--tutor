const DB_NAME = 'unipilot-file-cache'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function withStore(mode, fn) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        const result = fn(store)
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error)
    })
}

export async function saveFileToCache(file) {
    if (!file || !file.id) return
    const blob = file.fileObject || file.blob
    if (!blob) return

    const record = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified || (file.fileObject && file.fileObject.lastModified) || Date.now(),
        blob
    }

    await withStore('readwrite', (store) => store.put(record))
}

export async function loadAllCachedFiles() {
    return await withStore('readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll()
            request.onsuccess = () => resolve(request.result || [])
            request.onerror = () => reject(request.error)
        })
    })
}

export async function deleteFileFromCache(id) {
    if (!id) return
    await withStore('readwrite', (store) => store.delete(id))
}

export async function clearFileCache() {
    await withStore('readwrite', (store) => store.clear())
}
