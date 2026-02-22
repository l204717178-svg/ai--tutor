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
