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
    // Versión compatible para entornos Node modernos
    getTracks = require('spotify-url-info')(fetch).getTracks;
} catch (e) {
    console.log("⚠️ Error cargando librerías de Spotify.");
}

const app = express();

// PERMISOS: Permite que tu prueba.html local conecte con el servidor en Railway
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
        // DETECCIÓN: Flexible para links de Spotify (normales o acortados)
        let esSpotify = url.includes('spotify.com') || url.includes('spotify.link') || url.includes('googleusercontent.com/spotify.com');

        if (esSpotify) {
            if (!getTracks) throw new Error("Librería Spotify no instalada.");
            sendProgress({ status: "Analizando lista de Spotify..." });
            const tracks = await getTracks(url);
            
            cancionesParaBuscar = tracks.map(t => {
                const nombreCancion = t.name || "Cancion";
                const nombreArtista = (t.artists && t.artists.length > 0) ? t.artists[0].name : "";
                return `${nombreCancion} ${nombreArtista}`.trim();
            });
        } else {
            sendProgress({ status: "Analizando lista de YouTube..." });
            const rawIds = execSync(`yt-dlp --get-id --flat-playlist "${url}"`).toString();
            cancionesParaBuscar = rawIds.trim().split('\n').map(id => `https://www.youtube.com/watch?v=${id.trim()}`);
        }

        const total = cancionesParaBuscar.length;
        if (total === 0) throw new Error("No se encontraron canciones.");

        const folderName = `lista-${Date.now()}`;
        const folderPath = path.join(DOWNLOADS_DIR, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        for (let i = 0; i < total; i++) {
            sendProgress({ 
                status: `Descargando ${i + 1} de ${total}...`, 
                current: i + 1, 
                total: total 
            });
            
            let query = cancionesParaBuscar[i];
            let comando = esSpotify 
                ? `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "ytsearch1:${query}"`
                : `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${query}"`;

            try {
                execSync(comando);
            } catch (e) {
                console.error(`Error en canción: ${query}`);
            }
        }

        // VERIFICACIÓN: Evita crear un ZIP de 22 bytes si no hay archivos
        const archivos = fs.readdirSync(folderPath);
        if (archivos.length === 0) throw new Error("No se descargaron archivos MP3.");

        sendProgress({ status: "Comprimiendo archivos en un ZIP..." });
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
                }, 15000); 
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor activo en puerto ${PORT}`);
});