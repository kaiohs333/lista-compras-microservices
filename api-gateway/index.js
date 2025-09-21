// api-gateway/index.js

const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');

const serviceRegistry = require('../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Circuit Breaker State
const circuitBreakerState = {
    userService: { failures: 0, lastFailure: 0, isOpen: false },
    itemService: { failures: 0, lastFailure: 0, isOpen: false },
    listService: { failures: 0, lastFailure: 0, isOpen: false },
};
const FAILURE_THRESHOLD = 3;
const COOLDOWN_PERIOD = 30000; // 30 segundos

// Middleware de roteamento e proxy
app.use('/api/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    const path = req.originalUrl.replace(`/api/${serviceName}`, '');

    // 1. Circuit Breaker Check
    const breaker = circuitBreakerState[serviceName];
    if (breaker && breaker.isOpen) {
        if (Date.now() - breaker.lastFailure > COOLDOWN_PERIOD) {
            console.log(`Circuit for ${serviceName} is in half-open state. Trying again...`);
            breaker.isOpen = false; // Tenta fechar o circuito
        } else {
            return res.status(503).json({ message: `Serviço ${serviceName} está temporariamente indisponível.` });
        }
    }

    try {
        // 2. Service Discovery
        const serviceUrl = await serviceRegistry.get(serviceName);
        if (!serviceUrl) {
            return res.status(404).json({ message: `Serviço '${serviceName}' não encontrado.` });
        }

        // 3. Forward a requisição
        const response = await axios({
            method: req.method,
            url: `${serviceUrl}${path}`,
            data: req.body,
            headers: { 'authorization': req.headers['authorization'] }
        });

        // Reset do circuit breaker em caso de sucesso
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
        }

        res.status(response.status).json(response.data);

    } catch (error) {
        // 4. Circuit Breaker Failure Logic
        if (breaker) {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            if (breaker.failures >= FAILURE_THRESHOLD) {
                breaker.isOpen = true;
                console.error(`🚨 CIRCUIT BREAKER OPEN for ${serviceName}`);
            }
        }
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ message: 'Erro interno no API Gateway', error: error.message });
        }
    }
});

// GET /health - Status de todos os serviços
app.get('/health', async (req, res) => {
    const status = {};
    const services = serviceRegistry.registry;
    for (const serviceName in services) {
        try {
            const serviceUrl = await serviceRegistry.get(serviceName);
            if (serviceUrl) {
                await axios.get(`${serviceUrl}/health`);
                status[serviceName] = 'UP';
            } else {
                status[serviceName] = 'DOWN';
            }
        } catch (error) {
            status[serviceName] = 'DOWN';
        }
    }
    res.json(status);
});

// GET /registry - Lista de serviços registrados
app.get('/registry', (req, res) => {
    res.json(serviceRegistry.registry);
});

// Middleware de autenticação para o Gateway
const authenticateGateway = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    req.token = token; // Anexa o token para ser usado nas chamadas internas
    next();
};

// GET /api/dashboard - Dashboard com estatísticas do usuário
app.get('/api/dashboard', authenticateGateway, async (req, res) => {
    try {
        const listServiceUrl = await serviceRegistry.get('listService');
        const userServiceUrl = await serviceRegistry.get('userService');
        const decodedToken = jwt.decode(req.token);

        if (!listServiceUrl || !userServiceUrl) {
            return res.status(503).json({ message: 'Um ou mais serviços estão indisponíveis.' });
        }

        // Chamadas em paralelo para os serviços
        const [userResponse, listsResponse] = await Promise.all([
            axios.get(`${userServiceUrl}/users/${decodedToken.id}`, { headers: { authorization: `Bearer ${req.token}` } }),
            axios.get(`${listServiceUrl}/lists`, { headers: { authorization: `Bearer ${req.token}` } })
        ]);

        const dashboardData = {
            welcomeMessage: `Olá, ${userResponse.data.firstName}!`,
            totalLists: listsResponse.data.length,
            lists: listsResponse.data.map(list => ({ id: list.id, name: list.name, totalItems: list.summary.totalItems }))
        };

        res.json(dashboardData);

    } catch (error) {
        res.status(500).json({ message: 'Erro ao agregar dados para o dashboard', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway rodando na porta ${PORT}`);
});