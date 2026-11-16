const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// Mijozlar uchun alohida papka yaratish
const workspaceDir = path.join(__dirname, 'workspaces');
if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir);
}

// Bot kodini saqlash API
app.post('/save-code', (req, res) => {
    const { code, userId } = req.body;
    const userDir = path.join(workspaceDir, userId || 'default_user');
    
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    fs.writeFileSync(path.join(userDir, 'bot.py'), code);
    res.json({ status: 'ok', message: 'Kod muvaffaqiyatli saqlandi!' });
});

// Real-vaqtda terminal (Konsol) bilan ishlash
io.on('connection', (socket) => {
    let activeProcess = null;
    const userDir = path.join(workspaceDir, 'default_user');
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    socket.on('run-command', (cmd) => {
        // Agar oldingi jarayon (masalan eski bot) ishlayotgan bo'lsa, uni to'xtatish
        if (activeProcess) {
            activeProcess.kill();
        }

        socket.emit('terminal-output', `\r\n$ ${cmd}\r\n`);

        const args = cmd.split(' ');
        const command = args.shift();

        // Buyruqni mijoz papkasida ishga tushirish
        activeProcess = spawn(command, args, { cwd: userDir, shell: true });

        activeProcess.stdout.on('data', (data) => {
            socket.emit('terminal-output', data.toString().replace(/\n/g, '\r\n'));
        });

        activeProcess.stderr.on('data', (data) => {
            socket.emit('terminal-output', `\x1b[31m${data.toString().replace(/\n/g, '\r\n')}\x1b[0m`);
        });

        activeProcess.on('close', (code) => {
            socket.emit('terminal-output', `\r\n[Jarayon yakunlandi: kod ${code}]\r\n`);
            activeProcess = null;
        });
    });

    socket.on('stop-process', () => {
        if (activeProcess) {
            activeProcess.kill();
            socket.emit('terminal-output', '\r\n\x1b[33m[Jarayon majburan to\'xtatildi]\x1b[0m\r\n');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} portida ishga tushdi`);
});
