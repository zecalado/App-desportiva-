# Pôr a versão online a funcionar

Guia para o administrador. Demora cerca de 20–30 minutos e só se faz uma vez.
Os nomes dos menus do Supabase podem variar ligeiramente.

## 1. Criar o projeto no Supabase
1. Criar conta em <https://supabase.com> (plano **Free**).
2. **New project**:
   - **Name:** `gestao-plantel` (ou outro).
   - **Database password:** gerar uma e **guardá-la num local seguro** (não é preciso para a aplicação, mas é necessária para operações de manutenção).
   - **Region:** escolher uma região **na Europa** (dados pessoais e de saúde — RGPD).
3. Aguardar alguns minutos até o projeto ficar pronto.

## 2. Criar a base de dados
1. Menu **SQL Editor → New query**.
2. Copiar todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql), colar e carregar em **Run**.
3. Deve aparecer “Success”. (Pode ser executado de novo sem perder dados.)

## 3. Fechar o registo público
**Authentication → Sign In / Providers** (ou *Settings*) → desligar **Allow new users to sign up**.
Assim só o administrador cria contas.

## 4. Endereço da aplicação
**Authentication → URL Configuration**:
- **Site URL:** `https://zecalado.github.io/App-desportiva-/`
- **Redirect URLs:** adicionar o mesmo endereço.

## 5. Criar a sua conta (fica administrador)
**Authentication → Users → Add user → Create new user**: o seu email, uma palavra-passe, e marcar **Auto Confirm User**.
A **primeira** conta criada fica automaticamente com o perfil **Administrador**.

## 6. Ligar a aplicação ao projeto
Em **Project Settings → API Keys** (ou *API*), copiar:
- **Project URL** (ex.: `https://abcdefgh.supabase.co`)
- a chave **publishable** (`sb_publishable_...`) ou, em projetos mais antigos, a **anon public**.

Estes dois valores são públicos por natureza (ficam visíveis no browser); a proteção dos dados é feita pelas regras da base de dados criadas no passo 2.
**Nunca** use nem partilhe a chave **secret** / **service_role**.

Criar (ou pedir para criar) o ficheiro `.env.production` na raiz do repositório:
```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
```

## 7. Ativar o GitHub Pages
No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
A partir daí, cada alteração enviada para `main` é testada e publicada automaticamente em
<https://zecalado.github.io/App-desportiva-/> (separador **Actions** mostra o progresso).

## 8. Adicionar a equipa técnica
Para cada pessoa:
1. Supabase → **Authentication → Users → Add user → Create new user** — email + palavra-passe temporária + **Auto Confirm User**.
2. Entregar a palavra-passe temporária em mão/por telefone.
3. Na aplicação → **Utilizadores** → atribuir o perfil (Técnico ou Médico / Fisioterapia).
4. A pessoa entra e muda a palavra-passe em **A minha conta**.

Para retirar acesso: desmarcar **Ativo** na página Utilizadores.

## 9. Passar os dados do protótipo
1. No protótipo (`GestaoPlantel.html`): **Dados → Descarregar cópia de segurança** (ficheiro `.json`).
2. Na versão online, como administrador: **Dados → Restaurar cópia de segurança…** e escolher o ficheiro.
3. Confirmar no Plantel/Jogos/Treinos e esperar por “✓ Tudo guardado” no canto inferior esquerdo.

## Limitações do plano gratuito (confirmar em supabase.com/pricing)
- **Pausa por inatividade:** o projeto é pausado após cerca de **7 dias sem utilização** (ex.: férias). Os dados não se perdem; para reativar: painel do Supabase → projeto → **Restore/Resume**.
- **Cópias de segurança:** não conte com cópias automáticas no plano gratuito. Descarregue uma cópia de segurança (Dados) **semanalmente**.
- **Emails:** sem um servidor de email próprio (SMTP), o Supabase só envia emails a membros da equipa do projeto e com um limite muito baixo (cerca de 2/hora). Por isso as contas são criadas com palavra-passe temporária (passo 8) e a opção “Esqueci-me da palavra-passe” pode não funcionar.
  - *Opcional:* configurar SMTP em **Authentication → Emails → SMTP Settings** (por exemplo, com um serviço de email transacional com plano gratuito). Depois disso, convites e recuperação por email passam a funcionar.

## Perfis
| Perfil | Plantel, jogos, treinos, relatórios | Dados clínicos | Utilizadores e registo de alterações |
|---|---|---|---|
| Administrador | ✔ | ✔ | ✔ |
| Técnico | ✔ | ✘ | ✘ |
| Médico / Fisioterapia | ✔ | ✔ | ✘ |
| Sem perfil / inativo | ✘ | ✘ | ✘ |

As regras são aplicadas pela base de dados (não apenas pela interface).
