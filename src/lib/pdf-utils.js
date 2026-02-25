import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to CDN for consistent behavior
// Ensure version matches installed package
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts all text content from a PDF file URL.
 * @param {string} url - The URL of the PDF file (e.g., from URL.createObjectURL)
 * @returns {Promise<string>} - The full text content of the PDF
 */
export async function extractTextFromPDF(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }
        return fullText;
    } catch (error) {
        console.error("Error extracting text from PDF:", error);
        throw new Error("Failed to extract text from PDF");
    }
}

/**
 * Extracts text content from a PDF file URL by page.
 * @param {string} url - The URL of the PDF file (e.g., from URL.createObjectURL)
 * @returns {Promise<Array<{pageNumber: number, text: string}>>}
 */
export async function extractTextByPage(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            pages.push({ pageNumber: i, text: pageText });
        }
        return pages;
    } catch (error) {
        console.error("Error extracting text by page from PDF:", error);
        throw new Error("Failed to extract text from PDF");
    }
}

/**
 * Extracts text lines with normalized positions from a PDF file URL.
 * @param {string} url
 * @returns {Promise<Array<{pageNumber:number, lines:Array<{x:number,y:number,w:number,h:number,text:string}>}>>}
 */
export async function extractTextLinesByPage(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const textContent = await page.getTextContent();

            const lineMap = new Map();
            const lineThreshold = 3; // px

            for (const item of textContent.items) {
                if (!item.str) continue;
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const x = tx[4];
                const y = tx[5];
                const h = Math.hypot(tx[2], tx[3]) || item.height || 10;
                const w = (item.width || 0) * viewport.scale;

                const key = Math.round((viewport.height - y) / lineThreshold);
                if (!lineMap.has(key)) {
                    lineMap.set(key, {
                        x,
                        yTop: viewport.height - y - h,
                        w,
                        h,
                        text: item.str
                    });
                } else {
                    const line = lineMap.get(key);
                    line.text = `${line.text} ${item.str}`;
                    line.x = Math.min(line.x, x);
                    line.yTop = Math.min(line.yTop, viewport.height - y - h);
                    line.w = Math.max(line.w, x + w - line.x);
                    line.h = Math.max(line.h, h);
                    lineMap.set(key, line);
                }
            }

            const lines = Array.from(lineMap.values())
                .sort((a, b) => a.yTop - b.yTop)
                .map((l) => ({
                    x: l.x / viewport.width,
                    y: l.yTop / viewport.height,
                    w: l.w / viewport.width,
                    h: l.h / viewport.height,
                    text: l.text.trim()
                }));

            pages.push({ pageNumber: i, lines });
        }

        return pages;
    } catch (error) {
        console.error("Error extracting text lines from PDF:", error);
        throw new Error("Failed to extract text from PDF");
    }
}

/**
 * Extracts line-preserved text from a PDF file URL.
 * Uses positional line grouping to better preserve question structure.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function extractLineTextFromPDF(url) {
    const pages = await extractTextLinesByPage(url);
    return pages
        .map((p) => {
            const lines = p.lines.map((l) => l.text).filter(Boolean).join('\n');
            return `--- Page ${p.pageNumber} ---\n${lines}\n`;
        })
        .join('\n');
}
