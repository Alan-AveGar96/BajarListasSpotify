const express = require("express");
const yts = require("yt-search");
const { execSync, exec } = require("child_process");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

// Configuración de Spotify
let getTracks;
try {
    const fetch = require('node-fetch');
    // Usamos la versión compatible con Railway
    getTracks = require('spotify-url-info')(fetch).getTracks;
} catch (e) {
    console.log("⚠️ Error cargando librerías de Spotify.");
}

const app = express();

// AJUSTE 1: CORS abierto para que tu prueba.html local pueda hablar con Railway
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

const publicPath = path.resolve(__dirname);
app.use(express.static(publicPath));

// AJUSTE 2: Ruta de descargas en /tmp (Única carpeta con permisos de escritura en Railway)
const DOWNLOADS_DIR = '/tmp/temp_downloads'; 
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'prueba.html'));
});

app.get("/playlist-progress", async (req, res) => {
    const url = req.query.url;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        let cancionesParaBuscar = [];
        // AJUSTE 3: Detección correcta de links de Spotify
        let esSpotify = url.includes('spotify.com'); 

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
            // Usamos una ruta absoluta para yt-dlp por seguridad
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
            // Comando con --ffmpeg-location si fuera necesario, pero Railway suele tenerlo en el PATH
            let comando = esSpotify 
                ? `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "ytsearch1:${query}"`
                : `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${query}"`;

            try {
                execSync(comando);
            } catch (e) {
                console.error(`Error en canción: ${query}`);
            }
        }

        sendProgress({ status: "Comprimiendo archivos en un ZIP..." });
        const zipName = `${folderName}.zip`;
        const zipPath = path.join(DOWNLOADS_DIR, zipName);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            // Borrar carpeta de MP3s original para liberar espacio inmediatamente
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
                // Borrado de seguridad después de descargar
                setTimeout(() => {
                    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }, 10000); 
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

// Railway usa la variable de entorno PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
});