const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path'); // Nueva librería para manejar rutas
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Servir archivos estáticos (por si tienes CSS o imágenes en la misma carpeta)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;

// CAMBIO AQUÍ: Ahora envía el archivo HTML en lugar de solo texto
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'prueba.html'));
});

app.post('/download', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Falta la URL' });

    // Comando de yt-dlp optimizado para el entorno de Railway
    const command = `yt-dlp -x --audio-format mp3 "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: 'Error en el motor de descarga' });
        }
        console.log(`Salida: ${stdout}`);
        res.json({ message: 'Descarga finalizada con éxito' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto: ${PORT}`);
    console.log(`Ruta del HTML: ${path.join(__dirname, 'prueba.html')}`);
});