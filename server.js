const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para entender datos de formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. RUTA PRINCIPAL: Muestra tu interfaz "Descargador Pro"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'prueba.html'));
});

// 2. RUTA DE DESCARGA: Aquí sucede la magia de yt-dlp
app.post('/download', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).send('Por favor, ingresa una URL válida.');
    }

    console.log(`Iniciando descarga para: ${url}`);

    // Comando optimizado para Railway (usa cookies y ffmpeg)
    // El archivo se guarda temporalmente como 'audio.mp3'
    const command = `yt-dlp -x --audio-format mp3 --cookies cookies.txt -o "downloads/%(title)s.%(ext)s" "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error de ejecución: ${error.message}`);
            return res.status(500).json({ error: 'Error al procesar el video. Verifica el link o las cookies.' });
        }
        
        console.log(`Salida: ${stdout}`);
        res.json({ message: '¡Descarga completada con éxito en el servidor!', log: stdout });
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});