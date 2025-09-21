# Sistema de Lista de Compras com Microsserviços

**Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas**
**Curso de Engenharia de Software - PUC Minas**

Este projeto implementa um sistema distribuído para gerenciamento de listas de compras, utilizando uma arquitetura de microsserviços. O sistema é composto por serviços independentes que se comunicam através de um API Gateway, com descoberta de serviços e bancos de dados NoSQL independentes.

---

## Arquitetura do Sistema

O sistema é composto pelos seguintes componentes:

* **API Gateway** (`porta 3000`): Ponto único de entrada para todas as requisições do cliente. Responsável por rotear as chamadas para o microsserviço apropriado, autenticar e agregar dados.
* **User Service** (`porta 3001`): Gerencia o cadastro, login e dados dos usuários.
* **Item Service** (`porta 3003`): Gerencia o catálogo de itens/produtos disponíveis.
* **List Service** (`porta 3002`): Gerencia a criação e manipulação das listas de compras de cada usuário.
* **Service Registry**: Um módulo compartilhado que permite que os serviços se registrem e se descubram dinamicamente na rede.

```
+----------------+      +-----------------+      +----------------+
|                |      |                 |      |  User Service  |
|     Client     +------>     API Gateway   +------> (porta 3001)    |
|                |      | (porta 3000)    |      +----------------+
+----------------+      |                 |
                        | Service Registry|      +----------------+
                        |      +---------->  Item Service  |
                        +-----------------+      | (porta 3003)    |
                                               +----------------+
                                               
                                               +----------------+
                                               |  List Service  |
                                               | (porta 3002)    |
                                               +----------------+
```

---

## Tecnologias Utilizadas

* **Backend:** Node.js, Express.js
* **Banco de Dados:** NoSQL baseado em arquivos JSON
* **Comunicação:** API Gateway, Service Discovery, REST/HTTP
* **Autenticação:** JWT (jsonwebtoken), bcryptjs
* **Outras Ferramentas:** Nodemon, Axios

---

## Instalação e Execução

### Pré-requisitos
* Node.js v16+
* NPM

### Passos para Instalação

1.  Clone este repositório.
2.  Navegue até a pasta raiz do projeto.
3.  Execute o script para instalar todas as dependências de todos os serviços:
    ```bash
    npm run install:all
    ```

### Executando o Sistema Completo

Para rodar a aplicação, você precisará de **5 janelas de terminal**.

1.  **Terminal 1: User Service**
    ```bash
    cd services/user-service
    npm start
    ```

2.  **Terminal 2: Item Service**
    *(Abra um novo terminal)*
    ```bash
    cd services/item-service
    npm start
    ```

3.  **Terminal 3: List Service**
    *(Abra um novo terminal)*
    ```bash
    cd services/list-service
    npm start
    ```

4.  **Terminal 4: API Gateway**
    *(Abra um novo terminal)*
    ```bash
    cd api-gateway
    npm start
    ```

5.  **Terminal 5: Cliente de Demonstração**
    *(Abra um novo terminal na pasta raiz do projeto)*
    *Aguarde alguns segundos para os serviços se registrarem e então execute:*
    ```bash
    node client-demo.js
    ```

### Verificando a Saúde do Sistema
Você pode verificar o status dos serviços registrados e a saúde geral do sistema através do API Gateway:

* **Ver registro de serviços:** `curl http://localhost:3000/registry`
* **Ver saúde dos serviços:** `curl http://localhost:3000/health`

---

## Documentação da API (Endpoints do Gateway)

Toda a comunicação do cliente é feita através do API Gateway na porta `3000`.

### Autenticação (Roteado para `user-service`)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registra um novo usuário. |
| `POST` | `/api/auth/login` | Autentica um usuário e retorna um token JWT. |

### Itens (Roteado para `item-service`)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/items` | Lista todos os itens do catálogo. |
| `GET` | `/api/items/:id` | Busca um item específico. |
| `POST` | `/api/items` | Cria um novo item (requer autenticação). |

### Listas (Roteado para `list-service`)

_Os endpoints abaixo requerem autenticação via token JWT._

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/lists` | Cria uma nova lista de compras. |
| `GET` | `/api/lists` | Lista todas as listas do usuário. |
| `GET` | `/api/lists/:id`| Busca uma lista específica. |
| `POST` | `/api/lists/:id/items` | Adiciona um item a uma lista. |

### Endpoints Agregados

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard` | Retorna um resumo com dados do usuário e suas listas (requer autenticação). |