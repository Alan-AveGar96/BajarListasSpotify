const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const app = express();

// CONFIGURACIÓN DE CORS: Permite la conexión desde tu localhost
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// PUERTO: Railway asignará uno automáticamente, o usará el 8080
const PORT = process.env.PORT || 8080; 

// Ruta para verificar que el servidor funciona
app.get('/', (req, res) => {
    res.send('Servidor de Descargas Activo y Listo');
});

// RUTA DE DESCARGA: Aquí es donde ocurre la magia
app.post('/download', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'Falta la URL' });
    }

    // Comando para descargar usando las herramientas de Nixpacks
    const command = `yt-dlp -x --audio-format mp3 "${url}"`; 

    console.log(`Ejecutando descarga para: ${url}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error de yt-dlp: ${error.message}`);
            return res.status(500).json({ error: 'Error al procesar la descarga. Revisa que el link sea válido.' });
        }
        res.json({ message: 'Descarga finalizada con éxito en el servidor' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});