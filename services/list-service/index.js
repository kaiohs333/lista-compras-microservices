// services/list-service/index.js

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const JsonDatabase = require('../../shared/JsonDatabase');
const serviceRegistry = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3002; // CORREÇÃO: O roteiro indica porta 3002
const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-super-secreto';

const db = new JsonDatabase(path.join(__dirname, 'data', 'lists.json'));

app.use(bodyParser.json());

// Middleware de autenticação
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

// POST /lists - Criar nova lista
app.post('/lists', authenticateToken, async (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ message: 'O nome da lista é obrigatório.' });
    }

    const newListData = {
        userId,
        name,
        description: description || '',
        status: 'active',
        items: [],
        summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 },
    };

    const createdList = await db.create(newListData);
    res.status(201).json(createdList);
});

// GET /lists - Listar listas do usuário
app.get('/lists', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const userLists = await db.find(list => list.userId === userId);
    res.json(userLists);
});

// GET /lists/:id - Buscar lista específica
app.get('/lists/:id', authenticateToken, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ message: 'Lista não encontrada.' });
    }
    res.json(list);
});

// PUT /lists/:id - Atualizar lista (nome, descrição)
app.put('/lists/:id', authenticateToken, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ message: 'Lista não encontrada.' });
    }
    const { name, description, status } = req.body;
    const updatedList = await db.update(req.params.id, { name, description, status });
    res.json(updatedList);
});

// DELETE /lists/:id - Deletar lista
app.delete('/lists/:id', authenticateToken, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ message: 'Lista não encontrada.' });
    }
    await db.delete(req.params.id);
    res.status(204).send();
});

// POST /lists/:id/items - Adicionar item à lista
app.post('/lists/:id/items', authenticateToken, async (req, res) => {
    const list = await db.findById(req.params.id);
    if (!list || list.userId !== req.user.id) {
        return res.status(404).json({ message: 'Lista não encontrada.' });
    }

    const { itemId, quantity, notes } = req.body;
    if (!itemId || !quantity) {
        return res.status(400).json({ message: 'itemId e quantity são obrigatórios.' });
    }

    try {
        // Descoberta de serviço: Encontrar o Item Service
        const itemServiceUrl = await serviceRegistry.get('itemService');
        if (!itemServiceUrl) {
            return res.status(503).json({ message: 'Catálogo de itens indisponível no momento.' });
        }

        // Comunicação entre serviços: Buscar dados do item
        const itemResponse = await axios.get(`${itemServiceUrl}/items/${itemId}`);
        const itemDetails = itemResponse.data;

        const newItem = {
            id: uuidv4(), // ID único para o item DENTRO da lista
            itemId: itemDetails.id,
            itemName: itemDetails.name,
            quantity: quantity,
            unit: itemDetails.unit,
            estimatedPrice: itemDetails.averagePrice * quantity,
            purchased: false,
            notes: notes || '',
            addedAt: new Date().toISOString()
        };

        list.items.push(newItem);
        
        // Recalcular resumo
        list.summary.totalItems = list.items.length;
        list.summary.estimatedTotal = list.items.reduce((total, item) => total + item.estimatedPrice, 0);

        const updatedList = await db.update(req.params.id, { items: list.items, summary: list.summary });
        res.status(201).json(updatedList);

    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ message: 'Item não encontrado no catálogo.' });
        }
        res.status(500).json({ message: 'Erro ao se comunicar com o serviço de itens.' });
    }
});


const server = app.listen(PORT, async () => {
    await db.init();
    console.log(`List Service rodando na porta ${PORT}`);
    
    try {
        const serviceUrl = await serviceRegistry.register('listService', PORT);
        console.log(`List Service registrado com sucesso em ${serviceUrl}`);
    } catch (error) {
        console.error('Falha ao registrar List Service:', error);
    }
});

process.on('SIGINT', async () => {
    try {
        await serviceRegistry.unregister('listService', PORT);
        console.log('List Service removido do registro.');
    } catch (error) {
        console.error('Erro ao remover List Service do registro:', error);
    } finally {
        server.close(() => {
            console.log('Servidor encerrado.');
            process.exit(0);
        });
    }
});