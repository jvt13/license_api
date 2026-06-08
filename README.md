# LicenseAPI

Servidor de licenciamento centralizado por máquina (`machine_id`) para múltiplos sistemas clientes. Oferece API REST para validação de licenças, emissão de JWT (RS256), gerenciamento administrativo e painel web.

**Repositório:** https://github.com/jvt13/license_api

## 🎯 Visão Geral

O LicenseAPI funciona como um servidor de autoridade de licença:

1. **Cliente** envia `machine_id` para `/api/license/validate`
2. **Servidor** registra em SQLite se for novo (status `pending`)
3. **Admin** aprova/revoga via painel `/admin/licenses`
4. **Cliente** recebe JWT assinado (RS256) se aprovado e não expirado
5. **Cliente** valida JWT com chave pública (`/api/license/public-key`)

### Fluxos principais

```
┌─────────────────┐
│  Cliente novo   │
└────────┬────────┘
         │ POST /api/license/validate
         ▼
┌─────────────────────┐        ┌──────────────┐
│ Registro (pending)  │        │ Admin aprova │
│ em SQLite           │◄──────►│ n dias       │
└──────────┬──────────┘        └──────────────┘
           │
      approved? ▼
        e não exp?
           │
         ▼ ▼
    ┌──────────────┐
    │ JWT RS256    │
    │ + expires_at │
    └──────────────┘
```

---

## 📋 Requisitos

- **Node.js** 18+ (recomendado LTS)
- **npm**
- Par de chaves RSA (`private.key` / `public.key`) na raiz do projeto
- Em produção: reverse proxy com HTTPS (nginx, Caddy, etc.) é recomendado

---

## 🔐 Segurança & Autenticação

### Três tipos de tokens JWT

| Tipo | Algoritmo | Uso | Chave | TTL |
|------|-----------|-----|-------|-----|
| **Licença** | RS256 | Retornado ao cliente após validação | `private.key` (assinado) | Configurável (dias) |
| **Admin** | HS256 | Sessão do painel administrativo | `ADMIN_SECRET` | 1 hora |
| - | - | - | - | - |

### Autenticação Admin

- Usuário fixo: **admin**
- Senha: **bcrypt** (mínimo 8 caracteres)
- Armazenada em `admin_account` table no SQLite
- Definida em `/admin/setup` (primeira vez)
- Cookie `HttpOnly + SameSite=Lax`

### Segurança das chaves RSA

- `private.key` — **nunca** em Git, **nunca** compartilhe
- `public.key` — entregue aos clientes via `/api/license/public-key`
- Rotação planejada: clientes precisam revalidar se trocar

---

## 🏗️ Arquitetura Técnica

### Stack
- **Framework:** Express.js
- **Banco:** SQLite + better-sqlite3
- **Auth:** jsonwebtoken (RS256 + HS256) + bcrypt
- **Template:** EJS
- **Env:** dotenv

### Estrutura de diretórios

```
src/
├── app.js                    # Servidor Express + rotas admin
├── config/keys.js           # Carregamento RSA keys
├── database/index.js        # Conexão SQLite
├── routes/
│   ├── license.routes.js    # GET /public-key, POST /validate
│   └── admin.routes.js      # Rotas admin (logout)
├── models/
│   ├── license.model.js     # SQL queries (machines table)
│   └── admin.model.js       # SQL queries (admin_account)
├── services/
│   └── license.service.js   # Lógica de validação + geração JWT
├── middlewares/
│   ├── authAdmin.js         # Valida JWT admin
│   └── adminAccess.js       # Gate: redireciona a /setup se vazio
└── views/admin/
    ├── setup.ejs            # Formulário senha inicial
    ├── login.ejs            # Formulário login
    ├── licenses.ejs         # Painel principal (listagem + filtros)
    └── sql-panel.ejs        # Edição direta de registros
```

### Database Schema

```sql
-- Tabela de máquinas/licenças
CREATE TABLE machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT UNIQUE NOT NULL,
  machine_name TEXT,
  machine_ip TEXT,
  system_name TEXT,
  status TEXT DEFAULT 'pending',      -- 'pending' ou 'approved'
  expires_at DATETIME,                -- ISO 8601
  request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de credenciais admin
CREATE TABLE admin_account (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,      -- sempre 'admin'
  password_hash TEXT NOT NULL,        -- bcrypt
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Fluxo de API

```
POST /api/license/validate
{
  "machine_id": "uuid-estavel",
  "machine_name": "PC Vendas",           # opcional
  "machine_ip": "192.168.1.100",         # opcional
  "system_name": "Windows 11 Enterprise" # opcional
}

▼ Respostas:

(1) Máquina nova
{
  "status": "pending"
}

(2) Máquina pendente ou revogada
{
  "status": "pending"
}

(3) Máquina aprovada
{
  "status": "approved",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-12-25T23:59:59.000Z"
}

(4) Máquina expirada
{
  "status": "expired"
}
```

---

## ⚡ Instalação rápida (desenvolvimento)

```bash
# Clonar e instalar
git clone https://github.com/jvt13/license_api.git
cd license_api
npm install

# Gerar chaves RSA (primeira vez)
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key

# Configurar ambiente
cp .env.example .env
# Edite .env: defina ADMIN_SECRET (segredo para JWT admin)

# Iniciar
npm start
```

A API sobe em **http://localhost:3001** (porta padrão `3001`).

### Portas e endpoints

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Configuração inicial | `/admin/setup` | Apenas 1º acesso (define senha admin) |
| Login admin | `/admin/login` | Acesso ao painel |
| Painel licenses | `/admin/licenses` | Listagem + filtros + aprovações |
| Painel SQL | `/admin/sql-panel` | Edição avançada de registros |
| Validação | `/api/license/validate` | Valida/registra máquina |
| Chave pública | `/api/license/public-key` | RSA public.key em PEM |

**Banco SQLite** (`license.db`) é criado automaticamente na primeira execução.

### Primeiro acesso

1. Acesse **http://localhost:3001/admin/setup** (redirecionamento automático)
2. Defina senha do admin (mínimo 8 caracteres)
3. Faça login em **/admin/login**
4. Comece a registrar máquinas pela API

A senha fica armazenada com **bcrypt** em `admin_account`. O `.env` apenas define `ADMIN_SECRET` (não mais senha).

---

## 🌍 Variáveis de ambiente

Copie `.env.example` para `.env`:

```env
PORT=3001
ADMIN_SECRET=sua-chave-secreta-muito-forte-aqui
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PORT` | Não | Porta HTTP (padrão `3001`) |
| `ADMIN_SECRET` | Sim | Segredo para JWT de sessão admin (HS256) — use um valor forte! |

**Não versione** `.env`, `license.db` ou `private.key` — deixe-os fora do Git por segurança.

---

## 🔑 Chaves RSA (JWT de licença)

Necessárias na **raiz** do projeto:

- `private.key` — assinatura dos tokens JWT (servidor)
- `public.key` — validação no cliente (obtida via `/api/license/public-key`)

### Gerar novas chaves

```bash
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

> **Produção:** Não substitua chaves já em uso sem planejar migração dos clientes. Tokens antigos deixam de validar com novas chaves.

---

## 💻 Exemplos de Uso

### Cliente: Solicitar validação de licença

```bash
# Primeira requisição (máquina nova)
curl -X POST http://localhost:3001/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "abc123-def456-ghi789",
    "machine_name": "PC Vendas 01",
    "machine_ip": "192.168.1.100",
    "system_name": "Windows 11 Enterprise"
  }'

# Resposta (máquina nova — pendente aprovação)
{
  "status": "pending"
}
```

### Admin: Aprovar máquina (painel web)

1. Acesse **http://localhost:3001/admin/licenses**
2. Clique em **Pendentes** para filtrar
3. Preencha "Dias" (ex: `365` para 1 ano)
4. Clique **Aprovar**

### Cliente: Obter JWT (após aprovação)

```bash
# Mesma requisição agora retorna token
curl -X POST http://localhost:3001/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "abc123-def456-ghi789"
  }'

# Resposta (máquina aprovada)
{
  "status": "approved",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYWNoaW5lX2lkIjoiYWJjMTIzLWRlZjQ1Ni1naGk3ODkiLCJleHAiOjE3Mzk0MDAwMDB9.xyz...",
  "expires_at": "2027-06-08T23:59:59.000Z"
}
```

### Cliente: Obter chave pública (para validar JWT localmente)

```bash
curl http://localhost:3001/api/license/public-key

# Resposta
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

### Admin: Revogar/Excluir máquina

- **Revogar**: Retorna status para `pending` (máquina pode solicitar novamente)
- **Excluir**: Remove completamente da base (novo pedido cria novo registro)

---

## 📊 Painel Administrativo

Após login em `/admin/licenses`:

### Filtros

Clique nos cards para filtrar:
- **Pendentes** — aguardando aprovação
- **Ativos** — aprovados e ainda válidos
- **Expirados** — aprovados mas data passou
- **Total** — todas as máquinas

### Ações

| Ação | Efeito |
|------|--------|
| **Aprovar** | Define status=`approved` + data de expiração (N dias a partir de hoje) |
| **Revogar** | Volta para `pending`, limpa `expires_at` |
| **Excluir** | Remove registro (máquina reaparece se solicitar novamente) |

### Ordenação

Clique no cabeçalho **Solicitado em** para alternar entre:
- Crescente (mais antigo primeiro)
- Decrescente (mais recente primeiro)
- Padrão (criação reversa)

### Painel SQL (avançado)

Acesse `/admin/sql-panel` para:
- Criar registros manualmente
- Editar qualquer campo diretamente
- Validação automática de datas (ISO 8601)
- Testado em tempo real

---

## 📋 Logging & Monitoramento

### Logs de token emitido

```
LICENSE_TOKEN_ISSUED | machine_id=abc123 system_name=Windows expires_at=2027-06-08 token_len=512
```

Informações: `machine_id`, `system_name`, `exp` (timestamp Unix), comprimento do token.

### Ver no stdout

```bash
npm start       # desenvolvimento (logs no console)
npm run dev     # com nodemon (reload automático)
```

Em produção, redirecione stdout para arquivo:

```bash
node src/app.js >> logs/license-api.log 2>&1
```

---

## 🚀 Deploy em produção (VPS)

### Primeira instalação

```bash
git clone https://github.com/jvt13/license_api.git
cd license_api
npm install --production

# Gerar chaves RSA
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key

# Configurar .env
cp .env.example .env
nano .env    # defina ADMIN_SECRET forte

# Definir senha admin inicial
npm start
# Acesse http://localhost:3001/admin/setup
# Defina senha
# [Ctrl+C para parar]
```

### Atualizar versão (servidor já em produção)

```bash
cd /caminho/do/license_api
git pull origin main
npm install --production
# Preserve .env e license.db — NÃO delete!
# Reinicie o processo
pm2 restart licenseapi      # ou seu gerenciador
```

Novas colunas no banco são aplicadas automaticamente no startup.

### Gerenciar com PM2

```bash
npm install -g pm2

# Iniciar
pm2 start src/app.js --name licenseapi

# Visualizar logs
pm2 logs licenseapi

# Reiniciar
pm2 restart licenseapi

# Parar
pm2 stop licenseapi

# Persistir (startup do SO)
pm2 save
pm2 startup
```

### Reverse proxy com nginx + HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name api.sua-empresa.com;

    ssl_certificate /etc/letsencrypt/live/api.sua-empresa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sua-empresa.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Checklist pós-deploy

- [ ] `.env` configurado com `ADMIN_SECRET` forte
- [ ] `private.key` e `public.key` presentes e seguros
- [ ] `license.db` preservado (se já existia)
- [ ] Porta liberada no firewall (ou proxy reverso apontando)
- [ ] HTTPS configurado (Let's Encrypt, etc.)
- [ ] Senha admin definida em `/admin/setup`
- [ ] Login testado em `/admin/login`
- [ ] API testada com `/api/license/validate`
- [ ] Logs sendo capturados (ou observabilidade ativa)

---

## 🔌 API Pública (Clientes)

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/license/validate` | Registra/valida máquina; retorna `pending`, `approved` ou `expired` |
| `GET` | `/api/license/public-key` | Chave pública RSA para validar JWT no cliente |

### POST /api/license/validate

**Body:**

```json
{
  "machine_id": "uuid-estavel-da-instalacao",
  "machine_name": "PC Vendas 01",     // opcional
  "machine_ip": "192.168.1.100",      // opcional
  "system_name": "Windows 11"         // opcional
}
```

**Respostas:**

```json
// 1. Máquina nova (não aprovada)
{
  "status": "pending"
}

// 2. Máquina aprovada
{
  "status": "approved",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2027-06-08T23:59:59.000Z"
}

// 3. Máquina expirada
{
  "status": "expired"
}
```

**JWT payload (aprovado):**

```json
{
  "machine_id": "uuid-estavel",
  "machine_name": "PC Vendas 01",
  "machine_ip": "192.168.1.100",
  "company": "Empresa Interna",
  "plan": "internal",
  "exp": 1770556799,
  "iat": 1739020799
}
```

### GET /api/license/public-key

Retorna a chave pública em formato PEM.

**Resposta:**

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

### Integração do cliente

Veja documentação detalhada:
- [Cliente: Validação de licença](docs/integracao-cliente-licenca.md)
- [Identificação do sistema](docs/identificacao-sistema-cliente.md)
- [Funcionamento técnico](docs/funcionamento-sistema.md)

---

## 🧪 Scripts de teste

Execute no diretório do projeto:

```bash
# Testar campos system_name / request_date
node scripts/test-system-fields.js

# QA completo (API, exclusão, contadores)
node scripts/qa-full.js

# QA senha administrativa
node scripts/qa-admin-password.js
```

---

## 📁 Estrutura do projeto

## 📁 Estrutura do projeto

```
LicenseAPI/
│
├── src/
│   ├── app.js                          # Servidor Express, rotas admin
│   ├── config/
│   │   └── keys.js                     # Carregamento de chaves RSA
│   ├── database/
│   │   └── index.js                    # Conexão SQLite, schema
│   ├── routes/
│   │   ├── license.routes.js           # GET /public-key, POST /validate
│   │   └── admin.routes.js             # POST /logout
│   ├── models/
│   │   ├── license.model.js            # Queries: machines table
│   │   └── admin.model.js              # Queries: admin_account table
│   ├── services/
│   │   └── license.service.js          # Lógica: validação, geração JWT
│   ├── middlewares/
│   │   ├── authAdmin.js                # Valida JWT admin
│   │   └── adminAccess.js              # Gate: redireciona a /setup
│   └── views/admin/
│       ├── setup.ejs                   # Formulário senha inicial
│       ├── login.ejs                   # Formulário login admin
│       ├── licenses.ejs                # Painel: filtros + ações
│       └── sql-panel.ejs               # Edição SQL avançada
│
├── scripts/
│   ├── test-system-fields.js           # Teste: system_name / request_date
│   ├── qa-full.js                      # QA: API + exclusão + contadores
│   └── qa-admin-password.js            # QA: senha admin
│
├── docs/
│   ├── integracao-cliente-licenca.md   # Como integrar cliente
│   ├── identificacao-sistema-cliente.md # system_name (Windows/Linux/macOS)
│   └── funcionamento-sistema.md        # Detalhes técnicos do servidor
│
├── private.key                         # RSA privada (não versionado)
├── public.key                          # RSA pública (sincronize aos clientes)
├── license.db                          # SQLite (não versionado)
├── .env                                # Variáveis (não versionado)
├── .env.example                        # Template de .env
├── .gitignore                          # node_modules/, .env, etc.
├── package.json
├── package-lock.json
└── README.md                           # Este arquivo
```

---

## 🔒 Segurança

### O que NÃO fazer

| ❌ | Razão |
|----|-------|
| Versionar `private.key` | Compromete assinatura de todos os tokens |
| Versionar `.env` | Expõe `ADMIN_SECRET` |
| Versionar `license.db` de produção | Dados sensíveis (senhas bcrypt, etc.) |
| HTTP em produção | Credenciais e tokens em plaintext |
| Reusar `ADMIN_SECRET` entre ambientes | Separar dev/staging/prod |

### Boas práticas

✅ Use HTTPS em produção (Let's Encrypt + nginx/Caddy)  
✅ Rotate `ADMIN_SECRET` periodicamente  
✅ Backup regular de `license.db`  
✅ Monitorar logs para atividades suspeitas  
✅ Limitar acesso físico a `private.key`  
✅ Usar firewall para restringir acesso ao admin  

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'private.key'"

Gere as chaves RSA:

```bash
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

### Erro: "ADMIN_SECRET is not set"

Configure em `.env`:

```
ADMIN_SECRET=sua-chave-secreta-muito-forte
```

### Máquina não consegue validar JWT

1. Confirme que o cliente obteve `/api/license/public-key`
2. Verifique se o JWT não expirou (`exp` em segundos Unix)
3. Confirme que o cliente usa algoritmo RS256
4. Se rotacionou chaves, a máquina precisa do novo `public.key`

### Banco SQLite "locked"

Pode ocorrer com múltiplos processos. Use PM2 (single instance) ou Redis para lock distribuído.

---

## 📚 Recursos adicionais

- [OAuth2 vs JWT](https://www.oauth.com/oauth2-servers/oauth-2-vs-oauth-1/) — entender a diferença
- [JWT.io](https://jwt.io/) — debugar tokens
- [OpenSSL Cheatsheet](https://www.ssl.com/article/how-to-use-openssl-ssl-certificate-utility/) — comandos RSA
- [SQLite Docs](https://www.sqlite.org/docs.html) — queries avançadas

---

## 📝 Licença

ISC