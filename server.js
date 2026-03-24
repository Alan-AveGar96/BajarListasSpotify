const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // sirve prueba.html

const DOWNLOADS_DIR = '/tmp/downloads';
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// 1. Ruta principal → muestra la interfaz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'prueba.html'));
});

// 2. Progreso de playlist (SSE)
app.get('/playlist-progress', async (req, res) => {
  const url = req.query.url;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const folderName = `lista-${Date.now()}`;
    const folderPath = path.join(DOWNLOADS_DIR, folderName);
    fs.mkdirSync(folderPath, { recursive: true });

    send({ status: "Descargando canciones..." });

    // Descarga todas las canciones
    execSync(`yt-dlp -x --audio-format mp3 --no-playlist -o "${folderPath}/%(title)s.%(ext)s" "${url}"`);

    send({ status: "Comprimiendo en ZIP..." });

    const zipName = `${folderName}.zip`;
    const zipPath = path.join(DOWNLOADS_DIR, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(folderPath, false);
    await archive.finalize();

    // Esperar a que el ZIP se escriba completamente
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Borrar MP3s solo después
    fs.rmSync(folderPath, { recursive: true, force: true });

    send({ status: "Completado", file: zipName });
    res.end();

  } catch (err) {
    console.error(err);
    send({ status: "Error: " + err.message });
    res.end();
  }
});

// 3. Descargar el ZIP
app.get('/get-zip', (req, res) => {
  const file = req.query.file;
  const filePath = path.join(DOWNLOADS_DIR, file);

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (!err) {
        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 10000);
      }
    });
  } else {
    res.status(404).send('Archivo no encontrado');
  }
});

app.listen(PORT, () => console.log(`✅ Servidor listo en puerto ${PORT}`));