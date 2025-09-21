// services/user-service/index.js

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-super-secreto';

const db = new JsonDatabase(path.join(__dirname, 'data', 'users.json'));

app.use(bodyParser.json());

// Endpoint de Health Check para o Service Registry
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// POST /auth/register - Cadastro de usuário
app.post('/auth/register', async (req, res) => {
    try {
        const { email, username, password, firstName, lastName, preferences } = req.body;
        if (!email || !password || !username) {
            return res.status(400).json({ message: 'Email, username e senha são obrigatórios.' });
        }

        const existingUser = await db.findOne(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(409).json({ message: 'Email ou username já cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            email,
            username,
            password: hashedPassword,
            firstName,
            lastName,
            preferences: preferences || { defaultStore: 'any', currency: 'BRL' },
            updatedAt: new Date().toISOString()
        };

        const createdUser = await db.create(newUser);
        
        // Remove a senha da resposta
        delete createdUser.password;

        res.status(201).json(createdUser);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
});

// POST /auth/login - Login de usuário
app.post('/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier pode ser email ou username
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Identificador e senha são obrigatórios.' });
        }
        
        const user = await db.findOne(u => u.email === identifier || u.username === identifier);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        // Remove a senha da resposta
        delete user.password;
        
        res.json({ user, token });

    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
});

// Middleware de autenticação simples
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// GET /users/:id - Buscar dados do usuário
app.get('/users/:id', authenticateToken, async (req, res) => {
    try {
        // Garante que o usuário logado só possa ver seus próprios dados
        if (req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        
        const user = await db.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        
        delete user.password;
        res.json(user);

    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
});

// PUT /users/:id - Atualizar perfil do usuário
app.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }

        const { firstName, lastName, preferences } = req.body;
        const updatedUser = await db.update(req.params.id, { firstName, lastName, preferences });

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        delete updatedUser.password;
        res.json(updatedUser);

    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
});

const server = app.listen(PORT, async () => {
    await db.init();
    console.log(`User Service rodando na porta ${PORT}`);
    
    // Registro no Service Registry
    try {
        const serviceUrl = await serviceRegistry.register('userService', PORT);
        console.log(`User Service registrado com sucesso em ${serviceUrl}`);
    } catch (error) {
        console.error('Falha ao registrar User Service:', error);
    }
});

// Lida com o encerramento do processo
process.on('SIGINT', async () => {
    try {
        await serviceRegistry.unregister('userService', PORT);
        console.log('User Service removido do registro.');
    } catch (error) {
        console.error('Erro ao remover User Service do registro:', error);
    } finally {
        server.close(() => {
            console.log('Servidor encerrado.');
            process.exit(0);
        });
    }
});