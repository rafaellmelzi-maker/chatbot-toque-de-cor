// ════════════════════════════════════════════════════════════════════
// SIMULAÇÃO AVANÇADA MULTI-AMBIENTES — TINTOR
// Cenário: Reforma completa (7 ambientes) | Validação enterprise
// ════════════════════════════════════════════════════════════════════
const http = require('http');

const BASE_URL  = 'http://34.151.205.223';
const ADMIN_EMAIL    = 'admin@toquedeor.com.br';
const ADMIN_PASSWORD = 'Admin@2024!';
const TENANT_ID = '77496429-3b99-470a-a39e-b555caedecf8';
const STORE_ID  = '090bac6a-2d19-4562-9622-9d453450e140';

const DELAY_MS = 4500;

// ─── SEQUÊNCIA DE MENSAGENS ────────────────────────────────────────
// 20 mensagens cobrindo todos os 7 ambientes + context updates + transferência
const CLIENTE_MSGS = [

  // ── FASE 1: Projeto completo (ambientes externos) ─────────────────

  // MSG 1 — Abertura com projeto grande
  'Oi! Estou reformando minha casa completa e preciso de ajuda com tintas. São vários ambientes: fachada, sala, quarto das crianças, cozinha, portão de ferro, portas de madeira e ainda tenho uma área gourmet no quintal. Por onde começo?',

  // MSG 2 — Detalhes da fachada
  'A fachada tem 220m² e está em estado ruim: tem mofo em bastante lugar, está descascando bastante, e pega muito sol da tarde e chuva. Moro em São Paulo. Quero algo que dure pelo menos 10 anos.',

  // MSG 3 — Sala interna
  'A sala tem 70m². Quero um acabamento sofisticado, precisa ter fácil limpeza porque tenho cachorro e duas crianças. Não quero aquele fosco barato que mancha fácil.',

  // MSG 4 — Quarto infantil
  'O quarto das crianças tem 40m². Eles são pequenos, adoram desenhar na parede. Precisa ser lavável de verdade, resistente, e sem aquele cheiro forte de tinta. As crianças são sensíveis.',

  // MSG 5 — Cozinha
  'A cozinha tem 35m². Precisa ser resistente à gordura e à umidade, porque a gente cozinha bastante. Fica úmida no inverno.',

  // MSG 6 — Portão metálico
  'O portão de entrada é metálico, bem enferrujado. Está pior que eu esperava. Precisa pintar urgente antes de chover mais.',

  // MSG 7 — Madeira: portas e janelas
  'Tenho 6 portas internas e 4 janelas de madeira. Quero dar uma revitalizada nelas com verniz. Como fica melhor, brilhante ou fosco?',

  // MSG 8 — Piso externo (área gourmet)
  'A área gourmet tem o piso de concreto, uns 25m². Alto tráfego, fica molhado quando chove. Precisa de alguma pintura especial pra piso?',

  // ── FASE 2: Context updates (mudanças de contexto) ─────────────────

  // MSG 9 — Muda metragem da fachada (220→200m²) e adiciona corredor
  'Ah, errei a metragem da fachada. São 200m² na verdade, não 220m². E lembrei que tem um corredor externo lateral de uns 30m² que também precisa pintar com o mesmo produto da fachada.',

  // MSG 10 — Muda acabamento da sala (sofisticado → fosco premium)
  'Na sala eu mudei de ideia: pode ser fosco premium mesmo, mas um fosco de qualidade que não mancha. Qual a diferença entre o fosco premium e o acetinado?',

  // ── FASE 3: Consulta técnica e comercial ──────────────────────────

  // MSG 11 — Custo-benefício (NÃO deve transferir — AINDA em consulta)
  'Entre Suvinil e Sherwin-Williams, qual tem melhor custo-benefício para um projeto desse tamanho? Vale a pena investir no premium?',

  // MSG 12 — Produto para mofo específico
  'Para o mofo da fachada: vocês têm algum produto específico antimofos ou eu trato com hipoclorito e depois pinto qualquer tinta?',

  // ── FASE 4: Quantidades e sequência ──────────────────────────────

  // MSG 13 — Pede sequência de aplicação por ambiente
  'Qual a ordem correta para fazer tudo? Começo pela fachada ou pelos ambientes internos? E no metal, qual a sequência antes de pintar?',

  // MSG 14 — Pede quantidade de material estimada
  'Consegue me dizer quantas latas de cada produto vou precisar, por ambiente? Só uma estimativa.',

  // ── FASE 5: Orçamento técnico organizado ─────────────────────────

  // MSG 15 — Pede orçamento técnico organizado (trigger para 📋 RESUMO)
  'Pode me mostrar um orçamento técnico organizado por ambiente? Quero ver separado: fachada, sala, quarto, cozinha, portão, madeira e piso. Com preparação e tinta. Duas opções de marca.',

  // MSG 16 — Comparação Suvinil vs Sherwin side-by-side
  'Pode fazer uma comparação Suvinil vs Sherwin-Williams para cada ambiente? Quero entender as diferenças de cada produto.',

  // ── FASE 6: Validação de contexto e robustez ─────────────────────

  // MSG 17 — Verifica se esqueceu algo (teste de contexto total)
  'Tem alguma coisa que eu esqueci de considerar? Produto de preparação, selador, fundo, alguma etapa importante que eu não perguntei?',

  // MSG 18 — Pede validação técnica de compatibilidade
  'Os produtos que você recomendou são todos compatíveis entre si? Por exemplo, posso usar o fundo de uma marca com a tinta de outra?',

  // ── FASE 7: Pedido de preço → transferência ───────────────────────

  // MSG 19 — Preço após orçamento completo (deve transferir se dual-brand ok)
  'Projeto lindo! Agora preciso saber os valores. Quanto custa tudo isso que você recomendou? Quero o orçamento com preços para decidir.',

  // MSG 20 — Confirmação de interesse + pede contato de loja
  'Pode me passar o contato de um vendedor especializado? Quero fechar isso essa semana.',
];

// ─── Utilities ────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '34.151.205.223',
      port: 80,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function printDivider(c = '─', n = 72) { console.log(c.repeat(n)); }
function printSection(t) { printDivider('═'); console.log(`  ${t}`); printDivider('═'); }

// ─── AVALIADOR MULTI-AMBIENTE ──────────────────────────────────────

function avaliar(conversas) {
  const bot = conversas.filter(c => c.role === 'bot').map(c => c.content);
  const full = bot.join(' ');
  const low  = full.toLowerCase();

  const cr = {
    tecnica:      { score: 0, notas: [] },
    comercial:    { score: 0, notas: [] },
    ux:           { score: 0, notas: [] },
    naturalidade: { score: 0, notas: [] },
    contexto:     { score: 0, notas: [] },
    organizacao:  { score: 0, notas: [] },
    transferencia:{ score: 0, notas: [] },
    robustez:     { score: 0, notas: [] },
  };

  // ══════════════════════════════════════════
  // TÉCNICA (8 checagens × 12.5 = 100)
  // ══════════════════════════════════════════

  const tecChecks = [
    {
      regex: /anticorrosivo|fundo.{0,15}anti.?ferrug|primer.{0,20}metal|primer.{0,20}ferro/i,
      ok: '✅ Anticorrosivo/primer metálico recomendado para o portão',
      fail: '❌ NÃO mencionou anticorrosivo para metal — erro técnico grave',
    },
    {
      regex: /mofo|fungicida|anti.?mof|sanit|hipoclorito|lixo.{0,20}mofo|remov.{0,20}mofo/i,
      ok: '✅ Tratamento/remoção de mofo orientado',
      fail: '❌ NÃO orientou tratamento do mofo na fachada',
    },
    {
      regex: /fundo preparador|loxon fundo|selador.{0,30}reboco|primer.{0,30}reboco|fundo.{0,30}parede/i,
      ok: '✅ Fundo preparador para reboco antigo recomendado',
      fail: '❌ NÃO recomendou fundo preparador (reboco antigo exige)',
    },
    {
      regex: /verniz|enverniz|acabamento.{0,20}madeira|verniz.{0,30}madeira|madeira.{0,30}verniz/i,
      ok: '✅ Verniz para madeira recomendado (portas/janelas)',
      fail: '❌ NÃO recomendou verniz para madeira — esqueceu o item',
    },
    {
      regex: /piso.{0,50}(epoxi|poliuretano|laca|solv|alta.?resist|alto.?tr[aá]fego|cimento|externo|gourmet)|tinta.{0,30}piso/i,
      ok: '✅ Produto específico para piso de alta resistência recomendado',
      fail: '❌ NÃO recomendou produto adequado para piso externo/alto tráfego',
    },
    {
      // Verificação NEGATIVA: não deve RECOMENDAR massa corrida em fachada (exclui proibições/negações)
      test: (txt) => {
        const re = /massa corrida.{0,80}fachada|fachada.{0,80}massa corrida|massa corrida.{0,80}externo|externo.{0,80}massa corrida/gi;
        let m;
        while ((m = re.exec(txt)) !== null) {
          const snippet = txt.slice(Math.max(0, m.index - 60), m.index + m[0].length + 15);
          // Se há negação no contexto, é uma proibição correta (não é erro)
          if (!/(nunca|jamais|n[ãa]o|NÃO|NUNCA|proibid|somente\s+intern|apenas\s+intern|uso\s+intern|exclusiv|para\s+intern|intern[a-z]*[\/,]\s*extern)/i.test(snippet)) {
            return true; // recomendação positiva = erro
          }
        }
        return false;
      },
      invertido: true,
      ok: '✅ NÃO recomendou massa corrida em fachada (correto)',
      fail: '❌ Recomendou massa corrida em fachada — erro técnico grave',
    },
    {
      // Verificação NEGATIVA: não deve usar tinta interna em área externa
      regex: /tinta (l[aá]tex|pl[aá]stica|interna).{0,50}fachada|fachada.{0,50}tinta (l[aá]tex|pl[aá]stica|interna)/i,
      invertido: true,
      ok: '✅ Não recomendou tinta interna para fachada',
      fail: '❌ Recomendou tinta interna (látex/plástica) para fachada externa',
    },
    {
      // Tratamento de mofo ANTES da pintura (sequência correta)
      regex: /tratar.{0,40}mofo.{0,80}pintar|remov.{0,30}mofo.{0,60}ap[oó]s|primer.{0,30}ap[oó]s.{0,30}mofo|limpar.{0,50}mofo|limpeza.{0,50}mofo|tratamento.{0,30}mofo|antes.{0,40}pintar.{0,40}mofo|mofo.{0,40}antes|secar.{0,60}antes.{0,60}(tinta|pintar)/i,
      ok: '✅ Sequência correta: tratar mofo ANTES de pintar',
      fail: '⚠️ Não deixou claro que mofo deve ser tratado ANTES da tinta',
    },
  ];

  for (const chk of tecChecks) {
    const match = chk.test ? chk.test(full) : chk.regex.test(full);
    const passed = chk.invertido ? !match : match;
    if (passed) {
      cr.tecnica.score += 12.5;
      cr.tecnica.notas.push(chk.ok);
    } else {
      cr.tecnica.notas.push(chk.fail);
    }
  }
  cr.tecnica.score = Math.round(cr.tecnica.score);

  // ══════════════════════════════════════════
  // COMERCIAL (5 checagens × 20 = 100)
  // ══════════════════════════════════════════

  if (/suvinil/i.test(full)) {
    cr.comercial.score += 20;
    cr.comercial.notas.push('✅ Opção Suvinil apresentada');
  } else {
    cr.comercial.notas.push('❌ Suvinil não foi apresentada');
  }

  if (/sherwin|metalatex|loxon|sw\b/i.test(full)) {
    cr.comercial.score += 20;
    cr.comercial.notas.push('✅ Opção Sherwin-Williams apresentada');
  } else {
    cr.comercial.notas.push('❌ Sherwin-Williams não foi apresentada');
  }

  if (/fundo|selador|primer|prepara[cç][aã]o|preparo/i.test(full)) {
    cr.comercial.score += 20;
    cr.comercial.notas.push('✅ Upsell de preparação (fundo/selador/primer)');
  } else {
    cr.comercial.notas.push('⚠️ Sem upsell de preparação');
  }

  // Dual-brand por ambiente (verifica se ambas as marcas aparecem juntas no contexto)
  const suvinilAmb  = /suvinil.{0,200}(fachada|sala|quarto|cozinha|port[aã]o|madeira|piso)/i.test(full);
  const sherwinAmb  = /(sherwin|metalatex|loxon).{0,200}(fachada|sala|quarto|cozinha|port[aã]o|madeira|piso)/i.test(full);
  if (suvinilAmb && sherwinAmb) {
    cr.comercial.score += 20;
    cr.comercial.notas.push('✅ Dual-brand apresentado por ambiente');
  } else {
    cr.comercial.notas.push('⚠️ Dual-brand não claramente por ambiente');
    cr.comercial.score += 10;
  }

  // Verificar ausência de preços
  if (/r\$\s*[\d,.]|\d[\d,.]*\s*reais\b|\d[\d,.]*\s*real\b|custa\s+r?\$?\s*\d|valor\s+r?\$?\s*\d/i.test(full)) {
    cr.comercial.notas.push('❌ CITOU PREÇO — violação de regra comercial');
  } else {
    cr.comercial.score += 20;
    cr.comercial.notas.push('✅ Nunca citou preços (correto)');
  }

  // ══════════════════════════════════════════
  // UX (5 × 20 = 100)
  // ══════════════════════════════════════════

  if (bot.length >= 12) {
    cr.ux.score += 20;
    cr.ux.notas.push(`✅ Conversa longa e completa (${bot.length} respostas)`);
  } else if (bot.length >= 8) {
    cr.ux.score += 10;
    cr.ux.notas.push(`⚠️ Conversa moderada (${bot.length} respostas)`);
  } else {
    cr.ux.notas.push(`❌ Conversa muito curta (${bot.length} respostas)`);
  }

  const ambientesCobertos = [
    { nome: 'fachada', re: /fachada/i },
    { nome: 'sala',    re: /\bsala\b/i },
    { nome: 'quarto',  re: /quarto/i },
    { nome: 'cozinha', re: /cozinha/i },
    { nome: 'portão',  re: /port[aã]o|metal|ferro/i },
    { nome: 'madeira', re: /madeira|verniz|porta|janela/i },
    { nome: 'piso',    re: /\bpiso\b|gourmet/i },
  ];
  const cobertosPct = ambientesCobertos.filter(a => a.re.test(full)).length;
  if (cobertosPct >= 6) {
    cr.ux.score += 20;
    cr.ux.notas.push(`✅ ${cobertosPct}/7 ambientes mencionados nas respostas`);
  } else if (cobertosPct >= 4) {
    cr.ux.score += 10;
    cr.ux.notas.push(`⚠️ Apenas ${cobertosPct}/7 ambientes cobertos`);
  } else {
    cr.ux.notas.push(`❌ Somente ${cobertosPct}/7 ambientes nas respostas — contexto perdido`);
  }

  if (/crian[cç]|pet|cachorro|lav[aá]v|sem.?odor|baixo.?odor/i.test(full)) {
    cr.ux.score += 20;
    cr.ux.notas.push('✅ Considerou necessidades especiais (crianças/pets/baixo odor)');
  } else {
    cr.ux.notas.push('⚠️ Não mencionou necessidades especiais da família');
    cr.ux.score += 5;
  }

  if (/consultor|especialista|vendedor|posso ajudar|mais d[uú]vida/i.test(full)) {
    cr.ux.score += 20;
    cr.ux.notas.push('✅ Postura consultiva e prestativa');
  } else {
    cr.ux.score += 10;
    cr.ux.notas.push('⚠️ Postura consultiva pouco evidenciada');
  }

  // Marcas proibidas
  if (/coral\b|lukscolor|hydronorth|eucatex|renner\b/i.test(full)) {
    cr.ux.notas.push('❌ Citou marca concorrente proibida!');
  } else {
    cr.ux.score += 20;
    cr.ux.notas.push('✅ Nenhuma marca proibida citada');
  }

  // ══════════════════════════════════════════
  // NATURALIDADE (3 × 33.3 ≈ 100)
  // ══════════════════════════════════════════

  const avgLen = bot.reduce((a, b) => a + b.length, 0) / (bot.length || 1);
  if (avgLen > 500) {
    cr.naturalidade.score += 34;
    cr.naturalidade.notas.push(`✅ Respostas ricas e detalhadas (média ${Math.round(avgLen)} chars)`);
  } else if (avgLen > 300) {
    cr.naturalidade.score += 20;
    cr.naturalidade.notas.push(`⚠️ Respostas moderadas (média ${Math.round(avgLen)} chars)`);
  } else {
    cr.naturalidade.notas.push(`❌ Respostas muito curtas (média ${Math.round(avgLen)} chars)`);
  }

  const proibidas = /qualquer tinta serve|qualquer produto serve|verificar.{0,30}cat[aá]logo|consultar.{0,30}portf[oó]lio|n[aã]o tenho acesso em tempo real|vou verificar agora|infelizmente n[aã]o posso|n[aã]o tenho informa[cç][aõ]es|posso te ajudar com outras.{0,20}d[uú]vidas/i;
  if (proibidas.test(full)) {
    cr.naturalidade.notas.push('❌ Usou linguagem genérica/de deflexão proibida');
  } else {
    cr.naturalidade.score += 33;
    cr.naturalidade.notas.push('✅ Sem linguagem genérica ou de deflexão');
  }

  if (/\?|como|porque|qual|voc[eê]|seu|sua|sua.{0,20}casa|seu.{0,20}projeto/i.test(full)) {
    cr.naturalidade.score += 33;
    cr.naturalidade.notas.push('✅ Tom conversacional e personalizado');
  } else {
    cr.naturalidade.notas.push('⚠️ Tom muito técnico/impessoal');
    cr.naturalidade.score += 15;
  }

  // ══════════════════════════════════════════
  // CONTEXTO (7 × ~14.3 = 100)
  // ══════════════════════════════════════════

  let ctxScore = 0;
  const ctxChecks = [
    { re: /mofo/i, ok: '✅ Contexto mofo da fachada mantido', fail: '❌ Contexto mofo perdido' },
    { re: /port[aã]o|ferro|metal/i, ok: '✅ Contexto portão metálico mantido', fail: '❌ Contexto portão perdido' },
    { re: /crian[cç]|pet|cachorro/i, ok: '✅ Contexto família (crianças/pets) mantido', fail: '⚠️ Contexto família não mencionado' },
    { re: /madeira|verniz|porta|janela/i, ok: '✅ Contexto madeira/verniz mantido', fail: '❌ Contexto madeira perdido' },
    { re: /\bpiso\b|gourmet/i, ok: '✅ Contexto piso externo/gourmet mantido', fail: '❌ Contexto piso perdido' },
    { re: /200|230|220.?m|fachada.{0,30}m[²2]|m[²2].{0,30}fachada/i, ok: '✅ Metragem da fachada referenciada', fail: '⚠️ Metragem não citada nas respostas' },
    { re: /s[aã]o paulo|sp\b|cozinha|umidade/i, ok: '✅ Contexto cozinha/umidade/localidade mantido', fail: '⚠️ Contexto cozinha ou localidade não mencionado' },
  ];
  for (const c of ctxChecks) {
    if (c.re.test(full)) {
      ctxScore += Math.round(100 / ctxChecks.length);
      cr.contexto.notas.push(c.ok);
    } else {
      cr.contexto.notas.push(c.fail);
    }
  }
  cr.contexto.score = Math.min(ctxScore, 100);

  // ══════════════════════════════════════════
  // ORGANIZAÇÃO (5 × 20 = 100) — critério novo
  // ══════════════════════════════════════════

  // Verificar se houve bloco de orçamento/resumo organizado
  const hasOrcBlock = /📋|RESUMO\s+DO\s+PROJETO|RECOMENDA[CÇ][AÃ]O\s+T[EÉ]CNICA|por\s+ambiente|ambiente\s+por\s+ambiente|ambientes:/i.test(full);
  if (hasOrcBlock) {
    cr.organizacao.score += 20;
    cr.organizacao.notas.push('✅ Bloco de orçamento/resumo técnico organizado gerado');
  } else {
    cr.organizacao.notas.push('❌ Sem bloco de orçamento técnico organizado (📋 RESUMO não gerado)');
  }

  // Separação por ambiente (uso de cabeçalhos ou listas)
  const ambHeaders = (full.match(/fachada|sala|quarto|cozinha|port[aã]o|madeira|piso externo/gi) || []).length;
  if (ambHeaders >= 7) {
    cr.organizacao.score += 20;
    cr.organizacao.notas.push(`✅ Todos os 7 ambientes claramente separados (${ambHeaders} menções)`);
  } else if (ambHeaders >= 4) {
    cr.organizacao.score += 10;
    cr.organizacao.notas.push(`⚠️ ${ambHeaders} ambientes mencionados, mas nem todos separados`);
  } else {
    cr.organizacao.notas.push(`❌ Apenas ${ambHeaders} mencões de ambiente — sem organização clara`);
  }

  // Suvinil e Sherwin por ambiente (dual-brand completo)
  const dualBrandFull =
    /suvinil.{0,500}sherwin|sherwin.{0,500}suvinil/i.test(full);
  if (dualBrandFull) {
    cr.organizacao.score += 20;
    cr.organizacao.notas.push('✅ Dual-brand completo no orçamento');
  } else {
    cr.organizacao.notas.push('❌ Dual-brand não claramente presente no orçamento');
  }

  // Sequência de aplicação (preparação → fundo → tinta)
  if (/sequ[eê]ncia|prepara[cç][aã]o.*fundo.*tinta|passo.a.passo|etapa|1[ºo°].{0,20}(limpar|preparar|remov)|fundo.*ap[oó]s/i.test(full)) {
    cr.organizacao.score += 20;
    cr.organizacao.notas.push('✅ Sequência de aplicação orientada');
  } else {
    cr.organizacao.notas.push('⚠️ Sequência de aplicação não claramente orientada');
    cr.organizacao.score += 5;
  }

  // Quantidades/rendimento estimados
  if (/litro|lata|dem[aã]o|rendimento|m[²2]|quantidade/i.test(full)) {
    cr.organizacao.score += 20;
    cr.organizacao.notas.push('✅ Estimativa de quantidades/rendimento fornecida');
  } else {
    cr.organizacao.notas.push('⚠️ Sem estimativa de quantidades');
    cr.organizacao.score += 5;
  }

  // ══════════════════════════════════════════
  // TRANSFERÊNCIA (scoring igual à simulação base)
  // ══════════════════════════════════════════

  const transferMsg  = conversas.find(c => c.shouldTransfer === true);
  const transferIdx  = transferMsg ? conversas.indexOf(transferMsg) : -1;

  if (transferIdx === -1) {
    cr.transferencia.notas.push('⚠️ Transferência não ocorreu durante a simulação');
    cr.transferencia.score = 40;
  } else if (transferIdx >= 29) {  // msg 15+ bot response (index 29 = bot MSG 15, 31 = bot MSG 16...)
    cr.transferencia.score = 100;
    cr.transferencia.notas.push(`✅ Transferência no momento correto (msg ${Math.ceil(transferIdx / 2)})`);
  } else if (transferIdx >= 20) {  // msg 10-14
    cr.transferencia.score = 80;
    cr.transferencia.notas.push(`⚠️ Transferência um pouco antes do ideal (msg ${Math.ceil(transferIdx / 2)})`);
  } else if (transferIdx >= 12) {  // msg 6-9
    cr.transferencia.score = 50;
    cr.transferencia.notas.push(`⚠️ Transferência prematura (msg ${Math.ceil(transferIdx / 2)}) — orçamento incompleto`);
  } else {
    cr.transferencia.score = 10;
    cr.transferencia.notas.push(`❌ Transferência muito prematura (msg ${Math.ceil(transferIdx / 2)}) — violação grave`);
  }

  // ══════════════════════════════════════════
  // ROBUSTEZ (4 × 25 = 100) — critério novo
  // ══════════════════════════════════════════

  // Absorveu mudança de metragem (220→200m²)?
  if (/200\s*m|200m[²2]|corrig|atualiz|ajust/i.test(full)) {
    cr.robustez.score += 25;
    cr.robustez.notas.push('✅ Absorveu mudança de metragem (200m²)');
  } else {
    cr.robustez.notas.push('⚠️ Não evidenciou absorção da mudança de metragem');
    cr.robustez.score += 10;
  }

  // Absorveu mudança de acabamento da sala (fosco premium)?
  if (/fosco.{0,30}premium|premium.{0,30}fosco|acetinado|diferença.{0,30}fosco|fosco.{0,30}diferença/i.test(full)) {
    cr.robustez.score += 25;
    cr.robustez.notas.push('✅ Absorveu mudança de acabamento e explicou diferença');
  } else {
    cr.robustez.notas.push('⚠️ Não evidenciou diferença fosco/acetinado solicitada');
    cr.robustez.score += 5;
  }

  // Absorveu corredor externo adicionado (30m²)?
  if (/corredor|corredor.{0,30}30|30\s*m[²2]?.*corredor/i.test(full)) {
    cr.robustez.score += 25;
    cr.robustez.notas.push('✅ Absorveu novo ambiente (corredor externo 30m²)');
  } else {
    cr.robustez.notas.push('⚠️ Não confirmou corredor externo adicionado');
    cr.robustez.score += 5;
  }

  // Respondeu pergunta de compatibilidade de produtos?
  if (/compat[ií]v|mistur.{0,30}marca|marca.{0,30}mistur|usar.{0,30}junto|mesma.{0,30}marca|mesmo.{0,30}fabricante/i.test(full)) {
    cr.robustez.score += 25;
    cr.robustez.notas.push('✅ Respondeu pergunta de compatibilidade entre produtos');
  } else {
    cr.robustez.notas.push('⚠️ Não abordou compatibilidade de produtos adequadamente');
    cr.robustez.score += 5;
  }

  return cr;
}

// ─── MAIN ─────────────────────────────────────────────────────────

async function main() {
  printSection('🏗️  SIMULAÇÃO MULTI-AMBIENTES — TINTOR ENTERPRISE');
  console.log('  Cenário: Reforma completa | 7 ambientes | 20 mensagens');
  console.log('  Projeto: Fachada 220m² + Sala + Quarto infantil + Cozinha');
  console.log('           + Portão ferrugem + Madeira verniz + Piso gourmet');
  console.log('  Cliente: Família com crianças e cachorro | São Paulo');
  console.log('  Data   : ' + new Date().toLocaleString('pt-BR'));
  printDivider();

  // ── 1. Auth ──
  process.stdout.write('\n[1/3] Autenticando...');
  const auth = await req('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const token = auth.body?.data?.accessToken ?? auth.body?.token;
  if (!token) {
    console.log('\n❌ Login falhou:', JSON.stringify(auth.body).substring(0, 300));
    process.exit(1);
  }
  console.log(' ✅');

  // ── 2. Criar conversa ──
  process.stdout.write('[2/3] Criando conversa...');
  const convRes = await req('POST', '/api/chat/start', {
    tenantId: TENANT_ID,
    storeId: STORE_ID,
    customerPhone: '5511988880002',
    customerName: 'Marcelo Ferreira (multi-ambiente)',
    channel: 'WEBCHAT',
  }, token);
  const convId   = convRes.body?.data?.conversationId;
  const greeting = convRes.body?.data?.welcomeMessage ?? '(sem greeting)';
  if (!convId) {
    console.log('\n❌ Falha ao criar conversa:', JSON.stringify(convRes.body).substring(0, 300));
    process.exit(1);
  }
  console.log(` ✅ (${convId})`);
  console.log('[3/3] Iniciando simulação!\n');

  printDivider('─');
  console.log('  🤖 TINTOR (greeting):');
  console.log('  ' + greeting.replace(/\n/g, '\n  '));
  printDivider('─');

  // ── 3. Simular mensagens ──
  const log = [];
  let firstTransferMsg = -1;

  for (let i = 0; i < CLIENTE_MSGS.length; i++) {
    const userMsg = CLIENTE_MSGS[i];

    // Labels de fase
    const faseLabels = {
      0: '── FASE 1: Ambientes externos',
      4: '── FASE 2: Ambientes internos / Metal / Madeira',
      8: '── FASE 3: Context updates',
      10: '── FASE 4: Consulta técnica/comercial',
      12: '── FASE 5: Sequência e quantidades',
      14: '── FASE 6: Orçamento técnico organizado',
      16: '── FASE 7: Validação de robustez',
      18: '── FASE 8: Pedido de preço → transferência',
    };
    if (faseLabels[i]) {
      console.log(`\n  ${faseLabels[i]}`);
      printDivider('·', 60);
    }

    console.log(`\n[MSG ${i+1}/${CLIENTE_MSGS.length}]`);
    console.log(`  👤 Marcelo: "${userMsg}"`);

    await sleep(DELAY_MS);

    const msgRes = await req('POST', '/api/chat/message', {
      conversationId: convId,
      message: userMsg,
      tenantId: TENANT_ID,
    }, token);

    if (msgRes.status !== 200 && msgRes.status !== 201) {
      console.log(`  ❌ Erro HTTP ${msgRes.status}:`, JSON.stringify(msgRes.body).substring(0, 200));
      log.push({ role: 'user', content: userMsg });
      log.push({ role: 'bot', content: '(erro)', shouldTransfer: false });
      continue;
    }

    const botData = msgRes.body?.data;
    const botReply = botData?.response ?? botData?.message ?? '(sem resposta)';
    const shouldTransfer = botData?.shouldTransfer === true;

    log.push({ role: 'user', content: userMsg });
    log.push({ role: 'bot', content: botReply, shouldTransfer });

    if (shouldTransfer && firstTransferMsg === -1) firstTransferMsg = i + 1;

    // Exibe resposta truncada (máx 60 linhas)
    const lines = String(botReply).split('\n');
    const preview = lines.slice(0, 60).join('\n');
    console.log('  🤖 TINTOR:');
    console.log('  ' + preview.replace(/\n/g, '\n  '));
    if (lines.length > 60) console.log(`  ... [+${lines.length - 60} linhas omitidas]`);

    if (shouldTransfer) {
      console.log('\n  ⚡ [SISTEMA: shouldTransfer = TRUE]');
      if (i < 14) {
        console.log('  ⚠️  ALERTA: Transferência antes do MSG 15 (orçamento multi-ambiente pode estar incompleto)');
      }
    }
  }

  // ── 4. Avaliação ──
  printSection('📊 AVALIAÇÃO DO ATENDIMENTO MULTI-AMBIENTE');

  const cr = avaliar(log);
  const scores = Object.entries(cr);
  const mediaScore = Math.round(scores.reduce((a, [, v]) => a + v.score, 0) / scores.length);

  for (const [criterio, { score, notas }] of scores) {
    const label = criterio.toUpperCase().padEnd(14);
    const filled  = Math.round(score / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    console.log(`\n  ${label} ${bar} ${score}/100`);
    for (const n of notas) console.log(`    ${n}`);
  }

  printDivider('─');
  const emoji = mediaScore >= 90 ? '🏆' : mediaScore >= 75 ? '✅' : mediaScore >= 55 ? '⚠️' : '❌';
  console.log(`\n  ${emoji} SCORE GERAL: ${mediaScore}/100`);

  // ── 5. Matriz de ambientes ──
  printSection('🗺️  MATRIZ DE COBERTURA DOS AMBIENTES');

  const ambMatrix = [
    { nome: 'FACHADA EXTERNA',   re: /fachada/i,                  metragem: '200m²' },
    { nome: 'SALA INTERNA',      re: /\bsala\b/i,                 metragem: '70m²'  },
    { nome: 'QUARTO INFANTIL',   re: /quarto/i,                   metragem: '40m²'  },
    { nome: 'COZINHA',           re: /cozinha/i,                  metragem: '35m²'  },
    { nome: 'PORTÃO METÁLICO',   re: /port[aã]o|ferro|metal/i,   metragem: '—'     },
    { nome: 'MADEIRA (V/J)',     re: /madeira|verniz/i,           metragem: '6+4 pçs'},
    { nome: 'PISO EXTERNO',      re: /\bpiso\b|gourmet/i,        metragem: '25m²'  },
    { nome: 'CORREDOR EXT.',     re: /corredor/i,                 metragem: '30m²'  },
  ];

  const full = log.filter(c => c.role === 'bot').map(c => c.content).join(' ');
  console.log(`\n  ${'AMBIENTE'.padEnd(22)} ${'COBERT.'.padEnd(10)} METRAGEM`);
  console.log('  ' + '─'.repeat(50));
  for (const { nome, re, metragem } of ambMatrix) {
    const ok = re.test(full) ? '✅ SIM' : '❌ NÃO';
    console.log(`  ${nome.padEnd(22)} ${ok.padEnd(10)} ${metragem}`);
  }

  // ── 6. Validações críticas ──
  printSection('🔍 VALIDAÇÕES CRÍTICAS DE PRODUTO');

  const crits = [
    { desc: 'NÃO massa corrida em fachada',   ok: !(() => {
        const re = /massa corrida.{0,80}fachada|fachada.{0,80}massa corrida/gi;
        let m;
        while ((m = re.exec(full)) !== null) {
          const snippet = full.slice(Math.max(0, m.index - 60), m.index + m[0].length + 15);
          if (!/(nunca|jamais|n[ãa]o|NÃO|NUNCA|proibid|somente\s+intern|apenas\s+intern|uso\s+intern|exclusiv)/i.test(snippet)) return true;
        }
        return false;
      })() },
    { desc: 'NÃO tinta interna em fachada',   ok: !/tinta.{0,20}interna.{0,80}fachada|fachada.{0,80}tinta.{0,20}interna/i.test(full) },
    { desc: 'Anticorrosivo no metal',          ok: /anticorrosivo|fundo.{0,15}anti.?ferrug|primer.{0,20}metal/i.test(full) },
    { desc: 'Verniz na madeira',               ok: /verniz/i.test(full) },
    { desc: 'Produto para piso externo',       ok: /piso.{0,50}(epoxi|resist|alto.?tr[aá]fego|externo|concreto|cimento)|tinta.{0,30}piso/i.test(full) },
    { desc: 'Tratamento mofo antes de pintar', ok: /tratar.{0,40}mofo|remov.{0,30}mofo|limpar.{0,40}mofo|mofo.{0,40}antes|antes.{0,40}mofo/i.test(full) },
    { desc: 'Dupla marca (Suvinil + SW)',       ok: /suvinil/i.test(full) && /sherwin|metalatex|loxon/i.test(full) },
    { desc: 'Sem preço nas respostas',         ok: !/r\$\s*[\d,.]|[\d,.]+\s*reais\b/i.test(full) },
  ];

  for (const { desc, ok } of crits) {
    console.log(`  ${ok ? '✅' : '❌'} ${desc}`);
  }

  // ── 7. Problemas e sugestões ──
  printSection('💡 PROBLEMAS & SUGESTÕES');
  const problemas = scores
    .flatMap(([k, v]) => v.notas.filter(n => n.startsWith('❌')).map(n => `[${k.toUpperCase()}] ${n}`));

  if (problemas.length === 0) {
    console.log('  🎉 Nenhum problema crítico encontrado!');
  } else {
    for (const p of problemas) console.log(`  ${p}`);
  }

  // ── 8. Resumo final ──
  printSection('📋 RESUMO DA SIMULAÇÃO');
  console.log(`  Conversa ID   : ${convId}`);
  console.log(`  Mensagens     : ${log.length} (${log.filter(l => l.role === 'user').length} cliente + ${log.filter(l => l.role === 'bot').length} bot)`);
  console.log(`  1ª transferência: ${firstTransferMsg > 0 ? `MSG ${firstTransferMsg}` : 'Não ocorreu'}`);
  console.log(`  Score final   : ${mediaScore}/100 ${emoji}`);
  printDivider('═');
  console.log(`\n  🔗 Ver conversa: http://34.151.205.223/conversations/${convId}`);
  printDivider('═');
}

main().catch(e => { console.error('\n❌ Erro fatal:', e); process.exit(1); });
