import express from "express"
import cors from "cors"
import "dotenv/config"

const app = express()
app.use(cors())
app.use(express.json({ limit: "2mb" }))

const BASE_URL = process.env.TRANSLATE_BASE_URL || "http://127.0.0.1:8045/v1"
const API_KEY = process.env.TRANSLATE_API_KEY
const MODEL = process.env.TRANSLATE_MODEL || "gemini-2.5-flash-lite"

app.post("/api/translate", async (req, res) => {
    try {
        if (!API_KEY) {
            return res.status(500).json({ error: { message: "Missing TRANSLATE_API_KEY" } })
        }
        const { prompt } = req.body || {}
        if (!prompt) return res.status(400).json({ error: { message: "Missing prompt" } })

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: "user", content: prompt }]
            })
        })

        const data = await response.json()
        if (!response.ok) {
            const msg = data?.error?.message || response.statusText
            return res.status(response.status).json({ error: { message: msg } })
        }

        const text = data?.choices?.[0]?.message?.content || ""
        return res.json({ text })
    } catch (err) {
        return res.status(500).json({ error: { message: err.message || "Translate failed" } })
    }
})

const port = process.env.PORT || 8787
app.listen(port, () => {
    console.log(`Translate server listening on http://127.0.0.1:${port}`)
})
