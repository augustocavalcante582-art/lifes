// Servidor da loja Life (sem dependências externas: só módulos nativos do Node).
// Neste protótipo ele roda dentro do próprio app. Em uma loja real, este mesmo
// código seria hospedado num servidor na internet e o app de desktop só
// conversaria com ele pela rede.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SEED_DIR = path.join(__dirname, 'data');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const PALETTES = [
  ['#0e7490', '#4338ca'],
  ['#9f1239', '#7c2d12'],
  ['#166534', '#0f766e'],
  ['#6d28d9', '#be185d'],
  ['#1d4ed8', '#0369a1'],
  ['#a16207', '#b91c1c'],
];
const EMOJIS = ['🎮', '🕹️', '👾', '🚀', '🧩', '⚔️', '🌌', '🐉'];

// Requisitos de sistema por "nível" de exigência do jogo
const REQ = {
  1: {
    min: { cpu: 'Intel Core i3-6100 / AMD Ryzen 3 1200', ram: '4 GB', gpu: 'Intel HD 530 ou equivalente' },
    rec: { cpu: 'Intel Core i5-8400 / AMD Ryzen 5 2600', ram: '8 GB', gpu: 'GTX 1050 ou equivalente' },
  },
  2: {
    min: { cpu: 'Intel Core i5-8400 / AMD Ryzen 5 1600', ram: '8 GB', gpu: 'GTX 1050 Ti ou equivalente' },
    rec: { cpu: 'Intel Core i7-9700 / AMD Ryzen 7 3700X', ram: '16 GB', gpu: 'GTX 1660 Super ou equivalente' },
  },
  3: {
    min: { cpu: 'Intel Core i7-8700 / AMD Ryzen 5 3600', ram: '16 GB', gpu: 'GTX 1660 Ti ou equivalente' },
    rec: { cpu: 'Intel Core i7-12700 / AMD Ryzen 7 5800X', ram: '32 GB', gpu: 'RTX 3070 ou equivalente' },
  },
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// Completa campos que jogos antigos ou publicados pelo portal podem não ter
function normalizeGame(g) {
  const tier = [1, 2, 3].includes(g.tier) ? g.tier : 1;
  const price = Number(g.price) || 0;
  const orig = Number(g.originalPrice) > price ? Number(g.originalPrice) : price;
  const discount = orig > price ? Math.round((1 - price / orig) * 100) : 0;
  const so = 'Windows 10 64-bit ou superior';
  const disco = `${Math.max(1, Math.ceil(Number(g.sizeGB) || 1))} GB`;
  return {
    ...g,
    tier,
    price,
    originalPrice: orig,
    discount,
    tagline: g.tagline || '',
    featured: !!g.featured,
    achievementsTotal: Number.isFinite(g.achievementsTotal) ? g.achievementsTotal : 20,
    requirements: {
      min: { so, ...REQ[tier].min, disco },
      rec: { so, ...REQ[tier].rec, disco },
    },
  };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 50 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Requisição grande demais.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  let filePath;
  try {
    filePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(rel)));
  } catch (e) {
    res.writeHead(400).end();
    return;
  }
  // Impede acessar arquivos fora da pasta public (ex.: ../../server.js)
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function createServer({ dataDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const gamesFile = path.join(dataDir, 'games.json');
  const stateFile = path.join(dataDir, 'state.json');

  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const seed = (name) => read(path.join(SEED_DIR, name));

  // Catálogo: os jogos de exemplo são sempre atualizados a partir do seed,
  // mas jogos publicados pelo usuário (que não estão no seed) são preservados.
  const seedGames = seed('games.seed.json');
  let existing = [];
  try { existing = read(gamesFile); } catch (e) { existing = []; }
  const seedIds = new Set(seedGames.map((g) => g.id));
  write(gamesFile, [...seedGames, ...existing.filter((g) => g && !seedIds.has(g.id))]);

  const friends = seed('friends.seed.json');
  const community = seed('community.seed.json');

  const readGames = () => read(gamesFile).map(normalizeGame);

  // Estado do jogador, sempre completado com os campos novos
  const readState = () => {
    let s;
    try { s = read(stateFile); } catch (e) { s = {}; }
    const lib = Array.isArray(s.library) ? s.library : [];
    return {
      library: lib
        .filter((e) => e && typeof e.id === 'string')
        .map((e) => ({
          id: e.id,
          purchasedAt: e.purchasedAt || '',
          installed: !!e.installed,
          playMinutes: Number(e.playMinutes) || 0,
          achievementsUnlocked: Number(e.achievementsUnlocked) || 0,
        })),
      favorites: Array.isArray(s.favorites) ? s.favorites.filter((x) => typeof x === 'string') : [],
      profile: { name: String((s.profile && s.profile.name) || 'Jogador').slice(0, 24) },
      settings: { reduceMotion: !!(s.settings && s.settings.reduceMotion) },
    };
  };
  write(stateFile, readState());

  // ---------- rotas ----------
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler });
  };

  // Lista de jogos: busca (?q=), gênero (?genre=) e ordem (?sort=)
  route('GET', '/api/games', ({ query }) => {
    const q = String(query.get('q') || '').trim().toLowerCase();
    const genre = String(query.get('genre') || '').trim().toLowerCase();
    const sort = String(query.get('sort') || 'rating');
    let games = readGames();
    if (q) {
      games = games.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.developer.toLowerCase().includes(q) ||
          g.genres.some((x) => x.toLowerCase().includes(q))
      );
    }
    if (genre) {
      games = games.filter((g) => g.genres.some((x) => x.toLowerCase() === genre));
    }
    const sorters = {
      rating: (a, b) => b.rating - a.rating,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      discount: (a, b) => b.discount - a.discount,
      new: (a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)),
      az: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
    };
    games.sort(sorters[sort] || sorters.rating);
    return [200, games];
  });

  route('GET', '/api/genres', () => {
    const set = new Set();
    readGames().forEach((g) => g.genres.forEach((x) => set.add(x)));
    return [200, [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  });

  route('GET', '/api/games/:id', ({ params }) => {
    const game = readGames().find((g) => g.id === params.id);
    if (!game) return [404, { error: 'Jogo não encontrado.' }];
    return [200, game];
  });

  // Amigos que jogam este jogo
  route('GET', '/api/games/:id/friends', ({ params }) => {
    if (!readGames().some((g) => g.id === params.id)) return [404, { error: 'Jogo não encontrado.' }];
    return [200, friends.filter((f) => f.game === params.id)];
  });

  // Portal do desenvolvedor: publicar um jogo novo
  route('POST', '/api/games', ({ body }) => {
    const b = body || {};
    const title = String(b.title || '').trim();
    const developer = String(b.developer || '').trim();
    const description = String(b.description || '').trim();
    const price = Number(b.price);
    const sizeGB = Number(b.sizeGB);
    const genres = String(b.genres || '')
      .split(',')
      .map((x) => x.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 4);

    if (!title || title.length > 60) return [400, { error: 'Título é obrigatório (máx. 60 caracteres).' }];
    if (!developer || developer.length > 60) return [400, { error: 'Nome do desenvolvedor é obrigatório (máx. 60 caracteres).' }];
    if (!description || description.length > 1000) return [400, { error: 'Descrição é obrigatória (máx. 1000 caracteres).' }];
    if (!Number.isFinite(price) || price < 0 || price > 1000) return [400, { error: 'Preço deve estar entre 0 e 1000.' }];
    if (!Number.isFinite(sizeGB) || sizeGB <= 0 || sizeGB > 200) return [400, { error: 'Tamanho deve estar entre 0,1 e 200 GB.' }];
    if (genres.length === 0) return [400, { error: 'Informe pelo menos um gênero.' }];

    const games = read(gamesFile);
    const base = slugify(title) || 'jogo';
    let id = base;
    let n = 2;
    while (games.some((g) => g.id === id)) id = `${base}-${n++}`;

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const game = {
      id,
      title,
      developer,
      price: Math.round(price * 100) / 100,
      genres,
      tagline: String(b.tagline || '').trim().slice(0, 100),
      description,
      rating: 0,
      sizeGB: Math.round(sizeGB * 10) / 10,
      releaseDate: new Date().toISOString().slice(0, 10),
      emoji: pick(EMOJIS),
      colors: pick(PALETTES),
    };
    games.push(game);
    write(gamesFile, games);
    return [201, normalizeGame(game)];
  });

  // Biblioteca do jogador (jogos comprados) já com os dados do jogo
  route('GET', '/api/library', () => {
    const games = readGames();
    const state = readState();
    const items = state.library
      .map((entry) => {
        const game = games.find((g) => g.id === entry.id);
        return game ? { ...entry, favorite: state.favorites.includes(entry.id), game } : null;
      })
      .filter(Boolean);
    return [200, items];
  });

  // Compra simulada: nenhum dinheiro real, nenhum pagamento de verdade
  route('POST', '/api/purchase', ({ body }) => {
    const ids = Array.isArray(body && body.ids) ? body.ids : [];
    if (ids.length === 0) return [400, { error: 'Carrinho vazio.' }];

    const games = readGames();
    const state = readState();
    const unique = [...new Set(ids.map(String))];

    for (const id of unique) {
      if (!games.some((g) => g.id === id)) return [400, { error: `Jogo inexistente: ${id}` }];
      if (state.library.some((e) => e.id === id)) return [400, { error: 'Você já possui um dos jogos do carrinho.' }];
    }

    const total = unique.reduce((sum, id) => sum + games.find((g) => g.id === id).price, 0);
    const now = new Date().toISOString();
    unique.forEach((id) =>
      state.library.push({ id, purchasedAt: now, installed: false, playMinutes: 0, achievementsUnlocked: 0 })
    );
    write(stateFile, state);
    return [201, { purchased: unique, total: Math.round(total * 100) / 100 }];
  });

  // Instalar / desinstalar (simulado: só marca o estado)
  const setInstalled = (value) => ({ params }) => {
    const state = readState();
    const entry = state.library.find((e) => e.id === params.id);
    if (!entry) return [404, { error: 'Você não possui este jogo.' }];
    entry.installed = value;
    write(stateFile, state);
    return [200, entry];
  };
  route('POST', '/api/library/:id/install', setInstalled(true));
  route('DELETE', '/api/library/:id/install', setInstalled(false));

  // Sessão de jogo simulada: soma tempo de jogo e pode liberar conquistas
  route('POST', '/api/library/:id/play', ({ params }) => {
    const state = readState();
    const entry = state.library.find((e) => e.id === params.id);
    if (!entry) return [404, { error: 'Você não possui este jogo.' }];
    if (!entry.installed) return [400, { error: 'Instale o jogo antes de jogar.' }];
    const game = readGames().find((g) => g.id === params.id);
    const minutes = 15 + Math.floor(Math.random() * 76);
    const before = entry.achievementsUnlocked;
    entry.playMinutes += minutes;
    entry.achievementsUnlocked = Math.min(game.achievementsTotal, before + Math.floor(Math.random() * 3));
    write(stateFile, state);
    return [200, { minutes, newAchievements: entry.achievementsUnlocked - before, entry }];
  });

  // Favoritos (serve para jogos que o jogador tem ou quer ter)
  route('GET', '/api/favorites', () => [200, readState().favorites]);
  route('POST', '/api/favorites/:id', ({ params }) => {
    if (!readGames().some((g) => g.id === params.id)) return [404, { error: 'Jogo não encontrado.' }];
    const state = readState();
    if (!state.favorites.includes(params.id)) state.favorites.push(params.id);
    write(stateFile, state);
    return [200, state.favorites];
  });
  route('DELETE', '/api/favorites/:id', ({ params }) => {
    const state = readState();
    state.favorites = state.favorites.filter((x) => x !== params.id);
    write(stateFile, state);
    return [200, state.favorites];
  });

  // Amigos e comunidade (dados fictícios de exemplo)
  route('GET', '/api/friends', () => [200, friends]);
  route('GET', '/api/community', () => [200, community]);

  // Perfil e configurações
  route('GET', '/api/profile', () => {
    const s = readState();
    return [200, { name: s.profile.name, reduceMotion: s.settings.reduceMotion }];
  });
  route('PUT', '/api/profile', ({ body }) => {
    const b = body || {};
    const state = readState();
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name || name.length > 24) return [400, { error: 'O nome deve ter de 1 a 24 caracteres.' }];
      state.profile.name = name;
    }
    if (b.reduceMotion !== undefined) state.settings.reduceMotion = !!b.reduceMotion;
    write(stateFile, state);
    return [200, { name: state.profile.name, reduceMotion: state.settings.reduceMotion }];
  });

  // ---------- servidor ----------
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Método não permitido.' });
        return serveStatic(req, res, pathname);
      }

      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};
        const [status, data] = r.handler({ params, query: url.searchParams, body });
        return sendJson(res, status, data);
      }
      sendJson(res, 404, { error: 'Rota não encontrada.' });
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Requisição inválida.' });
    }
  });
}

module.exports = { createServer };

// Permite rodar sozinho no navegador: npm run server  ->  http://localhost:3737
if (require.main === module) {
  const dataDir = path.join(__dirname, 'data-local');
  const port = Number(process.env.PORT) || 3737;
  createServer({ dataDir }).listen(port, '0.0.0.0', () => {
    console.log(`Life rodando na porta ${port}`);
  });
}
