# LicenseAPI

Servidor de licenciamento por máquina (`machine_id`) para múltiplos sistemas clientes. Oferece API REST para validação de licenças, emissão de JWT (RS256) e painel web administrativo.

**Repositório:** https://github.com/jvt13/license_api

---

## Requisitos

- **Node.js** 18+ (recomendado LTS)
- **npm**
- Par de chaves RSA (`private.key` / `public.key`) na raiz do projeto
- Em produção: reverse proxy com HTTPS (nginx, Caddy, etc.) é recomendado

---

## Instalação rápida (desenvolvimento)

```bash
git clone https://github.com/jvt13/license_api.git
cd license_api
npm install
cp .env.example .env
# Edite .env com usuário/senha/segredo do admin
npm start
```

A API sobe na porta definida em `PORT` (padrão **3001**).

| Recurso | URL |
|---------|-----|
| Configuração inicial | http://localhost:3001/admin/setup (somente no 1º acesso) |
| Painel admin | http://localhost:3001/admin/login |
| API de licença | http://localhost:3001/api/license |

O banco SQLite `license.db` é criado automaticamente na primeira execução.

### Primeiro acesso ao painel

1. Acesse `/admin/setup` (redirecionamento automático se a senha ainda não foi definida).
2. Defina a senha do usuário **admin** (mínimo 8 caracteres).
3. Faça login em `/admin/login`.

As credenciais do `.env` (`ADMIN_USER` / `ADMIN_PASS`) **não** são mais usadas para login. A senha fica armazenada com **bcrypt** na tabela `admin_account` do SQLite.

---

## Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PORT` | Não | Porta HTTP (padrão `3001`) |
| `ADMIN_SECRET` | Sim | Segredo para JWT de sessão admin (HS256) |

O login do painel usa usuário fixo **admin** e senha definida em `/admin/setup` (persistida no banco).

> **Não versione** o arquivo `.env` nem o `license.db` — eles ficam fora do Git por segurança.

---

## Chaves RSA (JWT de licença)

Na raiz do projeto:

- `private.key` — assinatura dos tokens (servidor)
- `public.key` — validação no cliente (`GET /api/license/public-key`)

Se ainda não existirem, gere com OpenSSL:

```bash
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

Em produção, **não substitua** chaves já em uso sem planejar a migração dos clientes (tokens antigos deixam de validar).

---

## Deploy em produção (VPS)

### Primeira instalação

```bash
git clone https://github.com/jvt13/license_api.git
cd license_api
npm install --production
cp .env.example .env
nano .env   # configure credenciais fortes
# Confirme private.key e public.key na raiz
npm start
```

### Atualizar versão (servidor já em produção)

```bash
cd /caminho/do/license_api
git pull origin main
npm install --production
# Preserve .env e license.db existentes — não apague
# Reinicie o processo (ex.: pm2 restart licenseapi)
```

Após o `git pull`, novas colunas do banco (`system_name`, `request_date`) são aplicadas automaticamente no startup.

### Processo com PM2 (exemplo)

```bash
npm install -g pm2
pm2 start src/app.js --name licenseapi
pm2 save
pm2 startup
```

### Checklist pós-deploy

- [ ] `.env` configurado no servidor
- [ ] `private.key` e `public.key` presentes
- [ ] `license.db` de produção preservado (se já existia)
- [ ] Porta/firewall liberada ou proxy reverso apontando para a app
- [ ] HTTPS no proxy (Let's Encrypt, etc.)
- [ ] Senha inicial definida em `/admin/setup` (primeiro deploy)
- [ ] Login em `/admin/login` testado

---

## API pública (clientes)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/license/validate` | Registra/valida máquina; retorna `pending`, `approved` ou `expired` |
| `GET` | `/api/license/public-key` | Chave pública para validar JWT no cliente |

Body mínimo do validate:

```json
{
  "machine_id": "uuid-estavel-da-instalacao"
}
```

Campos opcionais: `machine_name`, `machine_ip`, `system_name`.

Documentação detalhada:

- [Integração do cliente](docs/integracao-cliente-licenca.md)
- [Identificação do sistema (`system_name`)](docs/identificacao-sistema-cliente.md)
- [Funcionamento do servidor](docs/funcionamento-sistema.md)

---

## Painel administrativo

Após login em `/admin/login`:

| Rota | Função |
|------|--------|
| `/admin/licenses` | Listagem, filtros por status, ordenação, aprovar, revogar, excluir |
| `/admin/sql-panel` | Edição avançada de registros no SQLite |

**Filtros:** clique nos cards Pendentes, Ativos, Expirados ou Total.  
**Ordenação:** clique no cabeçalho *Solicitado em* (crescente → decrescente → padrão).

---

## Scripts de teste

```bash
node scripts/test-system-fields.js   # system_name / request_date
node scripts/qa-full.js              # QA completo (API, exclusão, contadores)
node scripts/qa-admin-password.js    # QA senha administrativa (altera admin no license.db)
```

---

## Estrutura do projeto

```
LicenseAPI/
├── private.key / public.key
├── license.db          # gerado localmente (não versionado)
├── .env                # não versionado
├── src/
│   ├── app.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── database/
│   └── views/admin/
├── docs/
└── scripts/
```

---

## O que não enviar ao Git

| Arquivo | Motivo |
|---------|--------|
| `.env` | Credenciais |
| `license.db` | Dados de produção/desenvolvimento |
| `node_modules/` | Dependências (`npm install`) |

---

## Licença

ISC
