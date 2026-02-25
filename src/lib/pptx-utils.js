import JSZip from 'jszip'

function getSlideNumber(name) {
    const match = name.match(/slide(\d+)\.xml$/)
    return match ? Number(match[1]) : null
}

export async function extractTextBySlide(file) {
    if (!file) return []
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    const slideNames = Object.keys(zip.files)
        .filter((n) => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
        .sort((a, b) => (getSlideNumber(a) || 0) - (getSlideNumber(b) || 0))

    const pages = []
    for (const name of slideNames) {
        const xml = await zip.files[name].async('text')
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const textNodes = Array.from(doc.getElementsByTagName('a:t'))
        const text = textNodes.map(n => n.textContent || '').join(' ')
        pages.push({
            pageNumber: getSlideNumber(name) || pages.length + 1,
            text
        })
    }
    return pages
}
