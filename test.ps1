
Write-Host "=== TESTES DO LICENSEAPI ===" -ForegroundColor Cyan
Write-Host ""

# Teste 1: Login
Write-Host "1. Testando LOGIN (POST /admin/login)" -ForegroundColor Yellow
try {
    $login = Invoke-WebRequest -Uri 'http://localhost:3001/admin/login' -Method POST -Body 'user=admin&pass=123456' -SessionVariable 'sess' -ErrorAction Stop
    Write-Host "   Status: OK (Redirecionado)" -ForegroundColor Green
} catch {
    Write-Host "   Erro: " $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Teste 2: Painel Licenses
Write-Host "2. Testando PAINEL LICENSES (/admin/licenses)" -ForegroundColor Yellow
try {
    $licenses = Invoke-WebRequest -Uri 'http://localhost:3001/admin/licenses' -WebSession $sess -ErrorAction Stop
    if ($licenses.StatusCode -eq 200) {
        Write-Host "   Status: 200 OK" -ForegroundColor Green
        Write-Host "   Tamanho HTML: " $licenses.Content.Length " bytes" -ForegroundColor Green
    }
} catch {
    Write-Host "   Erro: " $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Teste 3: Painel SQL
Write-Host "3. Testando PAINEL SQL (/admin/sql-panel) - NOVO" -ForegroundColor Yellow
try {
    $sql = Invoke-WebRequest -Uri 'http://localhost:3001/admin/sql-panel' -WebSession $sess -ErrorAction Stop
    if ($sql.StatusCode -eq 200) {
        Write-Host "   Status: 200 OK" -ForegroundColor Green
        Write-Host "   Tamanho HTML: " $sql.Content.Length " bytes" -ForegroundColor Green
        
        if ($sql.Content -match 'Painel SQL') {
            Write-Host "   Conteudo: Template carregado corretamente (✓)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   Erro ao acessar painel SQL: " $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTES CONCLUIDOS ===" -ForegroundColor Cyan
