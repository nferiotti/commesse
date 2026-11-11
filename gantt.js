/* Gestione Commesse — cronoprogramma: calendario lavorativo, legami tra le attività e disegno del diagramma di Gantt.
   File senza dipendenze: lo usano l'app per Mac (scheda Cronoprogramma e PDF) e la webapp iPhone (copia identica in app/iphone).
   Le date sono numeri di giorno (giorni dal 1/1/1970): così i conti non risentono dell'ora legale. */
'use strict';

const Gantt = (() => {
  const MS = 86400000;
  const p2 = n => String(n).padStart(2, '0');
  const num = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS) : null; };
  const iso = n => { const d = new Date(n * MS); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
  const data = n => new Date(n * MS);
  const dow = n => data(n).getUTCDay();               // 0 = domenica, 6 = sabato
  const it = n => { const d = data(n); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
  const oggi = () => { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS); };
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MESI3 = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const breve = n => { const d = data(n); return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI3[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

  // ------------------------------------------------------------ festività nazionali italiane
  function pasqua(y) {          // algoritmo di Meeus/Jones/Butcher (calendario gregoriano)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
    return Math.round(Date.UTC(y, mese - 1, giorno) / MS);
  }
  const FESTE = [['01-01', 'Capodanno'], ['01-06', 'Epifania'], ['04-25', 'Festa della Liberazione'], ['05-01', 'Festa del lavoro'], ['06-02', 'Festa della Repubblica'],
    ['08-15', 'Ferragosto'], ['10-04', 'San Francesco d\'Assisi', 2026], ['11-01', 'Ognissanti'], ['12-08', 'Immacolata Concezione'], ['12-25', 'Natale'], ['12-26', 'Santo Stefano']];
  const cacheFeste = {};
  function festeAnno(y) {
    if (cacheFeste[y]) return cacheFeste[y];
    const m = new Map();
    for (const [md, nome, dal] of FESTE) if (!dal || y >= dal) m.set(num(`${y}-${md}`), nome);
    const p = pasqua(y);
    m.set(p, 'Pasqua'); m.set(p + 1, 'Lunedì dell\'Angelo (Pasquetta)');
    return (cacheFeste[y] = m);
  }
  const festa = n => festeAnno(data(n).getUTCFullYear()).get(n) || '';
  const festeTra = (da, a) => { const out = []; for (let y = data(da).getUTCFullYear(); y <= data(a).getUTCFullYear(); y++) for (const [n, nome] of festeAnno(y)) if (n >= da && n <= a) out.push({ n, nome }); return out.sort((x, y) => x.n - y.n); };

  // ------------------------------------------------------------ calendario del cantiere
  // chiusure: [{ da, a, nome }] giorni di chiusura del cantiere (ferie, patrono…)
  function calendario(crono) {
    const chiuso = new Map();
    for (const z of (crono && crono.chiusure) || []) {
      const da = num(z.da), a = num(z.a || z.da);
      if (da == null || a == null || a < da || a - da > 400) continue;
      for (let n = da; n <= a; n++) chiuso.set(n, z.nome || 'Chiusura del cantiere');
    }
    // perché un giorno non è lavorativo ('' = si lavora)
    const motivo = (n, sabato) => { const g = dow(n); if (g === 0) return 'domenica'; if (g === 6 && !sabato) return 'sabato'; return festa(n) || chiuso.get(n) || ''; };
    const lavora = (n, sabato) => !motivo(n, sabato);
    const primo = (n, sab) => { for (let i = 0; i < 4000 && !lavora(n, sab); i++) n++; return n; };          // primo giorno lavorativo da n compreso
    const ultimo = (n, sab) => { for (let i = 0; i < 4000 && !lavora(n, sab); i++) n--; return n; };         // ultimo giorno lavorativo fino a n compreso
    const avanti = (n, k, sab) => {        // da un giorno lavorativo, k giorni lavorativi avanti (o indietro se k < 0)
      const passo = k < 0 ? -1 : 1;
      for (let i = 0, fatti = 0; fatti < Math.abs(k) && i < 20000; i++) { n += passo; if (lavora(n, sab)) fatti++; }
      return n;
    };
    const conta = (da, a, sab) => { let k = 0; for (let n = da; n <= a; n++) if (lavora(n, sab)) k++; return k; };   // giorni lavorativi tra due date comprese
    const fineDa = (s, durata, sab) => durata > 0 ? avanti(s, durata - 1, sab) : s;
    return { motivo, lavora, primo, ultimo, avanti, conta, fineDa, chiuso };
  }

  // ------------------------------------------------------------ legami
  const TIPI = [
    { id: 'FI', nome: 'Fine → Inizio', spiega: 'inizia dopo la fine di' },
    { id: 'II', nome: 'Inizio → Inizio', spiega: 'inizia insieme a' },
    { id: 'FF', nome: 'Fine → Fine', spiega: 'finisce insieme a' },
  ];
  // tutte le attività che dipendono (anche indirettamente) da id: non si possono scegliere come suoi predecessori
  function successori(attivita, id) {
    const out = new Set([id]);
    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (const a of attivita) if (!out.has(a.id) && (a.legami || []).some(l => out.has(l.da))) { out.add(a.id); cambiato = true; }
    }
    out.delete(id);
    return out;
  }
  const creaCiclo = (attivita, da, a) => da === a || successori(attivita, a).has(da);

  // ------------------------------------------------------------ calcolo delle date
  // crono: { attivita: [...], chiusure }, o.inizio = 'AAAA-MM-GG' (inizio lavori di base)
  // risultato: { voci: { id: { s, e, inizio, fine, spinta, daLegame, violata, ritardo } }, inizio, fine, avanzamento, ordine }
  function calcola(crono, o = {}) {
    const cal = calendario(crono);
    const lista = (crono && crono.attivita) || [];
    const perId = new Map(lista.map(a => [a.id, a]));
    const base = num(o.inizio) ?? num(crono && crono.inizio) ?? oggi();
    const voci = {};
    const visita = new Map();       // 1 = in corso, 2 = fatto (i legami che chiudono un giro vengono ignorati)
    const ignorati = [];
    const fai = a => {
      if (visita.get(a.id) === 2) return voci[a.id];
      visita.set(a.id, 1);
      const sab = !!a.sabato;
      const D = Math.max(0, Math.round(Number(a.durata) || 0));
      const richiesta = num(a.inizio);
      let minimo = richiesta ?? base, spinta = false, daLegame = '';
      for (const l of a.legami || []) {
        const pa = perId.get(l.da);
        if (!pa) continue;
        if (visita.get(pa.id) === 1) { ignorati.push({ da: l.da, a: a.id }); continue; }
        const p = fai(pa);
        const g = Math.round(Number(l.gg) || 0);
        let cand;
        if (l.tipo === 'II') cand = cal.avanti(cal.primo(p.s, sab), g, sab);
        else if (l.tipo === 'FF') { const fineMin = cal.avanti(cal.ultimo(p.e, sab), g, sab); cand = D > 0 ? cal.avanti(fineMin, -(D - 1), sab) : fineMin; }
        else cand = cal.avanti(cal.primo(p.d0 ? p.s : p.e + 1, sab), g, sab);     // Fine → Inizio: il giorno lavorativo dopo la fine
        if (cand > minimo) { minimo = cand; spinta = true; daLegame = pa.id; }
      }
      const s = cal.primo(minimo, sab);
      const e = cal.fineDa(s, D, sab);
      const scad = a.milestone ? num(a.scadenza) : null;
      const perc = Math.max(0, Math.min(100, Number(a.perc) || 0));
      const v = {
        s, e, d0: D === 0, durata: D, inizio: iso(s), fine: iso(e), perc,
        spinta: spinta && (richiesta == null || s > cal.primo(richiesta, sab)), daLegame,
        scadenza: scad, violata: scad != null && e > scad,
        ritardo: perc < 100 && oggi() > e,
      };
      voci[a.id] = v;
      visita.set(a.id, 2);
      return v;
    };
    lista.forEach(fai);
    const tutte = Object.values(voci);
    const inizio = tutte.length ? Math.min(...tutte.map(v => v.s)) : null;
    const fine = tutte.length ? Math.max(...tutte.map(v => v.e)) : null;
    const pesi = tutte.reduce((t, v) => t + Math.max(1, v.durata), 0);
    const avanzamento = pesi ? tutte.reduce((t, v) => t + Math.max(1, v.durata) * v.perc, 0) / pesi : 0;
    return { voci, inizio, fine, avanzamento, ignorati, cal, base };
  }

  // ------------------------------------------------------------ colori delle imprese
  const PALETTE = ['#3d6fb6', '#d0632c', '#2f8f83', '#a34a7a', '#c98a1b', '#4f8a3c', '#6a55a8', '#b8433a', '#1f8fb8', '#8a6d3b', '#5c7891', '#c2549d', '#71912a', '#7a5230'];
  const normale = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const chiaveImpresa = a => a.impresaId ? 'id:' + a.impresaId : (normale(a.impresa) ? 'n:' + normale(a.impresa) : '');
  // assegna un colore a ogni impresa nuova (stessa impresa = stesso colore su tutte le sue lavorazioni); restituisce true se ha aggiunto qualcosa
  function assegnaColori(crono) {
    crono.colori = crono.colori || {};
    let nuovi = false;
    for (const a of crono.attivita || []) {
      const k = chiaveImpresa(a);
      if (!k || crono.colori[k]) continue;
      const usati = new Set(Object.values(crono.colori));
      crono.colori[k] = PALETTE.find(c => !usati.has(c)) || PALETTE[Object.keys(crono.colori).length % PALETTE.length];
      nuovi = true;
    }
    return nuovi;
  }
  const SENZA = '#8a96a3';
  const coloreDi = (crono, a) => { const k = chiaveImpresa(a); return (k && crono.colori && crono.colori[k]) || SENZA; };
  // legenda: una voce per impresa, nell'ordine in cui compaiono
  function legenda(crono, nomeImpresa) {
    const visti = new Map();
    for (const a of crono.attivita || []) {
      const k = chiaveImpresa(a) || '';
      if (!visti.has(k)) visti.set(k, { chiave: k, nome: k ? nomeImpresa(a) : 'Impresa non indicata', colore: coloreDi(crono, a), n: 0 });
      visti.get(k).n++;
    }
    return [...visti.values()];
  }

  // ------------------------------------------------------------ disegno (SVG)
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SCALE = { giorni: 26, settimane: 10, mesi: 3.2 };
  const ALTO = 34, TESTA = 46;

  // intervallo di date da mostrare
  // margine: a schermo si lascia spazio prima e dopo i lavori, per scorrere nel tempo
  const MARGINI = { giorni: [14, 30], settimane: [28, 56], mesi: [62, 124] };
  function intervallo(crono, r, scala, margine = false) {
    let da = r.inizio ?? r.base, a = r.fine ?? r.base + 30;
    for (const v of Object.values(r.voci)) { if (v.scadenza != null) a = Math.max(a, v.scadenza); }
    for (const b of Object.values((crono.base && crono.base.voci) || {})) { const s = num(b[0]), e = num(b[1]); if (s != null) da = Math.min(da, s); if (e != null) a = Math.max(a, e); }
    const t = oggi();
    if (t >= da - 20 && t <= a + 20) { da = Math.min(da, t); a = Math.max(a, t); }
    if (margine) { const m = MARGINI[scala] || MARGINI.settimane; da -= m[0]; a += m[1]; }
    if (scala === 'mesi') { const d0 = data(da), d1 = data(a); da = Math.round(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1) / MS); a = Math.round(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 0) / MS); }
    else if (scala === 'settimane') { da -= (dow(da) + 6) % 7; a += 6 - (dow(a) + 6) % 7 + 7; }
    else { da -= 2; a += 5; }
    return { da, a };
  }

  // o: { scala, px (pixel per giorno), da, a, righe (attività nell'ordine), nomi: larghezza della colonna nomi nel disegno (0 = senza),
  //      base (mostra la linea di base), interattivo, numeri (numero di riga accanto al nome) }
  function svg(crono, r, o) {
    const px = o.px || SCALE[o.scala] || 10;
    const L = o.nomi || 0;
    const righe = o.righe || crono.attivita || [];
    let { da, a } = o.da != null ? o : intervallo(crono, r, o.scala, o.margine);
    if (o.minimo) while ((a - da + 1) * px < o.minimo - L) a++;      // il disegno arriva almeno fino al bordo del riquadro
    const giorni = a - da + 1;
    const W = L + giorni * px, H = TESTA + Math.max(1, righe.length) * ALTO + 8;
    const x = n => L + (n - da) * px;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" class="gantt-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Helvetica, Arial, sans-serif">`);
    const taglio = 'g-taglio-' + Math.random().toString(36).slice(2, 8);     // ogni disegno ha il suo: nel PDF ce ne sono più di uno
    out.push(`<defs><marker id="g-freccia" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="#5d6874"/></marker><clipPath id="${taglio}"><rect x="${L}" y="0" width="${W - L}" height="${H}"/></clipPath></defs>`);
    out.push(`<g clip-path="url(#${taglio})">`);   // le barre che escono dal periodo disegnato non finiscono sopra i nomi
    // righe alternate
    righe.forEach((_, i) => { if (i % 2) out.push(`<rect x="${L}" y="${TESTA + i * ALTO}" width="${giorni * px}" height="${ALTO}" fill="#f6f8fa"/>`); });
    // giorni non lavorativi (domeniche, festivi, chiusure; i sabati più chiari)
    if (px >= 5) {
      for (let n = da; n <= a; n++) {
        const g = dow(n), f = festa(n) || r.cal.chiuso.get(n);
        if (g === 0 || f) out.push(`<rect x="${x(n)}" y="${TESTA}" width="${px}" height="${H - TESTA}" fill="#e6ebf0"><title>${esc(breve(n) + (f ? ' — ' + f : ''))}</title></rect>`);
        else if (g === 6) out.push(`<rect x="${x(n)}" y="${TESTA}" width="${px}" height="${H - TESTA}" fill="#eff3f6"/>`);
      }
    } else {
      for (let n = da; n <= a; n++) { const f = festa(n) || r.cal.chiuso.get(n); if (f && dow(n) !== 0) out.push(`<rect x="${x(n)}" y="${TESTA}" width="${Math.max(px, 1.5)}" height="${H - TESTA}" fill="#e3e8ee"/>`); }
    }
    // intestazione: mesi sopra, giorni / settimane / mesi sotto
    out.push(`<rect x="${L}" y="0" width="${giorni * px}" height="${TESTA}" fill="#e8eef4"/>`);
    out.push(`<line x1="${L}" y1="${TESTA / 2}" x2="${W}" y2="${TESTA / 2}" stroke="#d3dce5"/>`);
    const sopra = o.scala === 'mesi' ? 'anno' : 'mese';
    let n = da;
    while (n <= a) {
      const d = data(n);
      const fineBlocco = sopra === 'anno' ? Math.round(Date.UTC(d.getUTCFullYear() + 1, 0, 1) / MS) - 1 : Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / MS) - 1;
      const f = Math.min(fineBlocco, a);
      const w = (f - n + 1) * px;
      const testo = sopra === 'anno' ? String(d.getUTCFullYear()) : (w > 90 ? `${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}` : w > 34 ? MESI3[d.getUTCMonth()] : '');
      out.push(`<line x1="${x(n)}" y1="0" x2="${x(n)}" y2="${H}" stroke="#cfd8e1"/>`);
      if (testo) out.push(`<text x="${x(n) + 6}" y="16" font-size="11.5" font-weight="700" fill="#2f3e4c">${esc(testo)}</text>`);
      n = f + 1;
    }
    if (o.scala === 'mesi') {
      for (let k = da; k <= a; k++) {
        const d = data(k);
        if (d.getUTCDate() !== 1) continue;
        const w = (new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()) * px;
        out.push(`<line x1="${x(k)}" y1="${TESTA / 2}" x2="${x(k)}" y2="${H}" stroke="#dde3ea"/>`);
        out.push(`<text x="${x(k) + w / 2}" y="38" font-size="10.5" text-anchor="middle" fill="#5d6874">${MESI3[d.getUTCMonth()]}</text>`);
      }
    } else if (o.scala === 'settimane' || px < 16) {
      for (let k = da; k <= a; k++) {
        if (dow(k) !== 1) continue;
        const d = data(k);
        out.push(`<line x1="${x(k)}" y1="${TESTA / 2}" x2="${x(k)}" y2="${H}" stroke="#e1e6ec"/>`);
        if (7 * px >= 30) out.push(`<text x="${x(k) + 3}" y="38" font-size="10" fill="#5d6874">${d.getUTCDate()}/${d.getUTCMonth() + 1}</text>`);
      }
    } else {
      for (let k = da; k <= a; k++) {
        const d = data(k), g = dow(k);
        out.push(`<text x="${x(k) + px / 2}" y="38" font-size="10" text-anchor="middle" fill="${g === 0 || festa(k) ? '#b8433a' : '#5d6874'}">${d.getUTCDate()}</text>`);
      }
    }
    out.push(`<line x1="${L}" y1="${TESTA}" x2="${W}" y2="${TESTA}" stroke="#b9c5d1"/>`);
    // legami (frecce)
    const riga = new Map(righe.map((att, i) => [att.id, i]));
    const yc = i => TESTA + i * ALTO + ALTO / 2;
    for (const att of righe) {
      const i = riga.get(att.id), v = r.voci[att.id];
      for (const l of att.legami || []) {
        const j = riga.get(l.da), p = r.voci[l.da];
        if (j == null || !p || !v) continue;
        const y0 = yc(j), y1 = yc(i);
        const pS = x(p.s), pE = x(p.e + 1), sS = x(v.s), sE = x(v.e + 1);
        const giu = y1 > y0 ? 1 : -1;
        let d;
        if (l.tipo === 'II') d = `M${pS} ${y0}h-8V${y1}H${sS - 1}`;
        else if (l.tipo === 'FF') { const xm = Math.max(pE, sE) + 8; d = `M${pE} ${y0}H${xm}V${y1}H${sE + 1}`; }
        else if (sS >= pE + 10) d = `M${pE} ${y0}H${sS - 6}V${y1 - giu * 9}`;
        else d = `M${pE} ${y0}h6V${y0 + giu * ALTO / 2}H${sS - 8}V${y1}H${sS - 1}`;
        out.push(`<path class="g-legame" d="${d}" fill="none" stroke="#5d6874" stroke-width="1.2" marker-end="url(#g-freccia)" opacity=".8"/>`);
      }
    }
    // barre
    righe.forEach((att, i) => {
      const v = r.voci[att.id]; if (!v) return;
      const y = TESTA + i * ALTO;
      const col = coloreDi(crono, att);
      const tit = esc(`${att.nome || 'Attività'}\n${breve(v.s)} → ${breve(v.e)} · ${v.durata} gg lavorativi${att.sabato ? ' (sabato compreso)' : ''}` +
        `\nAvanzamento ${v.perc}%` + (v.scadenza != null ? `\nScadenza vincolante: ${breve(v.scadenza)}${v.violata ? ' — SUPERATA' : ''}` : '') + (v.ritardo ? '\nIn ritardo rispetto al programma' : ''));
      // linea di base: barra sottile grigia
      const b = o.base && crono.base && crono.base.voci && crono.base.voci[att.id];
      if (b && num(b[0]) != null) out.push(`<rect x="${x(num(b[0]))}" y="${y + 26}" width="${Math.max(3, (num(b[1]) - num(b[0]) + 1) * px)}" height="4" rx="2" fill="#9aa5b1"><title>Linea di base: ${esc(it(num(b[0])))} → ${esc(it(num(b[1])))}</title></rect>`);
      if (v.d0) {     // milestone senza durata: rombo
        const cx = x(v.s) + px / 2, cy = y + ALTO / 2 - 2;
        out.push(`<g class="g-barra" data-id="${att.id}" style="cursor:${o.interattivo ? 'grab' : 'default'}"><path d="M${cx} ${cy - 8}L${cx + 8} ${cy}L${cx} ${cy + 8}L${cx - 8} ${cy}z" fill="${v.violata ? '#b8433a' : col}" stroke="#fff" stroke-width="1.5"/><title>${tit}</title></g>`);
        out.push(`<text x="${cx + 12}" y="${cy + 4}" font-size="11" font-weight="700" fill="#2f3e4c">${esc(it(v.s))}</text>`);
      } else {
        const bx = x(v.s), bw = Math.max(px, (v.e - v.s + 1) * px), by = y + 7, bh = ALTO - 16;
        out.push(`<g class="g-barra" data-id="${att.id}" style="cursor:${o.interattivo ? 'grab' : 'default'}">`);
        out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="${col}" fill-opacity=".32" stroke="${v.violata ? '#b8433a' : col}" stroke-width="${v.violata ? 2.2 : 1.2}"/>`);
        if (v.perc > 0) out.push(`<rect x="${bx}" y="${by}" width="${bw * v.perc / 100}" height="${bh}" rx="4" fill="${col}"/>`);
        out.push(`<title>${tit}</title></g>`);
        if (o.interattivo) {
          out.push(`<rect class="g-maniglia" data-id="${att.id}" x="${bx + bw - 6}" y="${by}" width="9" height="${bh}" fill="transparent" style="cursor:ew-resize"><title>Trascina per cambiare la durata</title></rect>`);
          out.push(`<circle class="g-aggancio" data-id="${att.id}" cx="${bx + bw + 9}" cy="${by + bh / 2}" r="5" fill="#fff" stroke="${col}" stroke-width="2" style="cursor:crosshair"><title>Trascina su un'altra attività per legarla (Fine → Inizio)</title></circle>`);
        }
        const etich = `${v.perc}%` + (v.ritardo ? ' · in ritardo' : '');
        out.push(`<text x="${bx + bw + (o.interattivo ? 18 : 5)}" y="${by + bh / 2 + 4}" font-size="10.5" fill="${v.ritardo ? '#b8433a' : '#5d6874'}">${esc(etich)}</text>`);
        if (att.milestone && v.scadenza == null) { const cx = x(v.e) + px / 2; out.push(`<path d="M${cx} ${by - 5}L${cx + 5} ${by}L${cx} ${by + 5}L${cx - 5} ${by}z" fill="#2f3e4c"/>`); }
      }
      // scadenza vincolante: rombo vuoto alla data, rosso se superata
      if (v.scadenza != null) {
        const cx = x(v.scadenza) + px / 2, cy = y + ALTO / 2 - 2;
        out.push(`<path d="M${cx} ${cy - 9}L${cx + 9} ${cy}L${cx} ${cy + 9}L${cx - 9} ${cy}z" fill="${v.violata ? '#b8433a' : '#fff'}" fill-opacity="${v.violata ? '.9' : '1'}" stroke="${v.violata ? '#b8433a' : '#2f3e4c'}" stroke-width="2"><title>Scadenza vincolante: ${esc(breve(v.scadenza))}${v.violata ? ' — superata di ' + r.cal.conta(v.scadenza + 1, v.e, att.sabato) + ' gg lavorativi' : ''}</title></path>`);
      }
    });
    // oggi
    const t = oggi();
    if (t >= da && t <= a) {
      out.push(`<line x1="${x(t) + px / 2}" y1="${TESTA - 4}" x2="${x(t) + px / 2}" y2="${H}" stroke="#b8433a" stroke-width="1.5" stroke-dasharray="4 3"/>`);
      out.push(`<rect x="${x(t) + px / 2 - 15}" y="${TESTA - 12}" width="30" height="13" rx="6.5" fill="#b8433a"/><text x="${x(t) + px / 2}" y="${TESTA - 2.5}" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">oggi</text>`);
    }
    out.push('</g>');
    // colonna dei nomi (solo nel PDF)
    if (L) {
      out.push(`<rect x="0" y="0" width="${L}" height="${H}" fill="#fff"/><rect x="0" y="0" width="${L}" height="${TESTA}" fill="#e8eef4"/>`);
      out.push(`<text x="10" y="29" font-size="11.5" font-weight="700" fill="#2f3e4c">Attività</text>`);
      out.push(`<text x="${L - 10}" y="29" font-size="10.5" font-weight="700" text-anchor="end" fill="#5d6874">gg · inizio → fine</text>`);
      const max = Math.floor((L - 132) / 5.6);       // caratteri per riga; i nomi lunghi vanno su due righe
      righe.forEach((att, i) => {
        const v = r.voci[att.id]; if (!v) return;
        const y = TESTA + i * ALTO;
        const nome = (o.numeri ? `${(o.primo || 0) + i + 1}. ` : '') + (att.nome || 'Attività senza nome');
        const peso = att.milestone ? ' font-weight="700"' : '';
        if (i % 2) out.push(`<rect x="0" y="${y}" width="${L}" height="${ALTO}" fill="#f6f8fa"/>`);
        if (nome.length <= max) out.push(`<text x="10" y="${y + 21}" font-size="11.5" fill="#111a24"${peso}>${esc(nome)}</text>`);
        else {
          let taglio = nome.lastIndexOf(' ', max); if (taglio < max * 0.5) taglio = max;
          let r2 = nome.slice(taglio).trim();
          if (r2.length > max) r2 = r2.slice(0, max - 1) + '…';
          out.push(`<text x="10" y="${y + 15}" font-size="10.5" fill="#111a24"${peso}>${esc(nome.slice(0, taglio))}</text><text x="10" y="${y + 28}" font-size="10.5" fill="#111a24"${peso}>${esc(r2)}</text>`);
        }
        const d0 = data(v.s), d1 = data(v.e);
        out.push(`<text x="${L - 10}" y="${y + 21}" font-size="10" text-anchor="end" fill="#5d6874">${v.durata} · ${p2(d0.getUTCDate())}/${p2(d0.getUTCMonth() + 1)} → ${p2(d1.getUTCDate())}/${p2(d1.getUTCMonth() + 1)}/${String(d1.getUTCFullYear()).slice(2)}</text>`);
      });
      out.push(`<line x1="${L}" y1="0" x2="${L}" y2="${H}" stroke="#b9c5d1"/>`);
    }
    out.push('</svg>');
    return { svg: out.join(''), larghezza: W, altezza: H, da, a, px, x };
  }

  return { num, iso, it, breve, oggi, pasqua, festa, festeTra, calendario, calcola, TIPI, successori, creaCiclo, PALETTE, SENZA, chiaveImpresa, normale,
    assegnaColori, coloreDi, legenda, svg, intervallo, SCALE, ALTO, TESTA, MESI, MESI3, dow };
})();
if (typeof module !== 'undefined') module.exports = Gantt;
