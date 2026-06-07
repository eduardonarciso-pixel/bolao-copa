firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let usuarioAtual = null;
let jogosCache = [];
let filtroAtivo = 'todos';

const codigosBandeiras = {
  'Brasil': 'br', 'Argentina': 'ar', 'França': 'fr', 'Alemanha': 'de',
  'Espanha': 'es', 'Portugal': 'pt', 'Inglaterra': 'gb-eng', 'Itália': 'it',
  'Holanda': 'nl', 'Bélgica': 'be', 'Croácia': 'hr', 'Uruguai': 'uy',
  'México': 'mx', 'USA': 'us', 'Canadá': 'ca', 'Equador': 'ec',
  'Senegal': 'sn', 'Marrocos': 'ma', 'Japão': 'jp', 'Coreia do Sul': 'kr',
  'Austrália': 'au', 'Irã': 'ir', 'Arábia Saudita': 'sa', 'Tunísia': 'tn',
  'Camarões': 'cm', 'Nigéria': 'ng', 'Angola': 'ao', 'Gana': 'gh',
  'Sérvia': 'rs', 'Suíça': 'ch', 'Dinamarca': 'dk', 'Noruega': 'no',
  'Polônia': 'pl', 'Ucrânia': 'ua', 'Hungria': 'hu', 'Eslováquia': 'sk',
  'Albânia': 'al', 'Grécia': 'gr', 'Rep. Checa': 'cz', 'Turquia': 'tr',
  'Colômbia': 'co', 'Chile': 'cl', 'Peru': 'pe', 'Paraguai': 'py',
  'Venezuela': 've', 'Bolívia': 'bo', 'Costa Rica': 'cr', 'Panamá': 'pa',
  'Jamaica': 'jm', 'Honduras': 'hn', 'Quirguistão': 'kg', 'Iraque': 'iq',
  'Nova Zelândia': 'nz', 'África do Sul': 'za','República Tcheca': 'cz',
'Catar': 'qa',
'Estados Unidos': 'us',
'Bósnia': 'ba',
'Haiti': 'ht',
'Escócia': 'gb-sct',
'Costa do Marfim': 'ci',
'Curaçao': 'cw',
'RD Congo': 'cd',
'Uzbequistão': 'uz',
'Áustria': 'at',
'Jordânia': 'jo',
'Argélia': 'dz',
'Cabo Verde': 'cv',
'Suécia': 'se', 'Egito': 'eg',
};

function obterBandeira(time) {
  const cod = codigosBandeiras[time];
  if (!cod) return `<span style="font-size:2rem">🏳️</span>`;
  return `<img src="https://flagcdn.com/80x60/${cod}.png" 
    style="width:60px;height:44px;border-radius:8px;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.4)">`;
}

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
  if (!resultado || resultado.gols1 === undefined) return null;
  const { gols1: p1, gols2: p2 } = palpite;
  const { gols1: r1, gols2: r2 } = resultado;
  if (p1 === r1 && p2 === r2) return 10;
  const vP = p1 > p2 ? 1 : p1 < p2 ? 2 : 0;
  const vR = r1 > r2 ? 1 : r1 < r2 ? 2 : 0;
  if (vP !== vR) return 0;
  if ((p1 - p2) === (r1 - r2)) return 7;
  return 5;
}

function getBadgePontos(pontos) {
  if (pontos === null) return '<span class="resultado-badge badge-aguarda">Aguardando</span>';
  if (pontos === 10) return '<span class="resultado-badge badge-exato">⭐ Exato! +10pts</span>';
  if (pontos === 7) return '<span class="resultado-badge badge-parcial">✓ Parcial +7pts</span>';
  if (pontos === 5) return '<span class="resultado-badge badge-parcial">✓ Vencedor +5pts</span>';
  return '<span class="resultado-badge badge-errou">✗ Errou +0pts</span>';
}

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

auth.onAuthStateChanged(async user => {
  if (user) {
    usuarioAtual = user;
    const ref = db.collection('usuarios').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        nome: user.displayName || user.email.split('@')[0],
        email: user.email,
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
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
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
  if (nome.length < 2) { msg.textContent = 'Digite seu nome.'; msg.className = 'msg erro'; return; }
  if (senha.length < 6) { msg.textContent = 'Senha mínimo 6 caracteres.'; msg.className = 'msg erro'; return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, senha);
    await cred.user.updateProfile({ displayName: nome });
    mostrarToast('Conta criada! 🎉', 'sucesso');
  } catch (err) {
    const erros = {
      'auth/email-already-in-use': 'E-mail já cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'Senha muito fraca.'
    };
    msg.textContent = erros[err.code] || 'Erro ao criar conta.';
    msg.className = 'msg erro';
  }
}

function fazerLogout() {
  if (confirm('Deseja sair?')) auth.signOut();
}

async function carregarJogos() {
  const container = document.getElementById('lista-jogos');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando jogos...</div>';
  try {
    const snap = await db.collection('jogos').orderBy('data').get();
    jogosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const palpitesSnap = await db.collection('palpites').where('uid', '==', usuarioAtual.uid).get();
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
  if (filtroAtivo === 'abertos') filtrados = jogos.filter(j => !j.encerrado);
  if (filtroAtivo === 'encerrados') filtrados = jogos.filter(j => j.encerrado);
  if (filtrados.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icone">📅</div><p>Nenhum jogo encontrado.</p></div>';
    return;
  }
  container.innerHTML = filtrados.map(jogo => {
    const palpite = palpitesMap[jogo.id];
    const pontos = palpite && jogo.resultado ? calcularPontos(palpite, jogo.resultado) : null;
    const encerrado = jogo.encerrado;
    const classeCard = encerrado ? (pontos === 10 ? 'acerto-exato' : pontos > 0 ? 'acerto-parcial' : 'encerrado') : '';
    return `
    <div class="jogo-card ${classeCard}">
      <div class="jogo-header">
        <span class="jogo-fase">${jogo.fase || 'Fase de Grupos'}</span>
        <span class="jogo-data">${formatarData(jogo.data)}</span>
      </div>
      <div class="jogo-times">
        <div class="time">
          ${obterBandeira(jogo.time1)}
          <span class="time-nome">${jogo.time1}</span>
        </div>
        <div class="jogo-placar">
          ${encerrado && jogo.resultado
            ? `<span class="placar-numero">${jogo.resultado.gols1}</span><span class="placar-x">×</span><span class="placar-numero">${jogo.resultado.gols2}</span>`
            : `<span class="placar-x" style="font-size:1.6rem;color:rgba(255,255,255,0.3)">×</span>`}
        </div>
        <div class="time">
          ${obterBandeira(jogo.time2)}
          <span class="time-nome">${jogo.time2}</span>
        </div>
      </div>
      <div class="palpite-area">
        <div class="palpite-label">${encerrado ? '✓ Palpite enviado ' + getBadgePontos(pontos) : '⚽ Seu palpite'}</div>
        <div class="palpite-inputs">
          <input type="number" min="0" max="99" class="palpite-input" id="p1-${jogo.id}" value="${palpite ? palpite.gols1 : ''}" ${encerrado ? 'disabled' : ''} placeholder="0">
          <span class="placar-x">×</span>
          <input type="number" min="0" max="99" class="palpite-input" id="p2-${jogo.id}" value="${palpite ? palpite.gols2 : ''}" ${encerrado ? 'disabled' : ''} placeholder="0">
          ${!encerrado ? `<button class="btn-palpite" onclick="salvarPalpite('${jogo.id}')">${palpite ? '✏️ Atualizar' : '✅ Salvar'}</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function salvarPalpite(jogoId) {
  const g1 = document.getElementById(`p1-${jogoId}`).value;
  const g2 = document.getElementById(`p2-${jogoId}`).value;
  if (g1 === '' || g2 === '') { mostrarToast('Preencha os dois placares!', 'erro'); return; }
  try {
    await db.collection('palpites').doc(`${usuarioAtual.uid}_${jogoId}`).set({
      uid: usuarioAtual.uid, jogoId, gols1: parseInt(g1), gols2: parseInt(g2),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    mostrarToast('Palpite salvo! ✅', 'sucesso');
    carregarJogos();
  } catch (e) { mostrarToast('Erro ao salvar.', 'erro'); }
}

function setFiltro(filtro) {
  filtroAtivo = filtro;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.toggle('ativo', b.dataset.filtro === filtro));
  carregarJogos();
}

async function carregarRanking() {
  const container = document.getElementById('tabela-ranking');
  container.innerHTML = '<div class="loading"><div class="spinner"></div> Calculando...</div>';
  try {
    const [jogosSnap, palpitesSnap, usuariosSnap] = await Promise.all([
      db.collection('jogos').where('encerrado', '==', true).get(),
      db.collection('palpites').get(),
      db.collection('usuarios').get()
    ]);
    const jogos = {};
    jogosSnap.forEach(d => { jogos[d.id] = d.data(); });
    const pontosPor = {}, acertosPor = {}, totalPor = {};
    palpitesSnap.forEach(d => {
      const p = d.data(); const j = jogos[p.jogoId];
      if (!j || !j.resultado) return;
      const pts = calcularPontos(p, j.resultado);
      if (!pontosPor[p.uid]) { pontosPor[p.uid] = 0; acertosPor[p.uid] = 0; totalPor[p.uid] = 0; }
      pontosPor[p.uid] += pts; totalPor[p.uid]++;
      if (pts > 0) acertosPor[p.uid]++;
    });
    const usuarios = [];
    usuariosSnap.forEach(d => usuarios.push({ uid: d.id, ...d.data(), pontos: pontosPor[d.id] || 0, acertos: acertosPor[d.id] || 0, total: totalPor[d.id] || 0 }));
    usuarios.sort((a, b) => b.pontos - a.pontos || b.acertos - a.acertos);
    if (usuarios.length === 0) { container.innerHTML = '<div class="empty-state"><div class="icone">🏆</div><p>Nenhum participante ainda.</p></div>'; return; }
    container.innerHTML = `<table class="ranking-tabela"><thead><tr><th>#</th><th>Participante</th><th>Acertos</th><th>Pts</th></tr></thead><tbody>
      ${usuarios.map((u, i) => {
        const pos = i + 1;
        const cls = pos === 1 ? 'pos-1' : pos === 2 ? 'pos-2' : pos === 3 ? 'pos-3' : 'pos-outro';
        const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        const isMe = u.uid === usuarioAtual.uid;
        return `<tr class="${isMe ? 'usuario-atual' : ''}"><td><span class="posicao-badge ${cls}">${emoji}</span></td><td>${u.nome || u.email}${isMe ? ' <strong>(você)</strong>' : ''}</td><td>${u.acertos}/${u.total}</td><td><span class="pontos-destaque">${u.pontos}</span></td></tr>`;
      }).join('')}
    </tbody></table>`;
  } catch (e) { container.innerHTML = '<div class="empty-state"><p>Erro ao carregar ranking.</p></div>'; }
}

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
    let pts = 0, total = 0, acertos = 0;
    palpitesSnap.forEach(d => {
      const p = d.data(); const j = jogos[p.jogoId];
      if (!j || !j.resultado) return;
      const x = calcularPontos(p, j.resultado);
      pts += x; total++; if (x > 0) acertos++;
    });
    document.getElementById('stat-pontos').textContent = pts;
    document.getElementById('stat-palpites').textContent = total;
    document.getElementById('stat-acertos').textContent = acertos;
  } catch (e) { console.error(e); }
}

async function carregarAdmin() {
  if (!usuarioAtual || usuarioAtual.uid !== ADMIN_UID) {
    document.getElementById('tela-admin').innerHTML = '<div class="empty-state"><div class="icone">🔒</div><p>Acesso restrito.</p></div>'; return;
  }

  // Abas do admin
  document.getElementById('tela-admin').innerHTML = `
    <h2 class="secao-titulo">⚙️ Painel Admin</h2>
    <div class="filtros" style="margin-bottom:20px">
      <button class="filtro-btn ativo" onclick="mostrarAbaAdmin('jogos', this)">⚽ Jogos</button>
      <button class="filtro-btn" onclick="mostrarAbaAdmin('participantes', this)">👥 Participantes</button>
    </div>
    <div id="aba-jogos">
      <div class="admin-grid">
        <div class="admin-card">
          <h3>➕ Adicionar Jogo</h3>
          <form id="form-novo-jogo" onsubmit="adicionarJogo(event)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-grupo"><label>Bandeira Time 1 (emoji)</label><input type="text" id="novo-flag1" placeholder="🇧🇷" maxlength="4"></div>
              <div class="form-grupo"><label>Bandeira Time 2 (emoji)</label><input type="text" id="novo-flag2" placeholder="🇦🇷" maxlength="4"></div>
              <div class="form-grupo"><label>Time 1 *</label><input type="text" id="novo-time1" placeholder="Brasil" required></div>
              <div class="form-grupo"><label>Time 2 *</label><input type="text" id="novo-time2" placeholder="Argentina" required></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-grupo"><label>Data e Hora *</label><input type="datetime-local" id="novo-data" required></div>
              <div class="form-grupo"><label>Fase</label>
                <select id="novo-fase">
                  <option value="Fase de Grupos">Fase de Grupos</option>
                  <option value="Oitavas de Final">Oitavas de Final</option>
                  <option value="Quartas de Final">Quartas de Final</option>
                  <option value="Semifinal">Semifinal</option>
                  <option value="3º Lugar">3º Lugar</option>
                  <option value="Final">Final</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:auto;padding:10px 24px;">➕ Adicionar Jogo</button>
          </form>
        </div>
        <div class="admin-card">
          <h3>📋 Jogos Cadastrados</h3>
          <p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-bottom:12px;">💾 Salva resultado &nbsp;|&nbsp; 🔒 Encerra &nbsp;|&nbsp; 🔓 Reabre</p>
          <div id="lista-admin-jogos"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
        </div>
      </div>
    </div>
    <div id="aba-participantes" style="display:none">
      <div class="admin-card">
        <h3>👥 Participantes Cadastrados</h3>
        <div id="lista-participantes"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
      </div>
    </div>
  `;

  carregarJogosAdmin();
}

function mostrarAbaAdmin(aba, btn) {
  document.getElementById('aba-jogos').style.display = aba === 'jogos' ? 'block' : 'none';
  document.getElementById('aba-participantes').style.display = aba === 'participantes' ? 'block' : 'none';
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  if (aba === 'participantes') carregarParticipantes();
}

async function carregarJogosAdmin() {
  const lista = document.getElementById('lista-admin-jogos');
  if (!lista) return;
  lista.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try {
    const snap = await db.collection('jogos').orderBy('data').get();
    const jogos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (jogos.length === 0) { lista.innerHTML = '<div class="empty-state"><p>Nenhum jogo cadastrado.</p></div>'; return; }
    lista.innerHTML = jogos.map(j => `
      <div class="admin-jogo-item">
        <div class="admin-jogo-info">
          <strong>${j.time1} × ${j.time2}</strong>
          <span>${formatarData(j.data)} · ${j.fase || 'Grupos'} ${j.encerrado ? '· ✅ Encerrado' : ''}</span>
        </div>
        <div class="resultado-inputs">
          <input type="number" min="0" class="resultado-input" id="r1-${j.id}" value="${j.resultado ? j.resultado.gols1 : ''}" placeholder="0">
          <span style="font-weight:700;color:#fff">×</span>
          <input type="number" min="0" class="resultado-input" id="r2-${j.id}" value="${j.resultado ? j.resultado.gols2 : ''}" placeholder="0">
          <button class="btn btn-amarelo btn-sm" onclick="salvarResultado('${j.id}')">💾</button>
          ${!j.encerrado ? `<button class="btn btn-perigo btn-sm" onclick="encerrarJogo('${j.id}')">🔒</button>` : `<button class="btn btn-sm" style="background:#00c853;color:#fff" onclick="reabrirJogo('${j.id}')">🔓</button>`}
        </div>
      </div>`).join('');
  } catch (e) { lista.innerHTML = '<p>Erro ao carregar.</p>'; }
}

async function carregarParticipantes() {
  const lista = document.getElementById('lista-participantes');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try {
    const snap = await db.collection('usuarios').orderBy('criadoEm').get();
    const usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (usuarios.length === 0) {
      lista.innerHTML = '<div class="empty-state"><div class="icone">👥</div><p>Nenhum participante ainda.</p></div>';
      return;
    }

    const pagos = usuarios.filter(u => u.pago).length;
    const nPagos = usuarios.filter(u => !u.pago).length;

    lista.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-numero">${usuarios.length}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-numero" style="color:#00c853">${pagos}</div>
          <div class="stat-label">Pagos ✅</div>
        </div>
        <div class="stat-card">
          <div class="stat-numero" style="color:#e53935">${nPagos}</div>
          <div class="stat-label">Pendentes ⏳</div>
        </div>
      </div>
      <div style="margin-bottom:12px;font-size:0.82rem;color:rgba(255,255,255,0.45);">
        ✅ Confirmar pagamento &nbsp;|&nbsp; 🗑️ Excluir participante
      </div>
      ${usuarios.map(u => `
        <div class="admin-jogo-item" style="border-left:4px solid ${u.pago ? '#00c853' : '#e53935'}">
          <div class="admin-jogo-info">
            <strong>${u.nome || 'Sem nome'} ${u.uid === ADMIN_UID ? '👑 Admin' : ''}</strong>
            <span>${u.email}</span>
            <span style="margin-top:2px;display:block">
              ${u.pago
                ? `<span style="color:#00c853;font-weight:700">✅ Pagamento confirmado</span>`
                : `<span style="color:#e53935;font-weight:700">⏳ Pagamento pendente</span>`
              }
              ${u.criadoEm ? '· Cadastro: ' + formatarData(u.criadoEm) : ''}
            </span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${!u.pago && u.uid !== ADMIN_UID
              ? `<button class="btn btn-sm" style="background:#00c853;color:#fff" onclick="confirmarPagamento('${u.id}')">✅ Confirmar</button>`
              : u.uid !== ADMIN_UID
              ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);cursor:default">✅ Pago</button>`
              : ''
            }
            ${u.uid !== ADMIN_UID
              ? `<button class="btn btn-perigo btn-sm" onclick="excluirParticipante('${u.id}', '${u.nome || u.email}')">🗑️</button>`
              : ''
            }
          </div>
        </div>
      `).join('')}
    `;
  } catch (e) {
    lista.innerHTML = '<div class="empty-state"><p>Erro ao carregar participantes.</p></div>';
    console.error(e);
  }
}

async function confirmarPagamento(uid) {
  try {
    await db.collection('usuarios').doc(uid).update({ pago: true });
    mostrarToast('Pagamento confirmado! ✅', 'sucesso');
    carregarParticipantes();
  } catch (e) { mostrarToast('Erro ao confirmar pagamento.', 'erro'); }
}

async function excluirParticipante(uid, nome) {
  if (!confirm(`Excluir o participante "${nome}"?\n\nIsso removerá o cadastro e todos os palpites dele.`)) return;
  try {
    // Excluir palpites do usuário
    const palpitesSnap = await db.collection('palpites').where('uid', '==', uid).get();
    const batch = db.batch();
    palpitesSnap.forEach(d => batch.delete(d.ref));
    // Excluir usuário
    batch.delete(db.collection('usuarios').doc(uid));
    await batch.commit();
    mostrarToast('Participante excluído! 🗑️', 'sucesso');
    carregarParticipantes();
  } catch (e) { mostrarToast('Erro ao excluir participante.', 'erro'); }
}

async function adicionarJogo(e) {
  e.preventDefault();
  const time1 = document.getElementById('novo-time1').value.trim();
  const time2 = document.getElementById('novo-time2').value.trim();
  const bandeira1 = document.getElementById('novo-flag1').value.trim();
  const bandeira2 = document.getElementById('novo-flag2').value.trim();
  const dataStr = document.getElementById('novo-data').value;
  const fase = document.getElementById('novo-fase').value;
  if (!time1 || !time2 || !dataStr) { mostrarToast('Preencha os times e a data!', 'erro'); return; }
  try {
    await db.collection('jogos').add({
      time1, time2, bandeira1, bandeira2,
      data: firebase.firestore.Timestamp.fromDate(new Date(dataStr)),
      fase, encerrado: false,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('form-novo-jogo').reset();
    mostrarToast('Jogo adicionado! ✅', 'sucesso');
    carregarJogosAdmin();
  } catch (e) { mostrarToast('Erro ao adicionar.', 'erro'); }
}

async function salvarResultado(jogoId) {
  const g1 = document.getElementById(`r1-${jogoId}`).value;
  const g2 = document.getElementById(`r2-${jogoId}`).value;
  if (g1 === '' || g2 === '') { mostrarToast('Preencha os placares!', 'erro'); return; }
  try {
    await db.collection('jogos').doc(jogoId).update({ resultado: { gols1: parseInt(g1), gols2: parseInt(g2) } });
    mostrarToast('Resultado salvo! ✅', 'sucesso');
  } catch (e) { mostrarToast('Erro ao salvar.', 'erro'); }
}

async function encerrarJogo(jogoId) {
  const g1 = document.getElementById(`r1-${jogoId}`).value;
  const g2 = document.getElementById(`r2-${jogoId}`).value;
  if (g1 === '' || g2 === '') { mostrarToast('Salve o resultado antes!', 'erro'); return; }
  if (!confirm('Encerrar este jogo?')) return;
  try {
    await db.collection('jogos').doc(jogoId).update({ encerrado: true, resultado: { gols1: parseInt(g1), gols2: parseInt(g2) } });
    mostrarToast('Jogo encerrado! 🔒', 'sucesso');
    carregarJogosAdmin();
  } catch (e) { mostrarToast('Erro.', 'erro'); }
}

async function reabrirJogo(jogoId) {
  if (!confirm('Reabrir este jogo?')) return;
  try {
    await db.collection('jogos').doc(jogoId).update({ encerrado: false });
    mostrarToast('Jogo reaberto! 🔓', 'sucesso');
    carregarJogosAdmin();
  } catch (e) { mostrarToast('Erro.', 'erro'); }
}