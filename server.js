const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const app = express();

// 1. CONFIGURACIÓN DE CORS (Crítico para localhost)
app.use(cors({
    origin: '*', // Permite que tu prueba.html en localhost se conecte
    methods: ['GET', 'POST']
}));

app.use(express.json());

// 2. PUERTO DINÁMICO (Indispensable para Railway)
const PORT = process.env.PORT || 8080; 

// Ruta principal para verificar que el servidor vive
app.get('/', (req, res) => {
    res.send('Servidor de Descargas Activo');
});

// 3. RUTA DE DESCARGA (Usa yt-dlp instalado por nixpacks)
app.post('/download', (req, res) => {
    const { url } = req.body;
    
    // Comando que usa yt-dlp y ffmpeg (asegúrate de que Railway los instaló)
    const command = `yt-dlp -x --audio-format mp3 "${url}"`; 

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: 'Error al procesar descarga' });
        }
        res.json({ message: 'Descarga finalizada con éxito' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});