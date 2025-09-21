// shared/JsonDatabase.js

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = null;
    }

    async init() {
        try {
            await fs.access(this.filePath);
        } catch (error) {
            // Se o arquivo não existe, cria com um array vazio
            await fs.writeFile(this.filePath, JSON.stringify([]));
        }
        const fileContent = await fs.readFile(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
    }

    async write() {
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    }

    async find(predicate) {
        return this.data.filter(predicate);
    }

    async findOne(predicate) {
        return this.data.find(predicate) || null;
    }

    async findById(id) {
        return this.data.find(item => item.id === id) || null;
    }

    async create(item) {
        const newItem = { id: uuidv4(), ...item, createdAt: new Date().toISOString() };
        this.data.push(newItem);
        await this.write();
        return newItem;
    }

    async update(id, updates) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) {
            return null;
        }
        this.data[index] = { ...this.data[index], ...updates, updatedAt: new Date().toISOString() };
        await this.write();
        return this.data[index];
    }

    async delete(id) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) {
            return false;
        }
        this.data.splice(index, 1);
        await this.write();
        return true;
    }
    
    async getAll() {
        return this.data;
    }
}

module.exports = JsonDatabase;