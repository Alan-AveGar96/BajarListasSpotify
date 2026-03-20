const express = require("express");
const { execSync } = require("child_process");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

// Configuración de Spotify
let getTracks;
try {
    const fetch = require('node-fetch');
    getTracks = require('spotify-url-info')(fetch).getTracks;
} catch (e) {
    console.log("⚠️ Error cargando librerías de Spotify.");
}

const app = express();

// AJUSTE: CORS para permitir conexión desde tu prueba.html local
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// CARPETA TEMPORAL: Railway solo permite escribir en /tmp
const DOWNLOADS_DIR = '/tmp/temp_downloads'; 
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.get("/playlist-progress", async (req, res) => {
    const url = req.query.url;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        let cancionesParaBuscar = [];
        const esSpotify = url.toLowerCase().includes('spotify');

        if (esSpotify) {
            if (!getTracks) throw new Error("Librería Spotify no instalada.");
            sendProgress({ status: "Analizando contenido de Spotify..." });
            
            const tracks = await getTracks(url);
            cancionesParaBuscar = tracks.map(t => {
                const nombre = t.name || "Cancion";
                const artista = (t.artists && t.artists.length > 0) ? t.artists[0].name : "";
                return `${nombre} ${artista}`.trim();
            });
        } else {
            sendProgress({ status: "Analizando lista de YouTube..." });
            // Se añaden cookies también para el análisis inicial
            const rawIds = execSync(`yt-dlp --cookies cookies.txt --get-id --flat-playlist "${url}"`).toString();
            cancionesParaBuscar = rawIds.trim().split('\n').map(id => `https://www.youtube.com/watch?v=${id.trim()}`);
        }

        const total = cancionesParaBuscar.length;
        if (total === 0) throw new Error("No se encontraron canciones.");

        const folderName = `lista-${Date.now()}`;
        const folderPath = path.join(DOWNLOADS_DIR, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        for (let i = 0; i < total; i++) {
            sendProgress({ 
                status: `Descargando pieza ${i + 1} de ${total}...`, 
                current: i + 1, 
                total: total 
            });
            
            const query = cancionesParaBuscar[i];
            
            // MODIFICACIÓN MAESTRA: Se incluye --cookies cookies.txt en ambos comandos
            const comando = esSpotify 
                ? `yt-dlp --cookies cookies.txt -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "ytsearch1:${query}"`
                : `yt-dlp --cookies cookies.txt -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${query}"`;

            try {
                execSync(comando);
            } catch (e) {
                console.error(`Error en: ${query}`);
            }
        }

        const archivosGenerados = fs.readdirSync(folderPath);
        if (archivosGenerados.length === 0) {
            throw new Error("YouTube bloqueó la descarga. Asegúrate de que cookies.txt sea reciente.");
        }

        sendProgress({ status: "Preparando paquete ZIP..." });
        const zipName = `${folderName}.zip`;
        const zipPath = path.join(DOWNLOADS_DIR, zipName);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            fs.rmSync(folderPath, { recursive: true, force: true });
            sendProgress({ status: "Completado", file: zipName });
            res.end();
        });

        archive.pipe(output);
        archive.directory(folderPath, false);
        await archive.finalize();

    } catch (error) {
        sendProgress({ status: "Error: " + error.message });
        res.end();
    }
});

app.get("/get-zip", (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (!err) {
                setTimeout(() => {
                    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }, 20000); 
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
});