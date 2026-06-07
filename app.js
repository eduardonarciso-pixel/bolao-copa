// =============================
// BOLÃO DA COPA — app.js
// =============================

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
    const snap = await db.collection('jogos').orderBy('data').get();
    const jogos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (jogos.length === 0) {
      listaAdmin.innerHTML = '<div class="empty-state"><div class="icone">📋</div><p>Nenhum jogo cadastrado ainda.</p></div>';
      return;
    }

    listaAdmin.innerHTML = jogos.map(j => `
      <div class="admin-jogo-item">
        <div class="admin-jogo-info">
          <strong>${j.bandeira1 || ''} ${j.time1} × ${j.time2} ${j.bandeira2 || ''}</strong>
          <span>${formatarData(j.data)} · ${j.fase || 'Grupos'} ${j.encerrado ? '· ✅ Encerrado' : ''}</span>
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
    `).join('');
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
    const snap = await db.collection('usuarios').orderBy('criadoEm').get();
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
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${u.pago
              ? '<span style="background:#e8f8ee;color:#27ae60;padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">✅ Pago</span>'
              : '<span style="background:#fde8e8;color:#e74c3c;padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">⏳ Pendente</span>'
            }
            ${!u.pago ? `<button class="btn btn-sm" style="background:#27ae60;color:#fff;" onclick="confirmarPagamento('${u.uid}')">✅ Confirmar</button>` : ''}
            <button class="btn btn-perigo btn-sm" onclick="excluirParticipante('${u.uid}', '${u.nome || u.email}')">🗑️</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:red">Erro ao carregar participantes.</p>';
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
