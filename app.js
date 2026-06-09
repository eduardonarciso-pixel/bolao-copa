// =============================
// BOLÃO DA COPA — app.js
// =============================

// ---- EmailJS ----
const EMAILJS_SERVICE  = 'service_07czpxj';
const EMAILJS_TEMPLATE = 'template_hovphbr';
const EMAILJS_KEY      = 'HLRdk2QTNVbB4NoBm';
emailjs.init({ publicKey: EMAILJS_KEY });

// ---- Inicialização Firebase ----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---- Estado Global ----
let usuarioAtual = null;
let jogosCache = [];
let filtroAtivo = 'todos';

// ---- BANDEIRAS ----
const codigosBandeiras = {
  'México': 'mx', 'África do Sul': 'za', 'Coreia do Sul': 'kr', 'República Tcheca': 'cz',
  'Canadá': 'ca', 'Bósnia': 'ba', 'Catar': 'qa', 'Suíça': 'ch',
  'Brasil': 'br', 'Marrocos': 'ma', 'Haiti': 'ht', 'Escócia': 'gb-sct',
  'Estados Unidos': 'us', 'Paraguai': 'py', 'Austrália': 'au', 'Turquia': 'tr',
  'Alemanha': 'de', 'Curaçao': 'cw', 'Costa do Marfim': 'ci', 'Equador': 'ec',
  'Holanda': 'nl', 'Japão': 'jp', 'Suécia': 'se', 'Tunísia': 'tn',
  'Bélgica': 'be', 'Egito': 'eg', 'Irã': 'ir', 'Nova Zelândia': 'nz',
  'Espanha': 'es', 'Cabo Verde': 'cv', 'Arábia Saudita': 'sa', 'Uruguai': 'uy',
  'França': 'fr', 'Senegal': 'sn', 'Iraque': 'iq', 'Noruega': 'no',
  'Áustria': 'at', 'Jordânia': 'jo', 'Argentina': 'ar', 'Argélia': 'dz',
  'Portugal': 'pt', 'RD Congo': 'cd', 'Uzbequistão': 'uz', 'Colômbia': 'co',
  'Inglaterra': 'gb-eng', 'Croácia': 'hr', 'Gana': 'gh', 'Panamá': 'pa',
  'A definir': null
};

function obterBandeira(time) {
  const cod = codigosBandeiras[time];
  if (!cod) return '<span style="font-size:1.8rem">🏳️</span>';
  return `<img src="https://flagcdn.com/48x36/${cod}.png" alt="${time}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;">`;
}

// ---- UTILITÁRIOS ----

function mostrarToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'visivel ' + (tipo === 'erro' ? 'erro-toast' : tipo === 'sucesso' ? 'sucesso-toast' : '');
  setTimeout(() => { t.className = ''; }, 3000);
}

function formatarData(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function calcularPontos(palpite, resultado) {
  if (!resultado || resultado.gols1 === undefined || resultado.gols2 === undefined) return null;
  const { gols1: p1, gols2: p2 } = palpite;
  const { gols1: r1, gols2: r2 } = resultado;

  // Placar exato
  if (p1 === r1 && p2 === r2) return 10;

  const vencedorPalpite = p1 > p2 ? 1 : p1 < p2 ? 2 : 0;
  const vencedorReal = r1 > r2 ? 1 : r1 < r2 ? 2 : 0;

  if (vencedorPalpite !== vencedorReal) return 0;

  // Empate correto (já seria exato se placar igual, então aqui é empate diferente — impossível)
  // Acertou vencedor + diferença
  if ((p1 - p2) === (r1 - r2)) return 7;

  // Acertou apenas o vencedor
  return 5;
}

function getBadgePontos(pontos) {
  if (pontos === null) return '<span class="resultado-badge badge-aguarda">Aguardando</span>';
  if (pontos === 10) return `<span class="resultado-badge badge-exato">⭐ Exato! +10pts</span>`;
  if (pontos === 7) return `<span class="resultado-badge badge-parcial">✓ Parcial +7pts</span>`;
  if (pontos === 5) return `<span class="resultado-badge badge-parcial">✓ Vencedor +5pts</span>`;
  return `<span class="resultado-badge badge-errou">✗ Errou +0pts</span>`;
}

// ---- NAVEGAÇÃO ----

function mostrarTela(id) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('header nav button').forEach(b => {
    b.classList.toggle('ativo', b.dataset.tela === id);
  });
  if (id === 'tela-jogos') carregarJogos();
  if (id === 'tela-ranking') carregarRanking();
  if (id === 'tela-premiacao') carregarPremiacao();
  if (id === 'tela-grupos') carregarGrupos();
  if (id === 'tela-admin') carregarAdmin();
  if (id === 'tela-perfil') carregarPerfil();
}

// ---- AUTH ----

auth.onAuthStateChanged(async user => {
  if (user) {
    usuarioAtual = user;
    // Garante doc do usuário no Firestore
    const ref = db.collection('usuarios').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        nome: user.displayName || user.email.split('@')[0],
        email: user.email,
        pontos: 0,
        palpites: 0,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    document.getElementById('tela-auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    atualizarHeader();
    mostrarTela('tela-jogos');
  } else {
    usuarioAtual = null;
    document.getElementById('tela-auth').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

function atualizarHeader() {
  const nome = usuarioAtual.displayName || usuarioAtual.email.split('@')[0];
  const isAdmin = usuarioAtual.uid === ADMIN_UID;
  document.getElementById('header-nome').textContent = nome;
  document.getElementById('btn-admin').style.display = isAdmin ? 'inline-block' : 'none';
}

// ---- LOGIN / CADASTRO ----

function alternarAba(aba) {
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativo'));
  document.querySelectorAll('.form-auth').forEach(f => f.style.display = 'none');
  document.querySelector(`.aba-btn[data-aba="${aba}"]`).classList.add('ativo');
  document.getElementById(`form-${aba}`).style.display = 'block';
  document.getElementById('msg-auth').className = 'msg';
}

async function fazerLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const msg = document.getElementById('msg-auth');
  msg.className = 'msg';
  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (err) {
    const erros = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.'
    };
    msg.textContent = erros[err.code] || 'Erro ao fazer login.';
    msg.className = 'msg erro';
  }
}

async function fazerCadastro(e) {
  e.preventDefault();
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const msg = document.getElementById('msg-auth');
  msg.className = 'msg';

  if (nome.length < 2) {
    msg.textContent = 'Digite seu nome completo.';
    msg.className = 'msg erro';
    return;
  }
  if (senha.length < 6) {
    msg.textContent = 'A senha deve ter no mínimo 6 caracteres.';
    msg.className = 'msg erro';
    return;
  }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, senha);
    await cred.user.updateProfile({ displayName: nome });
    mostrarToast('Conta criada com sucesso! 🎉', 'sucesso');
  } catch (err) {
    const erros = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'Senha muito fraca.'
    };
    msg.textContent = erros[err.code] || 'Erro ao criar conta.';
    msg.className = 'msg erro';
  }
}

function fazerLogout() {
  if (confirm('Deseja sair da sua conta?')) auth.signOut();
}

// ---- JOGOS ----

async function carregarJogos() {
  const container = document.getElementById('lista-jogos');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando jogos...</div>';

  try {
    const snap = await db.collection('jogos').orderBy('data').get();
    jogosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Carregar palpites do usuário
    const palpitesSnap = await db.collection('palpites')
      .where('uid', '==', usuarioAtual.uid).get();
    const palpitesMap = {};
    palpitesSnap.forEach(d => { palpitesMap[d.data().jogoId] = d.data(); });

    renderizarJogos(jogosCache, palpitesMap);
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><div class="icone">⚠️</div><p>Erro ao carregar jogos.</p></div>';
  }
}

function renderizarJogos(jogos, palpitesMap) {
  const container = document.getElementById('lista-jogos');

  let filtrados = jogos;
  if (filtroAtivo !== 'todos') filtrados = jogos.filter(j => j.fase === filtroAtivo);

  if (filtrados.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icone">📅</div><p>Nenhum jogo encontrado.</p></div>';
    return;
  }

  container.innerHTML = filtrados.map(jogo => {
    const palpite = palpitesMap[jogo.id];
    const pontos = palpite && jogo.resultado ? calcularPontos(palpite, jogo.resultado) : null;
    const encerrado = jogo.encerrado;

    const classeCard = encerrado
      ? (pontos === 10 ? 'acerto-exato' : pontos > 0 ? 'acerto-parcial' : 'encerrado')
      : '';

    return `
    <div class="jogo-card ${classeCard}">
      <div class="jogo-header">
        <span class="jogo-fase">${jogo.fase || 'Fase de Grupos'}</span>
        <span class="jogo-data">${formatarData(jogo.data)}</span>
      </div>

      <div class="jogo-times">
        <div class="time">
          <span class="time-bandeira">${obterBandeira(jogo.time1)}</span>
          <span class="time-nome">${jogo.time1}</span>
        </div>

        <div class="jogo-placar">
          ${encerrado && jogo.resultado ? `
            <span class="placar-numero">${jogo.resultado.gols1}</span>
            <span class="placar-x">×</span>
            <span class="placar-numero">${jogo.resultado.gols2}</span>
          ` : `
            <span class="placar-x" style="font-size:1.4rem">×</span>
          `}
        </div>

        <div class="time">
          <span class="time-bandeira">${obterBandeira(jogo.time2)}</span>
          <span class="time-nome">${jogo.time2}</span>
        </div>
      </div>

      <div class="palpite-area">
        <div class="palpite-label">
          ${encerrado ? '✓ Palpite enviado' : '⚽ Seu palpite'}
          ${encerrado ? getBadgePontos(pontos) : ''}
        </div>
        <div class="palpite-inputs">
          <input type="number" min="0" max="99" class="palpite-input"
            id="p1-${jogo.id}"
            value="${palpite ? palpite.gols1 : ''}"
            ${encerrado ? 'disabled' : ''}
            placeholder="0">
          <span class="placar-x">×</span>
          <input type="number" min="0" max="99" class="palpite-input"
            id="p2-${jogo.id}"
            value="${palpite ? palpite.gols2 : ''}"
            ${encerrado ? 'disabled' : ''}
            placeholder="0">
          ${!encerrado ? `
            <button class="btn-palpite" onclick="salvarPalpite('${jogo.id}')">
              ${palpite ? '✏️ Atualizar' : '✅ Salvar'}
            </button>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function salvarPalpite(jogoId) {
  const g1 = document.getElementById(`p1-${jogoId}`).value;
  const g2 = document.getElementById(`p2-${jogoId}`).value;

  if (g1 === '' || g2 === '') {
    mostrarToast('Preencha os dois placares!', 'erro');
    return;
  }

  const gols1 = parseInt(g1);
  const gols2 = parseInt(g2);

  if (isNaN(gols1) || isNaN(gols2) || gols1 < 0 || gols2 < 0) {
    mostrarToast('Placar inválido!', 'erro');
    return;
  }

  try {
    const ref = db.collection('palpites').doc(`${usuarioAtual.uid}_${jogoId}`);
    await ref.set({
      uid: usuarioAtual.uid,
      jogoId,
      gols1,
      gols2,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    mostrarToast('Palpite salvo! ✅', 'sucesso');
  } catch (e) {
    mostrarToast('Erro ao salvar palpite.', 'erro');
  }
}

function setFiltro(filtro) {
  filtroAtivo = filtro;
  document.querySelectorAll('.filtro-btn').forEach(b => {
    b.classList.toggle('ativo', b.dataset.filtro === filtro);
  });
  carregarJogos();
}

// ---- PREMIAÇÃO ----

function calcularPremios(total) {
  return {
    premio1: Math.floor(total * 0.60),
    premio2: Math.floor(total * 0.25),
    premio3: Math.floor(total * 0.10),
    admin:   Math.floor(total * 0.05)
  };
}

function renderPremiacao(totalParticipantes) {
  const valorCota = 50;
  const totalArrecadado = totalParticipantes * valorCota;
  const { premio1, premio2, premio3, admin } = calcularPremios(totalArrecadado);

  return `
    <div class="premiacao-card">
      <div class="premiacao-total-label">💰 Total Arrecadado</div>
      <div class="premiacao-total-valor">R$ ${totalArrecadado.toLocaleString('pt-BR')}</div>
      <div class="premiacao-total-sub">${totalParticipantes} participante(s) × R$ ${valorCota}</div>
    </div>
    <div class="premiacao-grid">
      <div class="premiacao-item pos-1">
        <div class="premiacao-pos">🥇</div>
        <div class="premiacao-titulo">1º Lugar</div>
        <div class="premiacao-pct">60%</div>
        <div class="premiacao-valor">R$ ${premio1.toLocaleString('pt-BR')}</div>
      </div>
      <div class="premiacao-item pos-2">
        <div class="premiacao-pos">🥈</div>
        <div class="premiacao-titulo">2º Lugar</div>
        <div class="premiacao-pct">25%</div>
        <div class="premiacao-valor">R$ ${premio2.toLocaleString('pt-BR')}</div>
      </div>
      <div class="premiacao-item pos-3">
        <div class="premiacao-pos">🥉</div>
        <div class="premiacao-titulo">3º Lugar</div>
        <div class="premiacao-pct">10%</div>
        <div class="premiacao-valor">R$ ${premio3.toLocaleString('pt-BR')}</div>
      </div>
      <div class="premiacao-item pos-admin">
        <div class="premiacao-pos">⚙️</div>
        <div class="premiacao-titulo">Organização</div>
        <div class="premiacao-pct">5%</div>
        <div class="premiacao-valor">R$ ${admin.toLocaleString('pt-BR')}</div>
      </div>
    </div>
    <div class="card" style="text-align:center; font-size:0.82rem; color:rgba(255,255,255,0.5);">
      Valores atualizados automaticamente conforme novos participantes se inscrevem.
    </div>
  `;
}

async function carregarPremiacao() {
  const container = document.getElementById('conteudo-premiacao');
  if (!container) return;
  try {
    const snap = await db.collection('usuarios').get();
    container.innerHTML = renderPremiacao(snap.size);
  } catch(e) {
    // Se falhar, mostra com 0 participantes
    container.innerHTML = renderPremiacao(0);
  }
}

// ---- GRUPOS ----

async function carregarGrupos() {
  const container = document.getElementById('tabela-grupos');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';

  try {
    const snap = await db.collection('jogos').get();
    const jogos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filtrar só jogos de grupos com resultado
    const gruposNomes = ['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F',
                         'Grupo G','Grupo H','Grupo I','Grupo J','Grupo K','Grupo L'];

    const dadosGrupos = {};
    gruposNomes.forEach(g => { dadosGrupos[g] = {}; });

    jogos.forEach(j => {
      if (!gruposNomes.includes(j.fase)) return;

      const grupo = j.fase;
      if (!dadosGrupos[grupo]) dadosGrupos[grupo] = {};

      // Inicializar times
      [j.time1, j.time2].forEach(time => {
        if (!dadosGrupos[grupo][time]) {
          dadosGrupos[grupo][time] = { time, J:0, V:0, E:0, D:0, GP:0, GC:0, P:0 };
        }
      });

      // Só calcular se jogo encerrado com resultado
      if (!j.encerrado || !j.resultado) return;

      const g1 = j.resultado.gols1;
      const g2 = j.resultado.gols2;
      const t1 = dadosGrupos[grupo][j.time1];
      const t2 = dadosGrupos[grupo][j.time2];

      t1.J++; t2.J++;
      t1.GP += g1; t1.GC += g2;
      t2.GP += g2; t2.GC += g1;

      if (g1 > g2) {
        t1.V++; t1.P += 3;
        t2.D++;
      } else if (g1 < g2) {
        t2.V++; t2.P += 3;
        t1.D++;
      } else {
        t1.E++; t1.P++;
        t2.E++; t2.P++;
      }
    });

    // Renderizar
    let html = '';
    gruposNomes.forEach(grupo => {
      const times = Object.values(dadosGrupos[grupo]);
      if (times.length === 0) return;

      times.sort((a, b) => b.P - a.P || (b.GP - b.GC) - (a.GP - a.GC) || b.GP - a.GP);

      html += `
        <div class="grupo-card">
          <h3 class="grupo-titulo">${grupo}</h3>
          <table class="grupo-tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th title="Jogos">J</th>
                <th title="Vitórias">V</th>
                <th title="Empates">E</th>
                <th title="Derrotas">D</th>
                <th title="Gols Pró">GP</th>
                <th title="Gols Contra">GC</th>
                <th title="Saldo de Gols">SG</th>
                <th title="Pontos">P</th>
              </tr>
            </thead>
            <tbody>
              ${times.map((t, i) => `
                <tr class="${i < 2 ? 'classificado' : i === 2 ? 'possivel' : ''}">
                  <td>${i + 1}</td>
                  <td class="time-cell">
                    ${obterBandeira(t.time)}
                    <span>${t.time}</span>
                  </td>
                  <td>${t.J}</td>
                  <td>${t.V}</td>
                  <td>${t.E}</td>
                  <td>${t.D}</td>
                  <td>${t.GP}</td>
                  <td>${t.GC}</td>
                  <td>${t.GP - t.GC >= 0 ? '+' : ''}${t.GP - t.GC}</td>
                  <td><strong>${t.P}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="grupo-legenda">
            <span class="leg-classificado">■</span> Classificado &nbsp;
            <span class="leg-possivel">■</span> Possível 3º
          </div>
        </div>
      `;
    });

    container.innerHTML = html || '<div class="empty-state"><div class="icone">📊</div><p>Nenhum resultado lançado ainda.</p></div>';
  } catch(e) {
    console.error('Erro grupos:', e);
    container.innerHTML = `<div class="empty-state"><div class="icone">⚠️</div><p>Erro: ${e.message}</p></div>`;
  }
}

// ---- RANKING ----

async function carregarRanking() {
  const container = document.getElementById('tabela-ranking');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Calculando ranking...</div>';

  try {
    // Buscar todos os palpites e jogos encerrados
    const [jogosSnap, palpitesSnap, usuariosSnap] = await Promise.all([
      db.collection('jogos').where('encerrado', '==', true).get(),
      db.collection('palpites').get(),
      db.collection('usuarios').get()
    ]);

    const jogos = {};
    jogosSnap.forEach(d => { jogos[d.id] = d.data(); });

    const pontosPorUsuario = {};
    const acertosPorUsuario = {};
    const palpitesPorUsuario = {};

    palpitesSnap.forEach(d => {
      const p = d.data();
      const jogo = jogos[p.jogoId];
      if (!jogo || !jogo.resultado) return;

      const pts = calcularPontos(p, jogo.resultado);
      if (!pontosPorUsuario[p.uid]) {
        pontosPorUsuario[p.uid] = 0;
        acertosPorUsuario[p.uid] = 0;
        palpitesPorUsuario[p.uid] = 0;
      }
      pontosPorUsuario[p.uid] += pts;
      palpitesPorUsuario[p.uid]++;
      if (pts > 0) acertosPorUsuario[p.uid]++;
    });

    const usuarios = [];
    usuariosSnap.forEach(d => {
      usuarios.push({
        uid: d.id,
        ...d.data(),
        pontos: pontosPorUsuario[d.id] || 0,
        acertos: acertosPorUsuario[d.id] || 0,
        totalPalpites: palpitesPorUsuario[d.id] || 0
      });
    });

    usuarios.sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos);

    if (usuarios.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icone">🏆</div><p>Nenhum participante ainda.</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="ranking-tabela">
        <thead>
          <tr>
            <th>#</th>
            <th>Participante</th>
            <th>Palpites</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map((u, i) => {
            const pos = i + 1;
            const cls = pos === 1 ? 'pos-1' : pos === 2 ? 'pos-2' : pos === 3 ? 'pos-3' : 'pos-outro';
            const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
            const isMe = u.uid === usuarioAtual.uid;
            return `
              <tr class="${isMe ? 'usuario-atual' : ''}">
                <td><span class="posicao-badge ${cls}">${emoji}</span></td>
                <td>${u.nome || u.email} ${isMe ? '<strong>(você)</strong>' : ''}</td>
                <td>${u.acertos}/${u.totalPalpites}</td>
                <td><span class="pontos-destaque">${u.pontos}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><div class="icone">⚠️</div><p>Erro ao carregar ranking.</p></div>';
  }
}

// ---- PERFIL ----

async function carregarPerfil() {
  const nome = usuarioAtual.displayName || usuarioAtual.email.split('@')[0];
  document.getElementById('perfil-nome').textContent = nome;
  document.getElementById('perfil-email').textContent = usuarioAtual.email;

  try {
    const [jogosSnap, palpitesSnap] = await Promise.all([
      db.collection('jogos').where('encerrado', '==', true).get(),
      db.collection('palpites').where('uid', '==', usuarioAtual.uid).get()
    ]);

    const jogos = {};
    jogosSnap.forEach(d => { jogos[d.id] = d.data(); });

    let totalPontos = 0, totalPalpites = 0, totalAcertos = 0;
    palpitesSnap.forEach(d => {
      const p = d.data();
      const jogo = jogos[p.jogoId];
      if (!jogo || !jogo.resultado) return;
      const pts = calcularPontos(p, jogo.resultado);
      totalPontos += pts;
      totalPalpites++;
      if (pts > 0) totalAcertos++;
    });

    document.getElementById('stat-pontos').textContent = totalPontos;
    document.getElementById('stat-palpites').textContent = totalPalpites;
    document.getElementById('stat-acertos').textContent = totalAcertos;
  } catch (e) {
    console.error(e);
  }
}

// ---- ADMIN ----

async function carregarAdmin() {
  if (!usuarioAtual || usuarioAtual.uid !== ADMIN_UID) {
    document.getElementById('tela-admin').innerHTML = `
      <div class="empty-state">
        <div class="icone">🔒</div>
        <p>Acesso restrito ao administrador.</p>
      </div>`;
    return;
  }

  const listaAdmin = document.getElementById('lista-admin-jogos');
  listaAdmin.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  carregarParticipantes();

  try {
    const [jogosSnap, palpitesSnap, usuariosSnap] = await Promise.all([
      db.collection('jogos').orderBy('data').get(),
      db.collection('palpites').get(),
      db.collection('usuarios').get()
    ]);

    const jogos = jogosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalParticipantes = usuariosSnap.size;

    // Mapear palpites por jogoId → lista de nomes
    const nomesPorUid = {};
    usuariosSnap.forEach(d => { nomesPorUid[d.id] = d.data().nome || d.data().email; });

    const palpitesPorJogo = {};
    palpitesSnap.forEach(d => {
      const p = d.data();
      if (!palpitesPorJogo[p.jogoId]) palpitesPorJogo[p.jogoId] = [];
      palpitesPorJogo[p.jogoId].push(nomesPorUid[p.uid] || p.uid);
    });

    if (jogos.length === 0) {
      listaAdmin.innerHTML = '<div class="empty-state"><div class="icone">📋</div><p>Nenhum jogo cadastrado ainda.</p></div>';
      return;
    }

    listaAdmin.innerHTML = jogos.map(j => {
      const nomes = palpitesPorJogo[j.id] || [];
      const count = nomes.length;
      const tooltip = nomes.length > 0 ? nomes.join(', ') : 'Nenhum palpite ainda';
      return `
      <div class="admin-jogo-item">
        <div class="admin-jogo-info">
          <strong>${j.bandeira1 || ''} ${j.time1} × ${j.time2} ${j.bandeira2 || ''}</strong>
          <span>${formatarData(j.data)} · ${j.fase || 'Grupos'} ${j.encerrado ? '· ✅ Encerrado' : ''}</span>
          <span class="palpites-counter" title="${tooltip}">
            👥 ${count}/${totalParticipantes} palpites
          </span>
        </div>
        <div class="resultado-inputs">
          <input type="number" min="0" class="resultado-input" id="r1-${j.id}"
            value="${j.resultado ? j.resultado.gols1 : ''}" placeholder="0">
          <span style="font-weight:700">×</span>
          <input type="number" min="0" class="resultado-input" id="r2-${j.id}"
            value="${j.resultado ? j.resultado.gols2 : ''}" placeholder="0">
          <button class="btn btn-amarelo btn-sm" onclick="salvarResultado('${j.id}')">💾</button>
          ${!j.encerrado
            ? `<button class="btn btn-perigo btn-sm" onclick="encerrarJogo('${j.id}')">🔒</button>`
            : `<button class="btn btn-sm" style="background:#27ae60;color:#fff" onclick="reabrirJogo('${j.id}')">🔓</button>`
          }
        </div>
      </div>
    `}).join('');
  } catch (e) {
    listaAdmin.innerHTML = '<p>Erro ao carregar jogos.</p>';
  }
}

async function adicionarJogo(e) {
  e.preventDefault();
  const time1 = document.getElementById('novo-time1').value.trim();
  const time2 = document.getElementById('novo-time2').value.trim();
  const bandeira1 = document.getElementById('novo-flag1').value.trim();
  const bandeira2 = document.getElementById('novo-flag2').value.trim();
  const dataStr = document.getElementById('novo-data').value;
  const fase = document.getElementById('novo-fase').value;

  if (!time1 || !time2 || !dataStr) {
    mostrarToast('Preencha os times e a data!', 'erro');
    return;
  }

  try {
    await db.collection('jogos').add({
      time1, time2, bandeira1, bandeira2,
      data: firebase.firestore.Timestamp.fromDate(new Date(dataStr)),
      fase,
      encerrado: false,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('form-novo-jogo').reset();
    mostrarToast('Jogo adicionado! ✅', 'sucesso');
    carregarAdmin();
  } catch (e) {
    mostrarToast('Erro ao adicionar jogo.', 'erro');
  }
}

async function salvarResultado(jogoId) {
  const g1 = document.getElementById(`r1-${jogoId}`).value;
  const g2 = document.getElementById(`r2-${jogoId}`).value;

  if (g1 === '' || g2 === '') {
    mostrarToast('Preencha os dois placares!', 'erro');
    return;
  }

  try {
    await db.collection('jogos').doc(jogoId).update({
      resultado: { gols1: parseInt(g1), gols2: parseInt(g2) }
    });
    mostrarToast('Resultado salvo! ✅', 'sucesso');
  } catch (e) {
    mostrarToast('Erro ao salvar resultado.', 'erro');
  }
}

async function encerrarJogo(jogoId) {
  const g1 = document.getElementById(`r1-${jogoId}`).value;
  const g2 = document.getElementById(`r2-${jogoId}`).value;

  if (g1 === '' || g2 === '') {
    mostrarToast('Salve o resultado antes de encerrar!', 'erro');
    return;
  }

  if (!confirm('Encerrar este jogo? Os participantes não poderão mais alterar palpites.')) return;

  try {
    await db.collection('jogos').doc(jogoId).update({
      encerrado: true,
      resultado: { gols1: parseInt(g1), gols2: parseInt(g2) }
    });
    mostrarToast('Jogo encerrado! 🔒', 'sucesso');
    carregarAdmin();
  } catch (e) {
    mostrarToast('Erro ao encerrar jogo.', 'erro');
  }
}

async function reabrirJogo(jogoId) {
  if (!confirm('Reabrir este jogo para novos palpites?')) return;
  try {
    await db.collection('jogos').doc(jogoId).update({ encerrado: false });
    mostrarToast('Jogo reaberto! 🔓', 'sucesso');
    carregarAdmin();
  } catch (e) {
    mostrarToast('Erro ao reabrir jogo.', 'erro');
  }
}

// ---- PARTICIPANTES ----

async function carregarParticipantes() {
  const container = document.getElementById('lista-participantes');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';

  try {
    const snap = await db.collection('usuarios').get();
    const usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

    if (usuarios.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icone">👥</div><p>Nenhum participante ainda.</p></div>';
      return;
    }

    const pagos = usuarios.filter(u => u.pago).length;
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <span style="font-size:0.85rem;color:#666;">${usuarios.length} participante(s) · <strong style="color:#27ae60">${pagos} pago(s)</strong> · <strong style="color:#e74c3c">${usuarios.length - pagos} pendente(s)</strong></span>
      </div>
      ${usuarios.map(u => `
        <div class="admin-jogo-item" style="align-items:center;">
          <div class="admin-jogo-info">
            <strong>${u.nome || u.email}</strong>
            <span>${u.email}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${u.pago
              ? '<span style="background:rgba(46,204,113,0.2);color:#2ecc71;padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">✅ Pago</span>'
              : '<span style="background:rgba(231,76,60,0.2);color:#e74c3c;padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">⏳ Pendente</span>'
            }
            <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;" onclick="editarNome('${u.uid}', '${(u.nome || '').replace(/'/g, "\\'")}')">✏️</button>
            ${!u.pago ? `<button class="btn btn-sm" style="background:#27ae60;color:#fff;" onclick="confirmarPagamento('${u.uid}')">✅</button>` : ''}
            <button class="btn btn-perigo btn-sm" onclick="excluirParticipante('${u.uid}', '${(u.nome || u.email).replace(/'/g, "\\'")}')">🗑️</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:red">Erro ao carregar participantes.</p>';
  }
}

async function enviarLembretes() {
  try {
    const snap = await db.collection('usuarios').get();
    const pendentes = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => !u.pago && u.email);

    if (pendentes.length === 0) {
      mostrarToast('Nenhum pendente encontrado! ✅', 'sucesso');
      return;
    }

    if (!confirm(`Enviar lembrete para ${pendentes.length} participante(s) pendente(s)?`)) return;

    let enviados = 0;
    let erros = 0;

    for (const u of pendentes) {
      try {
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          nome: u.nome || u.email.split('@')[0],
          name: u.nome || u.email.split('@')[0],
          to_email: u.email,
          to_name: u.nome || u.email.split('@')[0],
          email: u.email,
        });
        enviados++;
        console.log(`✅ Email enviado para ${u.email}`);
      } catch(e) {
        erros++;
        console.error(`❌ Erro ao enviar para ${u.email}:`, e, JSON.stringify(e));
      }
    }

    if (erros === 0) {
      mostrarToast(`📧 ${enviados} lembrete(s) enviado(s)!`, 'sucesso');
    } else {
      mostrarToast(`📧 ${enviados} enviado(s), ${erros} erro(s).`, '');
    }
  } catch(e) {
    mostrarToast('Erro ao buscar participantes.', 'erro');
  }
}

async function editarNome(uid, nomeAtual) {
  const novoNome = prompt('Digite o novo nome:', nomeAtual);
  if (!novoNome || novoNome.trim() === '' || novoNome.trim() === nomeAtual) return;
  try {
    await db.collection('usuarios').doc(uid).update({ nome: novoNome.trim() });
    mostrarToast('Nome atualizado! ✅', 'sucesso');
    carregarParticipantes();
  } catch (e) {
    mostrarToast('Erro ao atualizar nome.', 'erro');
  }
}

async function confirmarPagamento(uid) {
  try {
    await db.collection('usuarios').doc(uid).update({ pago: true });
    mostrarToast('Pagamento confirmado! ✅', 'sucesso');
    carregarParticipantes();
  } catch (e) {
    mostrarToast('Erro ao confirmar pagamento.', 'erro');
  }
}

async function excluirParticipante(uid, nome) {
  if (!confirm(`Excluir "${nome}"? Isso apagará também todos os palpites desta pessoa.`)) return;
  try {
    // Apagar palpites do usuário
    const palpitesSnap = await db.collection('palpites').where('uid', '==', uid).get();
    const batch = db.batch();
    palpitesSnap.forEach(d => batch.delete(d.ref));
    // Apagar usuário
    batch.delete(db.collection('usuarios').doc(uid));
    await batch.commit();
    // Apagar conta do Auth (só funciona se for o próprio usuário, senão ignora)
    mostrarToast('Participante excluído! 🗑️', 'sucesso');
    carregarParticipantes();
  } catch (e) {
    mostrarToast('Erro ao excluir participante.', 'erro');
  }
}
