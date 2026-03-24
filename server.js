const express = require('express');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Carpeta temporal con permisos en Railway
const DOWNLOADS_DIR = '/tmp/temp_downloads';
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// 1. RUTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'prueba.html'));
});

// 2. RUTA DE PROGRESO (reemplaza tu /download anterior)
app.get('/playlist-progress', async (req, res) => {
    const url = req.query.url;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const folderName = `lista-${Date.now()}`;
        const folderPath = path.join(DOWNLOADS_DIR, folderName);
        fs.mkdirSync(folderPath, { recursive: true });

        sendProgress({ status: "Descargando audio..." });

        const comando = `yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${url}"`;

        execSync(comando);

        sendProgress({ status: "Comprimiendo en ZIP..." });

        const zipName = `${folderName}.zip`;
        const zipPath = path.join(DOWNLOADS_DIR, zipName);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(folderPath, false);
        await archive.finalize();

        // ✅ Esperar a que el ZIP esté 100% escrito antes de continuar
        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
        });

        // Borrar MP3s originales DESPUÉS del ZIP
        fs.rmSync(folderPath, { recursive: true, force: true });

        sendProgress({ status: "Completado", file: zipName });
        res.end();

    } catch (error) {
        console.error(error.message);
        sendProgress({ status: "Error: " + error.message });
        res.end();
    }
});

// 3. RUTA PARA DESCARGAR EL ZIP AL NAVEGADOR
app.get('/get-zip', (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (!err) {
                setTimeout(() => {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }, 10000);
            }
        });
    } else {
        res.status(404).send("Archivo no encontrado.");
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});