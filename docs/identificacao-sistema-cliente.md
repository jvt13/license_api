# Identificação do sistema consumidor da licença

Documentação para sistemas clientes que consomem o LicenseAPI e precisam informar **qual aplicação** está solicitando a licença.

Para o fluxo completo de validação, consulte [integracao-cliente-licenca.md](./integracao-cliente-licenca.md).

---

## Objetivo

Permitir que o servidor de licenças e o painel administrativo identifiquem **qual sistema** está vinculado a cada `machine_id`, preparando o ambiente para múltiplos produtos clientes no mesmo servidor.

O cliente deve enviar um identificador legível (`system_name`) junto com a validação habitual. O servidor registra também a **data/hora da primeira solicitação** (`request_date`), preservada para histórico.

---

## Compatibilidade

Clientes **já instalados** que não enviam `system_name` continuam funcionando sem alteração:

- `POST /api/license/validate` aceita o body anterior (`machine_id`, `machine_name`, `machine_ip`).
- Respostas (`pending`, `approved`, `expired`) permanecem iguais.
- JWT **não foi alterado** (sem claim `system_name`).

No painel administrativo, máquinas sem o campo exibem **"Não informado"** em Sistema e **"-"** em Solicitado em (registros anteriores à feature).

---

## Campo novo: `system_name`

| Propriedade | Valor |
|-------------|--------|
| Nome        | `system_name` |
| Tipo        | string |
| Obrigatório | **Não** |
| Onde enviar | Body JSON de `POST /api/license/validate` |

### Exemplos de valor

- `Sistema Estacionamento`
- `App Mobile Operacional`
- `Sistema Financeiro`
- `Aplicativo Desktop`

Use um nome **estável e único por produto** (não por instalação). Todas as instalações do mesmo produto devem enviar o mesmo `system_name`.

### Expansão futura (não implementados)

Reservados para versões futuras; **não enviar** até documentados na API:

- `app_name`
- `app_version`

---

## Comportamento no servidor

| Campo | Primeira solicitação (`machine_id` novo) | Revalidações seguintes |
|-------|------------------------------------------|-------------------------|
| `request_date` | Gravado em ISO 8601 UTC | **Não alterado** (mantém a primeira solicitação) |
| `system_name` | Gravado se enviado | Atualizado **somente** se o cliente enviar valor diferente do cadastrado |

Isso preserva o histórico de quando a licença foi solicitada pela primeira vez e permite corrigir o nome do sistema se o cliente passar a enviar um valor mais preciso.

---

## Exemplo de envio

### Request

```http
POST /api/license/validate HTTP/1.1
Host: seu-servidor:3001
Content-Type: application/json

{
  "machine_id": "550e8400-e29b-41d4-a716-446655440000",
  "machine_name": "PC-FINANCEIRO-01",
  "machine_ip": "192.168.1.50",
  "system_name": "Sistema Financeiro"
}
```

### Mínimo (cliente antigo — continua válido)

```json
{
  "machine_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Resposta

Inalterada em relação à integração anterior; o servidor apenas persiste os novos campos internamente.

```json
{
  "status": "pending"
}
```

---

## Checklist no cliente

1. Definir constante ou config com o nome do produto (ex.: `LICENSE_SYSTEM_NAME=Sistema Financeiro`).
2. Incluir `system_name` em todo `POST /api/license/validate`.
3. Manter `machine_id` estável por instalação.
4. Não depender de `system_name` no JWT (não está no token).

---

*Referência de implementação: `src/services/license.service.js`, `src/models/license.model.js`.*
