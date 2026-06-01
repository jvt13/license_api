# Integração do cliente com o LicenseAPI

Documento para implementar a camada de licença em outro sistema que se comunica com este servidor.

**Base URL (exemplo):** `http://localhost:3001`  
**Prefixo da API:** `/api/license`  
**Porta padrão:** `3001` (configurável via `PORT` no `.env` do servidor)

**Content-Type:** `application/json` em todas as requisições abaixo.

---

## 1. Validar licença — `POST /api/license/validate`

Endpoint principal usado pelo cliente na inicialização (ou periodicamente) para registrar a máquina e obter o status da licença.

### URL completa

```
POST {BASE_URL}/api/license/validate
```

Exemplo: `POST http://localhost:3001/api/license/validate`

### Autenticação

Nenhuma. Endpoint público.

### Payload enviado (body JSON)

| Campo          | Tipo   | Obrigatório | Descrição |
|----------------|--------|-------------|-----------|
| `machine_id`   | string | **Sim**     | Identificador único e estável da máquina/instalação (ex.: UUID gerado na primeira execução, hash de hardware, etc.). |
| `machine_name` | string | Não         | Nome amigável (hostname, nome do PC, etc.). Se enviado e diferente do cadastro, o servidor atualiza o registro. |
| `machine_ip`   | string | Não         | IP atual da máquina. Se enviado e diferente do cadastro, o servidor atualiza o registro. |
| `system_name`  | string | Não         | Nome do sistema/aplicação consumidor (ex.: `Sistema Financeiro`). Ver [identificacao-sistema-cliente.md](./identificacao-sistema-cliente.md). |

#### Exemplo de request

```json
{
  "machine_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "machine_name": "PC-FINANCEIRO-01",
  "machine_ip": "192.168.1.50",
  "system_name": "Sistema Financeiro"
}
```

Mínimo aceito:

```json
{
  "machine_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Respostas

Todas as respostas de sucesso da lógica de negócio usam **HTTP 200** com JSON no body (mesmo para `pending` e `expired`).

#### 200 — Máquina não cadastrada (primeira vez)

Registro criado no servidor com status `pending`. Aguardar aprovação manual pelo admin.

```json
{
  "status": "pending"
}
```

#### 200 — Cadastrada, aguardando aprovação

```json
{
  "status": "pending"
}
```

#### 200 — Aprovada, mas licença expirada

```json
{
  "status": "expired"
}
```

#### 200 — Aprovada e válida

```json
{
  "status": "approved",
  "token": "<JWT assinado com RS256>",
  "expires_at": "2026-07-01T12:00:00.000Z"
}
```

| Campo        | Tipo   | Presente quando     | Descrição |
|--------------|--------|-------------------|-----------|
| `status`     | string | Sempre (200)      | `pending` \| `approved` \| `expired` |
| `token`      | string | `status === approved` | JWT da licença. Guardar localmente se quiser validar offline depois. |
| `expires_at` | string | `status === approved` | Data/hora de expiração em ISO 8601 (UTC). |

#### 400 — `machine_id` ausente

```json
{
  "error": "machine_id obrigatório"
}
```

### Fluxo resumido no servidor

1. Se `machine_id` não existe → cria registro `pending` → retorna `{ "status": "pending" }`.
2. Se existe e `status !== "approved"` → retorna `{ "status": "pending" }`.
3. Se `approved` mas `expires_at` < agora → retorna `{ "status": "expired" }`.
4. Se `approved` e dentro da validade → retorna `approved` + `token` + `expires_at`.

### Comportamento recomendado no cliente

| `status`   | Ação sugerida |
|------------|----------------|
| `pending`  | Bloquear uso ou modo limitado; exibir mensagem de aguardando liberação; revalidar após intervalo (ex.: 5–15 min). |
| `expired`  | Bloquear uso; orientar renovação com o administrador. |
| `approved` | Permitir uso; opcionalmente validar o JWT localmente (seção 3). |

---

## 2. Obter chave pública — `GET /api/license/public-key`

Necessário para **verificar** o JWT retornado em `validate` no cliente (assinatura RS256).

### URL completa

```
GET {BASE_URL}/api/license/public-key
```

### Autenticação

Nenhuma.

### Payload

Nenhum (sem body).

### Resposta 200

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
}
```

### Resposta 500

```json
{
  "error": "Erro ao carregar chave pública"
}
```

**Sugestão:** buscar a chave uma vez na instalação ou no primeiro startup e cachear em disco/config; só atualizar se a verificação do token falhar por chave inválida.

---

## 3. Estrutura do JWT (`token`)

Algoritmo: **RS256**.  
Chave privada no servidor (`private.key`); chave pública exposta em `/public-key`.

### Claims do payload (dentro do JWT)

| Claim          | Tipo   | Descrição |
|----------------|--------|-----------|
| `machine_id`   | string | Mesmo ID enviado no validate |
| `machine_name` | string | Opcional |
| `machine_ip`   | string | Opcional |
| `company`      | string | Fixo: `"Empresa Interna"` |
| `plan`           | string | Fixo: `"internal"` |
| `exp`            | number | Expiração Unix (segundos), derivada de `expires_at` do banco |

### Validação no cliente (pseudológica)

1. Obter `publicKey` via `GET /api/license/public-key` (ou cache).
2. Verificar assinatura RS256 do `token`.
3. Conferir `exp` > agora.
4. Conferir `machine_id` do token === `machine_id` local.

Bibliotecas comuns: `jsonwebtoken` (Node), `System.IdentityModel.Tokens.Jwt` (.NET), `PyJWT` (Python), etc., sempre com algoritmo **RS256**.

---

## 4. Exemplos HTTP completos

### Validate — primeira execução (pending)

**Request**

```http
POST /api/license/validate HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "machine_id": "550e8400-e29b-41d4-a716-446655440000",
  "machine_name": "SERVIDOR-APP",
  "machine_ip": "10.0.0.5"
}
```

**Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "pending"
}
```

### Validate — licença ativa

**Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "approved",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

### Validate — erro de validação

**Request** (sem `machine_id`)

**Response**

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "machine_id obrigatório"
}
```

---

## 5. Endpoints administrativos (não usar no cliente final)

Estes endpoints existem na mesma API mas exigem JWT de admin (`Authorization: Bearer <token>`). O sistema cliente **não** deve usá-los em produção.

| Método | Rota | Uso |
|--------|------|-----|
| `GET`  | `/api/license/pending` | Listar máquinas pendentes |
| `POST` | `/api/license/approve`   | Body: `{ "machine_id", "days" }` — aprovar licença |

Aprovação no dia a dia pode ser feita pelo painel web: `/admin/licenses` (login em `/admin/login`).

---

## 6. Checklist para implementar a camada de licença no outro sistema

1. Gerar e persistir um `machine_id` único por instalação.
2. Configurar `LICENSE_API_BASE_URL` (ex.: `http://seu-servidor:3001`).
3. No startup (e periodicamente): `POST /api/license/validate` com `machine_id` (+ nome/IP/`system_name` opcionais).
4. Tratar `pending`, `expired` e `approved` conforme tabela da seção 1.
5. Se `approved`: opcionalmente cachear `token` e `expires_at`.
6. Baixar/cachear `publicKey` e validar o JWT antes de liberar recursos sensíveis.
7. Revalidar com o servidor antes de `expires_at` ou em intervalo fixo.

---

## 7. Prompt sugerido para o Cursor (outro projeto)

Copie e adapte no projeto cliente:

```
Implemente uma camada de licença que se comunica com o LicenseAPI.

Base URL configurável: LICENSE_API_BASE_URL

1) POST {BASE}/api/license/validate
   Body JSON: { machine_id (obrigatório), machine_name?, machine_ip?, system_name? }
   Respostas 200:
     - { status: "pending" } → bloquear app, mensagem aguardando liberação
     - { status: "expired" } → bloquear app, licença expirada
     - { status: "approved", token, expires_at } → liberar app
   Resposta 400: { error: "machine_id obrigatório" }

2) GET {BASE}/api/license/public-key
   Resposta: { publicKey: "-----BEGIN PUBLIC KEY-----..." }
   Usar para validar o JWT (RS256): claims machine_id, exp, company, plan.

Persistir machine_id localmente na primeira execução.
Revalidar periodicamente e ao iniciar.
```

---

*Gerado a partir do código em `src/routes/license.routes.js`, `src/controllers/license.controller.js` e `src/services/license.service.js`.*
