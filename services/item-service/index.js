// services/item-service/index.js

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');
const initialItems = require('./data/initialItems'); // Importa os dados iniciais

const app = express();
const PORT = process.env.PORT || 3003; // CORREÇÃO: O roteiro indica porta 3003
const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-super-secreto';

const db = new JsonDatabase(path.join(__dirname, 'data', 'items.json'));

app.use(bodyParser.json());

// Middleware de autenticação (simplificado, pois a validação real ocorre no Gateway)
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

// Endpoint de Health Check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// GET /items - Listar itens com filtros
app.get('/items', async (req, res) => {
    const { category, name } = req.query;
    let items = await db.getAll();
    if (category) {
        items = items.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }
    if (name) {
        items = items.filter(item => item.name.toLowerCase().includes(name.toLowerCase()));
    }
    res.json(items);
});

// GET /items/:id - Buscar item específico
app.get('/items/:id', async (req, res) => {
    const item = await db.findById(req.params.id);
    if (!item) {
        return res.status(404).json({ message: 'Item não encontrado.' });
    }
    res.json(item);
});

// POST /items - Criar novo item (requer autenticação)
app.post('/items', authenticateToken, async (req, res) => {
    const newItemData = req.body;
    const createdItem = await db.create(newItemData);
    res.status(201).json(createdItem);
});

// PUT /items/:id - Atualizar item (requer autenticação)
app.put('/items/:id', authenticateToken, async (req, res) => {
    const updatedItem = await db.update(req.params.id, req.body);
    if (!updatedItem) {
        return res.status(404).json({ message: 'Item não encontrado.' });
    }
    res.json(updatedItem);
});

// GET /categories - Listar categorias disponíveis
app.get('/categories', async (req, res) => {
    const items = await db.getAll();
    const categories = [...new Set(items.map(item => item.category))];
    res.json(categories);
});

// GET /search?q=termo - Buscar itens por nome
app.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ message: 'Parâmetro de busca "q" é obrigatório.' });
    }
    const items = await db.find(item => item.name.toLowerCase().includes(q.toLowerCase()));
    res.json(items);
});

const populateInitialData = async () => {
    const items = await db.getAll();
    if (items.length === 0) {
        console.log('Banco de dados de itens vazio. Populando com dados iniciais...');
        for (const item of initialItems) {
            await db.create(item);
        }
        console.log(`${initialItems.length} itens iniciais foram criados.`);
    }
};

const server = app.listen(PORT, async () => {
    await db.init();
    await populateInitialData();
    console.log(`Item Service rodando na porta ${PORT}`);
    
    try {
        const serviceUrl = await serviceRegistry.register('itemService', PORT);
        console.log(`Item Service registrado com sucesso em ${serviceUrl}`);
    } catch (error) {
        console.error('Falha ao registrar Item Service:', error);
    }
});

process.on('SIGINT', async () => {
    try {
        await serviceRegistry.unregister('itemService', PORT);
        console.log('Item Service removido do registro.');
    } catch (error) {
        console.error('Erro ao remover Item Service do registro:', error);
    } finally {
        server.close(() => {
            console.log('Servidor encerrado.');
            process.exit(0);
        });
    }
});