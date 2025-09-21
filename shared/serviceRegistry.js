// shared/serviceRegistry.js

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const REGISTRY_FILE = path.join(__dirname, 'serviceRegistry.json');

class ServiceRegistry {
    constructor() {
        this.registry = {};
        this.initPromise = this.init();
        this.healthCheckInterval = 30000; // 30 segundos
        setInterval(() => this.checkHealth(), this.healthCheckInterval);
    }

    async init() {
        try {
            await fs.access(REGISTRY_FILE);
            const data = await fs.readFile(REGISTRY_FILE, 'utf-8');
            this.registry = JSON.parse(data);
            console.log('Service Registry carregado.');
        } catch (error) {
            console.log('Criando novo Service Registry.');
            await this.write();
        }
    }

    async write() {
        await fs.writeFile(REGISTRY_FILE, JSON.stringify(this.registry, null, 2));
    }

    async register(serviceName, port, host = 'http://localhost') {
        await this.initPromise; // Garante que a inicialização terminou
        const serviceUrl = `${host}:${port}`;
        if (!this.registry[serviceName]) {
            this.registry[serviceName] = [];
        }
        // Evita registros duplicados
        if (!this.registry[serviceName].some(s => s.url === serviceUrl)) {
            this.registry[serviceName].push({ url: serviceUrl, lastHealthCheck: Date.now() });
            await this.write();
            console.log(`✅ Serviço '${serviceName}' registrado em ${serviceUrl}`);
        }
        return serviceUrl;
    }

    async unregister(serviceName, port, host = 'http://localhost') {
        await this.initPromise;
        const serviceUrl = `${host}:${port}`;
        if (this.registry[serviceName]) {
            this.registry[serviceName] = this.registry[serviceName].filter(s => s.url !== serviceUrl);
            if (this.registry[serviceName].length === 0) {
                delete this.registry[serviceName];
            }
            await this.write();
            console.log(`🗑️ Serviço '${serviceName}' removido de ${serviceUrl}`);
        }
    }

    async get(serviceName) {
        await this.initPromise;
        const services = this.registry[serviceName];
        if (!services || services.length === 0) {
            return null;
        }
        // Round-robin simples para load balancing
        const service = services.shift();
        services.push(service);
        await this.write();
        return service.url;
    }
    
    async checkHealth() {
        await this.initPromise;
        let changed = false;
        for (const serviceName in this.registry) {
            const healthyServices = [];
            const services = this.registry[serviceName];
            
            for (const service of services) {
                try {
                    await axios.get(`${service.url}/health`);
                    healthyServices.push(service);
                } catch (error) {
                    console.warn(`💔 Health check falhou para ${serviceName} em ${service.url}. Removendo...`);
                    changed = true;
                }
            }

            if (healthyServices.length === 0) {
                delete this.registry[serviceName];
            } else {
                this.registry[serviceName] = healthyServices;
            }
        }
        if (changed) {
            await this.write();
        }
    }
}

module.exports = new ServiceRegistry();