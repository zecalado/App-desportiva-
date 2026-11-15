# Gestão de Plantel — Séniores

Duas formas de utilização:
- **Versão online** (equipa técnica, com contas e perfis): <https://zecalado.github.io/App-desportiva-/> — configuração em [CONFIGURAR.md](CONFIGURAR.md).
- **Protótipo local** (`GestaoPlantel.html`): um único ficheiro, dados guardados só no browser.


Aplicação para registar plantel, jogos (convocatória e eventos) e treinos. Os
registos que antes eram feitos à mão em Excel (Registo Geral, Registo de Jogos e
Disciplina) passam a ser **calculados automaticamente**.

## Como usar
1. Abrir `GestaoPlantel.html` num browser (Chrome, Edge ou Firefox). Não precisa de internet nem de instalação.
2. Em **Dados → Carregar dados de exemplo** para experimentar, ou começar do zero em **Plantel**.
3. Fluxo de um jogo: **Jogos → + Novo jogo** → preencher dados → **Convocatória** (titular/suplente/indisponível) → **Eventos** (golos, cartões, substituições com o minuto).
4. **Treinos**: criar sessão; todos ficam “Presente” por defeito, altera-se só as exceções.
5. **Estatísticas** e **Disciplina** atualizam-se sozinhas. **Dados → Exportar** gera o Excel.
6. **Importar plantel de Excel** (Plantel ou Dados → *Importar Excel…*): reconhece o “Registo Geral Plantel”, o Excel exportado pela aplicação ou o modelo em branco. Mostra as colunas detetadas e uma pré-visualização com avisos antes de gravar. Jogadores com o mesmo nome são atualizados; os outros são adicionados; nada é apagado. Só `.xlsx` (um `.xls` antigo tem de ser guardado como `.xlsx`).
7. **Importar jogos** (Jogos → *Importar Excel…*): três folhas ligadas pela data — *Jogos* (Data, Competição, Jornada, Adversário, Local, Duração, Notas), *Convocatórias* (Data, Jogador, Situação, Nº) e *Eventos* (Data, Minuto, Tipo, Jogador, Assistência / Entra, Penálti, Descrição). Jogos já existentes na mesma data são ignorados, salvo se escolher substituí-los.
8. **Importar treinos** (Treinos → *Importar Excel…*): grelha com um jogador por linha e uma coluna por data; células P/F/L/D.
9. Há modelos com instruções em **Dados**. O Excel exportado usa os mesmos formatos: pode ser editado e importado de volta. Importe sempre o plantel primeiro.

### Limitações do protótipo local
- Os dados ficam **só no browser deste computador**. Não há partilha entre a equipa técnica nem contas de utilizador. Fazer **cópias de segurança** (Dados → Descarregar cópia de segurança).
- Os dados clínicos não têm ainda controlo de acesso.
- Regras assumidas: 2º amarelo no mesmo jogo = expulsão; o limite de amarelos para castigo é configurável e só gera alertas.

## Dados de exemplo
Os dados de exemplo (`src/seed.ts`) são **fictícios**: jogadores, clubes, datas, jogos e treinos inventados. Não coloque dados reais de jogadores neste repositório (é público); os dados reais ficam apenas na aplicação de cada utilizador e nas suas cópias de segurança.

## Para quem desenvolve
- `npm install` · `npm test` (regras, importação, sincronização)
- `npm run dev` — desenvolvimento (online se existir `.env.production`/`.env`; senão local) · `npm run dev:falso` — com servidor simulado (contas `admin@teste.pt`, `tecnico@teste.pt`, `medico@teste.pt`, `novo@teste.pt`; palavra-passe `teste1234`)
- `npm run build` — versão online (`dist/`, publicada pelo GitHub Actions) · `npm run build:local` — protótipo em ficheiro único (`GestaoPlantel.html`)
- Online: `src/servidor.ts` (contrato), `src/servidorSupabase.ts`, `src/sincronizacao.ts` (envia só os registos alterados), `supabase/schema.sql` (tabelas e regras de acesso por perfil).
- `src/types.ts` — modelo de dados · `src/calc.ts` — regras (minutos, estados, disciplina, validações) · `src/importar.ts` — leitura de Excel e plantel · `src/importarAtividade.ts` — jogos e treinos · `src/excel.ts` — exportação · `src/store.ts` — armazenamento local (protótipo).
