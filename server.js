const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('Servidor Activo'));

app.post('/download', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Falta la URL' });

    // Usamos el comando directo de yt-dlp que instalará Nixpacks
    const command = `yt-dlp -x --audio-format mp3 "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: 'Error en el motor de descarga' });
        }
        res.json({ message: 'Descarga finalizada' });
    });
});

app.listen(PORT, () => console.log(`Puerto: ${PORT}`));