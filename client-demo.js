
const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';
let authToken = null;

const api = axios.create({
    baseURL: GATEWAY_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
    if (authToken) {
        config.headers.authorization = `Bearer ${authToken}`;
    }
    return config;
});

const log = (title, data) => {
    console.log(`\n--- ${title} ---`);
    console.log(JSON.stringify(data, null, 2));
    console.log('---------------------\n');
};

async function runDemo() {
    try {
        // 1. Registrar um novo usuário
        console.log('1. Registrando um novo usuário...');
        const userData = {
            email: `user${Date.now()}@test.com`,
            username: `user${Date.now()}`,
            password: 'password123',
            firstName: 'Demo',
            lastName: 'User'
        };
        const registerResponse = await api.post('/api/auth/register', userData);
        log('Usuário Registrado', registerResponse.data);

        // 2. Fazer login
        console.log('2. Fazendo login...');
        const loginResponse = await api.post('/api/auth/login', {
            identifier: userData.email,
            password: 'password123'
        });
        authToken = loginResponse.data.token;
        log('Login Realizado', { token: `...${authToken.slice(-10)}` });

        // 3. Buscar itens no catálogo
        console.log('3. Buscando por "Leite"...');
        const searchResponse = await api.get('/api/items/search?q=Leite');
        log('Resultado da Busca', searchResponse.data);
        const leiteId = searchResponse.data[0].id;

        // 4. Criar uma nova lista de compras
        console.log('4. Criando nova lista de compras...');
        const listResponse = await api.post('/api/lists', {
            name: "Compras da Semana",
            description: "Itens essenciais para a casa"
        });
        const listId = listResponse.data.id;
        log('Lista Criada', listResponse.data);

        // 5. Adicionar item à lista
        console.log(`5. Adicionando "${searchResponse.data[0].name}" à lista...`);
        const addItemResponse = await api.post(`/api/lists/${listId}/items`, {
            itemId: leiteId,
            quantity: 2,
            notes: "Verificar data de validade"
        });
        log('Item Adicionado', addItemResponse.data);
        
        // 6. Visualizar o dashboard
        console.log('6. Visualizando o dashboard...');
        const dashboardResponse = await api.get('/api/dashboard');
        log('Dashboard', dashboardResponse.data);

        console.log('\n✅ Demonstração concluída com sucesso!');

    } catch (error) {
        console.error('\n❌ Ocorreu um erro na demonstração:');
        if (error.response) {
            console.error(`  - Status: ${error.response.status}`);
            console.error(`  - Dados:`, error.response.data);
        } else {
            console.error('  - Mensagem:', error.message);
        }
    }
}

runDemo();