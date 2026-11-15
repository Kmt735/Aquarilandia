# Deploy — Aquarilândia no ar (VPS + Docker + Caddy)

Roteiro para colocar o site no ar, num VPS Ubuntu (Hostinger) com domínio próprio. Siga **na ordem**, sem pular
passo. Cada bloco de comandos diz onde rodar: **no seu computador** ou **no servidor**. Decisão e motivos: D-53, em
`docs/decisoes.md`.

O que fica no ar, num servidor só:

```
internet ──443/80──▶ Caddy (HTTPS automático) ──▶ app (site + API, porta 3333 só na rede do Docker) ──▶ Postgres
                                                                                        (rede interna, sem porta)
```

- O site e a API ficam no **mesmo endereço** (`https://SEU_DOMINIO` e `https://SEU_DOMINIO/api`). O cookie de sessão
  (`httpOnly`, `SameSite=Lax`, `Secure`) depende disso.
- Só o Caddy abre portas (80 e 443). A app e o Postgres não publicam porta nenhuma.

Você vai precisar de:
- o VPS com Ubuntu 24.04, o IP dele e o acesso inicial;
- o domínio comprado, com acesso ao painel de DNS;
- a conta de **teste** da AbacatePay (Dev mode), com a chave que começa com `abc_dev_`;
- uma conta no **Resend** (e-mails: recuperação de senha e avisos de compra; plano gratuito);
- cerca de 1 hora.

> **Nunca** mande senha, chave ou o conteúdo do `.env.producao` por chat, e-mail ou print. Tudo que é segredo é gerado
> **no servidor** e fica só lá.

---

## 1. Servidor

### 1.1 Usuário sem root e SSH só com chave

**No seu computador**, se ainda não tiver uma chave SSH:

```bash
ssh-keygen -t ed25519 -C "deploy-aquarilandia"
```

**No servidor**, entrando como root uma única vez (`ssh root@IP_DO_VPS`):

```bash
adduser deploy                 # escolha uma senha forte (vai ser pedida no sudo)
usermod -aG sudo deploy
```

**No seu computador**, copie a chave para o usuário novo e teste:

```bash
ssh-copy-id deploy@IP_DO_VPS
ssh deploy@IP_DO_VPS          # precisa entrar SEM pedir a senha da conta
```

**No servidor** (já como `deploy`), desligue o login por senha e o login de root:

```bash
sudo nano /etc/ssh/sshd_config.d/10-seguranca.conf
```

Conteúdo do arquivo:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
```

```bash
sudo sshd -t && sudo systemctl restart ssh
```

> **Antes de fechar a sessão atual**, abra um **segundo terminal** e confira que `ssh deploy@IP_DO_VPS` ainda entra.
> Se não entrar, conserte pela sessão que ainda está aberta. Fechar as duas sem testar pode trancar você para fora.

### 1.2 Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

> **Atenção:** o Docker escreve regras próprias no firewall para toda porta **publicada** (`ports:` no compose), e
> elas passam por cima do ufw. Por isso a proteção de verdade é que nenhum serviço do `docker-compose.prod.yml`, além do
> Caddy, publica porta. **Nunca** acrescente `ports:` no `db` nem no `app`.

### 1.3 Atualizações automáticas de segurança

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # responda "Sim"
```

### 1.4 Docker (repositório oficial)

```bash
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker version            # precisa ser 28 ou mais novo (a rede interna usa o modo "isolated")
```

Rode o Docker sempre com `sudo`. **Não** ponha o usuário no grupo `docker`: quem está nesse grupo vira root na prática.

---

## 2. Domínio

No painel de DNS do domínio, crie um registro **A** com nome `@` (ou o subdomínio que for usar), valor = o IP do VPS,
e TTL baixo (300). Se houver um registro **AAAA** (IPv6) apontando para outro lugar, apague-o: o Caddy pode tentar o
certificado por ele e falhar.

Espere propagar e confira **no seu computador**:

```bash
dig +short SEU_DOMINIO        # tem que responder o IP do VPS
```

Só siga quando o `dig` responder o IP certo. Sem isso, o Caddy não consegue o certificado.

---

## 2b. Resend (e-mail)

Sem e-mail configurado, o servidor **não sobe** em produção (D-54). No painel do Resend (resend.com):

1. **Domains → Add Domain**: o mesmo domínio do site (ou um subdomínio, ex.: `mail.SEU_DOMINIO`).
2. O Resend mostra os registros DNS (TXT de SPF e DKIM, e um MX): crie **cada um** no painel de DNS do domínio,
   copiando nome e valor exatamente como aparecem.
3. Espere e clique em **Verify**. Só siga quando o domínio aparecer como **Verified**: sem isso, o Resend recusa o envio
   (`HTTP 403`) e nenhum e-mail sai.
4. **API Keys → Create API Key**, com permissão **Sending access** (só envio), restrita a esse domínio. A chave começa
   com `re_` e só aparece uma vez: cole direto no `.env.producao` do servidor (passo 3), nunca em chat.
5. O remetente (`EMAIL_REMETENTE`) é um endereço **desse domínio verificado**, ex.:
   `Aquarilândia <nao-responda@SEU_DOMINIO>`. Um endereço de outro domínio (ex.: um Gmail) é recusado pelo Resend.

---

## 3. Código e variáveis

**No servidor:**

```bash
cd ~
git clone https://github.com/Kmt735/Aquarilandia.git
cd Aquarilandia
git switch main
cd backend
cp .env.producao.example .env.producao
chmod 600 .env.producao
```

Gere os segredos **aqui no servidor** (cada comando mostra um valor novo; copie para o arquivo e não guarde em mais
lugar nenhum):

```bash
openssl rand -hex 32          # senha do banco (DB_PASSWORD e dentro do DATABASE_URL)
openssl rand -hex 32          # GATEWAY_WEBHOOK_SECRET (o mesmo vai no painel da AbacatePay, passo 6)
```

```bash
nano .env.producao
```

Troque **todo** `TROQUE_*`:

| Variável | Valor |
|---|---|
| `DOMINIO` | o domínio, sem `https://` (ex.: `loja.exemplo.com.br`) |
| `CORS_ORIGIN`, `FRONTEND_URL`, `API_URL` | `https://` + o domínio (os três iguais) |
| `DB_PASSWORD` | o primeiro `openssl rand -hex 32` |
| `DATABASE_URL` | `postgres://aquarilandia:<a MESMA senha>@db:5432/aquarilandia` |
| `GATEWAY_ACCESS_TOKEN` | a chave de **teste** da AbacatePay (`abc_dev_...`) |
| `GATEWAY_WEBHOOK_SECRET` | o segundo `openssl rand -hex 32` |
| `EMAIL_API_KEY` | a chave do Resend (`re_...`, passo 2b) |
| `EMAIL_REMETENTE` | um endereço do domínio verificado, ex.: `Aquarilândia <nao-responda@SEU_DOMINIO>` |
| `PERMITIR_SIMULACAO_PIX` | `true` **só** para a demonstração (com a chave de teste) |

Confira que não sobrou nenhum placeholder (o comando não imprime os valores):

```bash
grep -c TROQUE .env.producao   # tem que dar 0
```

---

## 4. Subir

**No servidor**, de dentro de `~/Aquarilandia/backend` (o primeiro build leva alguns minutos):

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml up -d --build
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml ps
```

Os três serviços (`db`, `app`, `caddy`) precisam aparecer como `running` (o `db` e o `app` como `healthy`). Depois:

```bash
curl -s https://SEU_DOMINIO/api/health          # {"status":"ok","banco":"ok"}
curl -sI http://SEU_DOMINIO | head -1           # 308: o HTTP redireciona para o HTTPS
```

Abra `https://SEU_DOMINIO` no navegador: o cadeado tem que aparecer, sem aviso de certificado.

Se der errado, olhe os logs (eles não têm senha nem token):

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml logs --tail=50 app
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml logs --tail=50 caddy
```

- `Variável de ambiente obrigatória ausente: X` ou `inválida: X` → corrija o `X` no `.env.producao` e rode o `up -d` de
  novo (com `EMAIL_API_KEY` ou `EMAIL_REMETENTE` ausentes ou inválidas, o servidor não sobe: passo 2b).
- O Caddy reclama do certificado → o DNS ainda não propagou (passo 2) ou a porta 80 está fechada (passo 1.2).

---

## 5. Dados de demonstração

**No servidor.** As senhas são digitadas sem aparecer na tela e não vão para o histórico:

```bash
read -s -p "Senha do admin: " SENHA_ADMIN && echo
read -s -p "Senha do cliente de demonstração: " SENHA_CLIENTE && echo
export SENHA_ADMIN SENHA_CLIENTE
sudo -E docker compose --env-file .env.producao -f docker-compose.prod.yml exec \
  -e DEMO_API_URL=http://localhost:3333 -e SENHA_ADMIN -e SENHA_CLIENTE \
  app node dist-scripts/scripts/dados-demo.js
unset SENHA_ADMIN SENHA_CLIENTE
```

O script cria (ou só confere, se já existir):
- o admin `admin.demo@exemplo.com`;
- o cliente `cliente.demo@exemplo.com`, com endereço em São João del Rei;
- 8 produtos com estoque, em Peixes, Rações e Acessórios.

Ele imprime só os e-mails, e pode rodar de novo sem duplicar nada. Para outros e-mails, acrescente
`-e DEMO_ADMIN_EMAIL=... -e DEMO_CLIENTE_EMAIL=...`. Guarde as duas senhas num gerenciador de senhas.

---

## 6. AbacatePay (webhook)

No painel da AbacatePay, **em Dev mode**, cadastre o webhook:

- **URL:** `https://SEU_DOMINIO/api/pagamentos/webhook`
- **Secret:** o `GATEWAY_WEBHOOK_SECRET` do `.env.producao`. É um segredo **novo**, gerado no passo 3: não reaproveite
  o do túnel de desenvolvimento.
- **Eventos:** `transparent.completed` e `transparent.refunded`.

Para ver o segredo sem imprimir o resto do arquivo: `grep '^GATEWAY_WEBHOOK_SECRET=' .env.producao`. Copie direto do
terminal para o painel.

Mudou alguma variável do `.env.producao` depois de subir? Aplique com:

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml up -d
```

---

## 7. Checklist final (faça tudo, nesta ordem)

1. **Cliente:** em `https://SEU_DOMINIO`, entre com o cliente de demonstração, ponha um produto no carrinho, escolha a
   entrega e feche a compra.
2. **Pix:** gere o código Pix; o QR code aparece.
3. **Simulação:** com o admin, chame `POST /api/pagamentos/<id>/simular` (veja `http/clientes-vendas.http`). A compra
   fica paga.
4. **Webhook chegando:** faça outra compra e simule o pagamento. Em segundos, um evento `transparent.completed`
   processado aparece em:
   ```bash
   sudo docker compose --env-file .env.producao -f docker-compose.prod.yml exec db \
     psql -U aquarilandia -d aquarilandia -c "SELECT tipo, processado_em, tentativas FROM eventos_webhook ORDER BY id DESC LIMIT 3"
   ```
5. **Cancelamento:** cancele uma compra paga pelo cliente; o estorno volta e a compra fica cancelada.
   **E-mail:** o cliente de demonstração recebe os avisos (pagamento confirmado, compra cancelada). Peça também
   "Esqueci a senha" com o e-mail dele: o link chega em segundos. Não chegou? Veja no painel do Resend (**Emails**) o
   status do envio e se o domínio continua **Verified**; o log da app só diz `falha ao enviar`, sem o e-mail.
6. **Admin:** com o admin, liste as vendas (`GET /api/vendas`) e avance uma para `em_separacao`.
7. **Cabeçalhos** (no seu computador):
   ```bash
   curl -sI https://SEU_DOMINIO | grep -iE 'strict-transport|content-security|x-content-type|referrer-policy'
   ```
   Os quatro têm que aparecer.
8. **Postgres fechado** (no seu computador, de FORA do servidor). Os dois têm que falhar:
   ```bash
   nc -vz -w 5 SEU_DOMINIO 5432       # tem que dar timeout ou "refused"
   nc -vz -w 5 SEU_DOMINIO 3333       # a app também não pode responder direto
   ```
9. **Logs sem dados sensíveis** (no servidor). Os dois `grep` têm que dar 0 (o log de acesso do Caddy grava o caminho sem
   a query string, e nada de cookie):
   ```bash
   sudo docker compose --env-file .env.producao -f docker-compose.prod.yml logs > /tmp/logs.txt 2>&1
   grep -c 'webhookSecret=' /tmp/logs.txt
   grep -c 'sid=' /tmp/logs.txt
   rm /tmp/logs.txt
   ```
10. **Depois da demonstração:** volte `PERMITIR_SIMULACAO_PIX=false` e rode o `up -d`. A rota de simulação deixa de
    existir (404).

---

## 8. Atualizar o site

**No servidor**, de dentro de `~/Aquarilandia/backend`:

```bash
git pull
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml up -d --build
```

> **Banco:** os arquivos de `db/init` só rodam na **primeira** subida (volume vazio). Se a atualização trouxer um
> arquivo SQL novo (ex.: `23_*.sql`), aplique à mão, como diz o topo dele:
> `sudo docker compose --env-file .env.producao -f docker-compose.prod.yml exec -T db psql -U aquarilandia -d aquarilandia < db/init/23_xxx.sql`
>
> **Nunca** rode `down -v` em produção: o `-v` apaga o volume do banco (todas as vendas e contas).

---

## 9. Backup do banco

**No servidor** (gera o arquivo do dia):

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml exec -T db \
  pg_dump -U aquarilandia -d aquarilandia --format=custom > ~/backup-$(date +%F).dump
```

**No seu computador**, traga o arquivo para FORA do servidor e apague a cópia de lá:

```bash
scp deploy@IP_DO_VPS:~/backup-AAAA-MM-DD.dump ./
ssh deploy@IP_DO_VPS 'rm ~/backup-AAAA-MM-DD.dump'
```

O backup tem dados pessoais dos clientes (nome, e-mail, telefone, endereço): guarde num lugar protegido e não mande
por chat. Para restaurar (num banco vazio):
`sudo docker compose --env-file .env.producao -f docker-compose.prod.yml exec -T db pg_restore -U aquarilandia -d aquarilandia --clean --if-exists < backup-AAAA-MM-DD.dump`.
