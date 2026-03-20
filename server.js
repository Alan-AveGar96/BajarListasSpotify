const express = require("express");
const yts = require("yt-search");
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

// Permite la conexión desde tu archivo prueba.html local
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Carpeta temporal con permisos de escritura en Railway
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
        
        // DETECCIÓN MEJORADA: Busca cualquier rastro de "spotify" en la URL proporcionada
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
            const rawIds = execSync(`yt-dlp --get-id --flat-playlist "${url}"`).toString();
            cancionesParaBuscar = rawIds.trim().split('\n').map(id => `https://www.youtube.com/watch?v=${id.trim()}`);
        }

        const total = cancionesParaBuscar.length;
        if (total === 0) throw new Error("No se encontraron canciones para procesar.");

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
            const comando = esSpotify 
                ? `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "ytsearch1:${query}"`
                : `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${query}"`;

            try {
                execSync(comando);
            } catch (e) {
                console.error(`Error en: ${query}`);
            }
        }

        // Verificación de archivos antes de comprimir para evitar ZIPs vacíos
        const archivosGenerados = fs.readdirSync(folderPath);
        if (archivosGenerados.length === 0) throw new Error("El proceso de descarga no generó archivos válidos.");

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