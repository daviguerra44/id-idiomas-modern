import { parseHTML } from 'linkedom';

export class LegacyError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}
export type Enrollment = { id: string; registration: string; title: string; level: string; teacher: string; status: string; links: Record<string, string> };
export type Lesson = { id: string; title: string; unit: string; sequence: number; path: string };
export type Report = { number: number; available: boolean; scores: { label: string; value: number }[]; officialGrade: number | null; comment: string; printPath?: string };
export const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
const fold = (s: string) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/:$/, '');
const doc = (html: string) => parseHTML(html).document;
const selectors = '[class~="card"], [class~="card-panel"], [class~="panel"], article, tr';

export function safePath(raw: string, origin: string): string | null {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || url.username || url.password || /%2f|%5c|%2e|\\/i.test(url.pathname)) return null;
    const p = url.pathname;
    const allowed = /^(?:\/perfil(?:\/(?:home|show\/[a-f\d]+|curso\/\d+|aula\/\d+|reportCardMatricula\/\d+|evaluationMatricula\/\d+))?\/?|\/reportCard\/print\/\d+|\/matricula\/(?:boletoPrint|contratoPrint)\/\d+|\/storage\/uploads\/Anexo\/[\w-]+\/[^/]+)$/i.test(p);
    if (!allowed) return null;
    const keys = [...url.searchParams.keys()];
    if (p.includes('/aula/')) {
      if (keys.some(k => k !== 'aula') || !/^[a-f\d-]{8,100}$/i.test(url.searchParams.get('aula') || '') || url.searchParams.getAll('aula').length !== 1) return null;
    } else if (p.startsWith('/reportCard/print/')) {
      if (keys.some(k => k !== 'u') || url.searchParams.has('u') && url.searchParams.get('u') !== '0') return null;
    } else if (keys.length) return null;
    return p + url.search;
  } catch { return null; }
}

function localLinks(root: Pick<ParentNode,'querySelectorAll'>, origin: string) {
  return Array.from(root.querySelectorAll('a[href]')).map(a => ({ path: safePath(a.getAttribute('href')!, origin), title: clean(a.textContent), node: a })).filter(x => x.path) as { path: string; title: string; node: Element }[];
}
export function isLogin(html: string) { return !!doc(html).querySelector('form[action*="login/authenticate"], input[type="password"]'); }

export function loginForm(html: string, origin: string) {
  const root = doc(html), form = Array.from(root.querySelectorAll('form')).find(f => {
    try { const u = new URL(f.getAttribute('action') || '', origin); return u.origin === origin && u.pathname === '/login/authenticate'; } catch { return false; }
  });
  if (!form || (form.getAttribute('method') || 'get').toLowerCase() !== 'post' || !form.querySelector('input[name="username"]') || !form.querySelector('input[name="password"][type="password"]')) throw new LegacyError('LOGIN_FORMAT', 'O formulário de login mudou. Precisamos conferir o formato recebido.');
  const encoding=(form.getAttribute('enctype')||'application/x-www-form-urlencoded').toLowerCase();
  if(encoding!=='application/x-www-form-urlencoded')throw new LegacyError('LOGIN_ENCODING','O formato de envio do login mudou e precisa ser confirmado.');
  const body = new URLSearchParams();
  for (const input of form.querySelectorAll('input[type="hidden"][name]')) body.append(input.getAttribute('name')!, input.getAttribute('value') || '');
  return body;
}

function field(root: Element, label: string) {
  const match = Array.from(root.querySelectorAll('td,dt,label,span,div')).find(el => fold(el.textContent || '') === fold(label));
  return clean(match?.nextElementSibling?.textContent);
}
function containerFor(node: Element, id: string) {
  let current: Element | null = node.parentElement;
  while (current) {
    const registrations = clean(current.textContent).match(/\d{4}\.\d\.\d{4,}/g) || [];
    if (registrations.length === 1 && current.matches(selectors)) return current;
    current = current.parentElement;
  }
  return node.closest(selectors) || node.parentElement!;
}
export function parseProfile(html: string, origin: string) {
  if (isLogin(html)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
  const root = doc(html), links = localLinks(root, origin), enrollments = new Map<string, Enrollment>();
  for (const link of links) {
    const match = link.path.match(/^\/(?:perfil\/(curso|reportCardMatricula|evaluationMatricula)|matricula\/(boletoPrint|contratoPrint))\/(\d+)$/);
    if (!match) continue;
    const kind = match[1] || match[2], id = match[3], container = containerFor(link.node, id);
    const item = enrollments.get(id) || { id, registration: clean(container.textContent).match(/\d{4}\.\d\.\d{4,}/)?.[0] || '', title: clean(container.querySelector('.card-title,h2,h3,h4')?.textContent), level: field(container, 'Nível'), teacher: field(container, 'Professor'), status: field(container, 'Situação da Matrícula'), links: {} };
    item.links[kind] = link.path; enrollments.set(id, item);
  }
  if (!enrollments.size) throw new LegacyError('PROFILE_FORMAT', 'Não foi possível identificar as matrículas nessa resposta. Nenhum dado foi substituído.');
  const profilePath = links.find(l => /^\/perfil\/show\//.test(l.path))?.path;
  const heading = Array.from(root.querySelectorAll('h1,h2,h3,.profile-name')).map(h => clean(h.textContent)).find(t => t && !/^(?:ver perfil|perfil|inglês|espanhol|meu perfil)$/i.test(t));
  return { name: heading || '', profilePath, enrollments: [...enrollments.values()] };
}

export function findProfilePath(html: string, origin: string) { return localLinks(doc(html), origin).find(l => /^\/perfil\/show\//.test(l.path))?.path; }
export function parseLessons(html: string, origin: string, enrollmentId: string): Lesson[] {
  if (isLogin(html)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
  const links = localLinks(doc(html), origin).filter(l => l.path.startsWith('/perfil/aula/' + enrollmentId + '?'));
  const seen = new Set<string>();
  return links.filter(l => { if (seen.has(l.path)) return false; seen.add(l.path); return true; }).map((l, i) => {
    const id = new URL(l.path, origin).searchParams.get('aula')!;
    const row = l.node.closest('tr,article,.collection-item,.card,.panel');
    const title = l.title && !/^(?:ver|visualizar|abrir|acessar)(?: aula)?$/i.test(l.title) ? l.title : clean(row?.textContent).replace(/\b(?:Visualizar|Abrir|Acessar)\b/gi, '').trim();
    if (!title) throw new LegacyError('LESSON_FORMAT', 'Uma aula foi encontrada sem título. Confira o formato da página antes de importar.');
    return { id, title: title.slice(0, 200), unit: title.match(/(?:unit|unidade)\s*[\dA-Z]+/i)?.[0] || '', sequence: i + 1, path: l.path };
  });
}
export function parseFiles(html: string, origin: string) {
  if (isLogin(html)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
  const root = doc(html), result = new Map<string, { path: string; name: string }>();
  for (const node of root.querySelectorAll('a[href],iframe[src],object[data],embed[src]')) {
    const path = safePath(node.getAttribute('href') || node.getAttribute('src') || node.getAttribute('data') || '', origin);
    if (!path?.startsWith('/storage/uploads/Anexo/')) continue;
    const name = clean(node.textContent) || decodeURIComponent(path.split('/').at(-1)!);
    result.set(path, { path, name: name.slice(0, 200) });
  }
  return [...result.values()];
}

const labels = ['Avaliação Diária', 'Presença', 'Teste Oral', 'Teste Escrito', 'Habilidades de Comunicação', 'Dever de Casa'];
export function parseReports(html: string, origin?: string): Report[] {
  if (isLogin(html)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
  const root = doc(html), headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,.card-title,.panel-heading')).filter(h => /report\s*card\s*\d/i.test(clean(h.textContent)));
  const result: Report[] = [];
  for (const heading of headings) {
    const number = Number(clean(heading.textContent).match(/report\s*card\s*(\d)/i)![1]);
    let block: Element | null = heading.closest(selectors) || heading.parentElement;
    while (block && !/Grade|Avaliação Diária|indisponível|não disponível|não foi|ainda não/i.test(clean(block.textContent))) block = block.parentElement;
    if (!block || Array.from(block.querySelectorAll('h1,h2,h3,h4,h5,.card-title')).filter(h => /report\s*card\s*\d/i.test(clean(h.textContent))).length > 1) throw new LegacyError('REPORT_FORMAT', 'O formato do boletim precisa de conferência. As notas anteriores foram mantidas.');
    const scores: Report['scores'] = []; let officialGrade: number | null = null;
    for (const label of [...labels, 'Grade']) {
      const value = field(block, label), n = /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : NaN;
      if (Number.isFinite(n) && n >= 0 && n <= 10) { if (label === 'Grade') officialGrade = n; else scores.push({ label, value: n }); }
    }
    const text = clean(block.textContent), comment = text.match(/Coment[áa]rios?\s*:\s*(.*?)(?:IMPRIMIR|$)/i)?.[1] || '';
    if (!scores.length && officialGrade === null && !/indisponível|não disponível|ainda não|não foi/i.test(text)) throw new LegacyError('REPORT_FORMAT', 'Não foi possível associar as notas aos critérios. As notas anteriores foram mantidas.');
    const printPath=origin?localLinks(block,origin).find(l=>/^\/reportCard\/print\/\d+/.test(l.path))?.path:undefined;
    result.push({ number, available: scores.length > 0 || officialGrade !== null, scores, officialGrade, comment: comment.trim(),...(printPath?{printPath}:{}) });
  }
  if (!result.length) throw new LegacyError('REPORT_FORMAT', 'Não foi possível identificar os blocos de Report Card. As notas anteriores foram mantidas.');
  return result;
}
export function parseReadOnlyDocument(html: string, origin: string) {
  if (isLogin(html)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
  const root = doc(html);
  root.querySelectorAll('script,style,nav,header,footer,form,button,input,textarea,select').forEach(el => el.remove());
  const main = root.querySelector('main, .container, .content, body') || root;
  const blocks = Array.from(main.querySelectorAll('h1,h2,h3,h4,p,tr,li')).map(el => ({ type: /^h\d$/.test(el.tagName.toLowerCase()) ? 'heading' : 'text', text: clean(el.textContent) })).filter(b => b.text).slice(0, 300);
  const files=parseFiles(html,origin);
  if (!blocks.length&&!files.length) throw new LegacyError('DOCUMENT_FORMAT', 'Não foi possível interpretar esse documento.');
  return { blocks, files };
}

export type CookieJar = Record<string, string>;
export class LegacyClient {
  constructor(public origin: string, public jar: CookieJar = {}, private transport: typeof fetch = fetch) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.hostname !== 'my.id-idiomas.com.br') throw new LegacyError('SECURE_ORIGIN_REQUIRED', 'A integração aguarda um endereço HTTPS verificado do MyID.', 503);
  }
  private cookies(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const values = headers.getSetCookie?.() || (headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/);
    for (const value of values) {
      const match = value.match(/^\s*([!#$%&'*+.^_`|~\w-]+)=([^;\r\n]*)/); if (!match || match[2].length > 4096) continue;
      if (/domain=/i.test(value) && !/domain=\.?my\.id-idiomas\.com\.br(?:;|$)/i.test(value)) continue;
      if (/max-age=0(?:;|$)/i.test(value)) delete this.jar[match[1]]; else this.jar[match[1]] = match[2];
    }
    if (Object.keys(this.jar).length > 20) throw new LegacyError('COOKIE_LIMIT', 'O portal retornou uma sessão incompatível.');
  }
  async request(path: string, options: { method?: 'GET' | 'POST'; body?: URLSearchParams; login?: boolean; logout?: boolean } = {}) {
    let target = path, method = options.method || 'GET', body = options.body;
    for (let i = 0; i < 5; i++) {
      const safe = safePath(target, this.origin), loginPath = options.login && /^(?:\/|\/login\/[\w-]+)$/.test(target);
      if (!safe && !loginPath && !(options.logout&&target==='/logout/index'&&method==='GET')) throw new LegacyError('PATH_BLOCKED', 'O portal indicou um endereço fora do escopo da integração.');
      const headers: Record<string, string> = { Accept: 'text/html,application/pdf;q=0.9' };
      const cookie = Object.entries(this.jar).map(([k,v]) => k + '=' + v).join('; '); if (cookie) headers.Cookie = cookie;
      if (body) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; headers.Origin = this.origin; headers.Referer = this.origin + '/'; }
      let response: Response;
      try { response = await this.transport(this.origin + target, { method, body: body?.toString(), headers, redirect: 'manual', signal: AbortSignal.timeout(15000) }); }
      catch { throw new LegacyError('UPSTREAM_UNAVAILABLE', 'Não foi possível conectar ao MyID original. Tente novamente mais tarde.'); }
      this.cookies(response);
      if ([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location'); if (!location) throw new LegacyError('REDIRECT_INVALID', 'O portal retornou um redirecionamento inválido.');
        const next = new URL(location, this.origin + target);
        if (next.origin !== this.origin) throw new LegacyError('REDIRECT_BLOCKED', 'O portal redirecionou para um endereço fora da integração.');
        target = next.pathname + next.search;
        if(options.logout){if(next.pathname==='/'||next.pathname.startsWith('/login/'))return response;throw new LegacyError('LOGOUT_UNCONFIRMED','O portal não confirmou o encerramento da sessão.');}
        if(options.login&&method==='POST'&&next.pathname.startsWith('/login/')&&next.searchParams.get('login_error')==='1')throw new LegacyError('LOGIN_FAILED','Usuário ou senha não reconhecidos pelo MyID.',401);
        if (!options.login && /^\/login(?:\/|$)/.test(target)) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
        if (response.status === 303 || [301,302].includes(response.status) && method === 'POST') { method = 'GET'; body = undefined; }
        continue;
      }
      if (response.status === 401) throw new LegacyError('SESSION_EXPIRED', 'Sua sessão no MyID expirou. Conecte novamente.', 401);
      if (response.status === 429) throw new LegacyError('RATE_LIMIT', 'O MyID pediu uma pausa nas consultas. Tente novamente em alguns minutos.', 429);
      if (response.status >= 500) throw new LegacyError('UPSTREAM_UNAVAILABLE', 'O MyID está temporariamente indisponível. A importação pode ser retomada mais tarde.');
      if (!response.ok) throw new LegacyError('UPSTREAM_RESPONSE', 'O MyID não disponibilizou esse recurso (' + response.status + ').');
      return response;
    }
    throw new LegacyError('REDIRECT_LIMIT', 'O portal não concluiu o redirecionamento.');
  }
  async html(path: string, options: Parameters<LegacyClient['request']>[1] = {}) {
    return decodeHtml(await this.request(path, options));
  }
  async login(username: string, password: string) {
    const form = loginForm(await this.html('/', { login: true }), this.origin);
    form.set('username', username); form.set('password', password);
    const landing = await this.html('/login/authenticate', { method: 'POST', body: form, login: true });
    if (isLogin(landing) || !this.jar.JSESSIONID) throw new LegacyError('LOGIN_FAILED', 'Usuário ou senha não reconhecidos pelo MyID.', 401);
    let page=landing,path=findProfilePath(page,this.origin);
    if(path)page=await this.html(path);
    let profile;
    try{profile=parseProfile(page,this.origin);}catch(error){
      if(!(error instanceof LegacyError)||error.code!=='PROFILE_FORMAT')throw error;
      page=await this.html('/perfil/home');path=findProfilePath(page,this.origin);
      profile=parseProfile(path?await this.html(path):page,this.origin);
    }
    return { ...profile, profilePath: path || profile.profilePath || '/perfil/home' };
  }
  async logout(){const response=await this.request('/logout/index',{logout:true});await response.body?.cancel();this.jar={};return {requested:true};}
}
export async function decodeHtml(response:Response){
  const type=response.headers.get('content-type')||'';
  if(!/^text\/html\b/i.test(type))throw new LegacyError('HTML_EXPECTED','O formato recebido não corresponde à página esperada.');
  const charset=type.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]||'utf-8';
  const bytes=await boundedBody(response,2*1024*1024);
  try{return new TextDecoder(charset).decode(bytes);}catch{throw new LegacyError('CHARSET_UNSUPPORTED','A codificação da página precisa ser verificada.');}
}
export async function boundedBody(response: Response, max: number) {
  if (Number(response.headers.get('content-length')) > max) throw new LegacyError('SIZE_LIMIT', 'O arquivo excede o limite permitido.');
  const reader = response.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new LegacyError('SIZE_LIMIT', 'O arquivo excede o limite permitido.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
