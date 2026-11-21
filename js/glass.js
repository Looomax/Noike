/* Noike — verre liquide (WebGL2). Deux usages : « Levez le voile » (bande qui se retire au scroll) et le bloc
   « Ce que Noike ne fait pas » (bloc fixe sur un fond très flou, mêmes réglages de verre).
   Pour « Levez le voile » : le verre liquide (WebGL2) recouvre la photo voile-1, puis se retire du haut vers le bas
   pendant le scroll. Les shaders viennent de l'outil Liquid Glass (même code, mêmes formules) ;
   seuls le recadrage « cover » de l'image et la lecture de la progression du scroll (--p) ont été ajoutés.
   Si WebGL ou l'image échoue, la photo seule reste affichée. */

(() => {

  // ---------- Réglages du verre (valeurs choisies dans l'outil, sur 100 → ÷ 100) ----------
  const GLASS = {
    refr: 0.70, edge: 0.70, disp: 0.43, blur: 0.30,
    tint: 0.20, tintColor: [200 / 255, 200 / 255, 200 / 255], high: 0, low: 0,
    flute: 0, grain: 0.09, depth: 0, rim: 0.17, round: 0.03,
  };
  const BLUR_MAX_FRACTION = 0.02;
  const BLUR_TEXTURE_MAX = 1280;
  const SATURATION = 1.0;
  const RIM_WIDTH = 0.003;
  const TINT_MAX = 0.8;
  const STRIP = { x0: 0.222, x1: 0.401 };   // place de la bande, en part de la largeur de la photo
  const OVER = 0.10;   // la bande dépasse de la photo en haut et en bas (part de la hauteur) : on ne voit pas ses bords haut et bas
  const START = 0.05, END = 0.9;   // le verre se retire entre ces deux moments de la progression

  const VERT = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FRAG_BLUR = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform float u_sigma;
in vec2 v_uv;
out vec4 o;
void main() {
  if (u_sigma < 0.05) { o = texture(u_tex, v_uv); return; }
  float stp = max(1.0, u_sigma * 3.0 / 16.0);
  vec4 sum = vec4(0.0);
  float ws = 0.0;
  for (int i = -16; i <= 16; i++) {
    float x = float(i) * stp;
    float w = exp(-0.5 * x * x / (u_sigma * u_sigma));
    sum += texture(u_tex, v_uv + u_dir * x) * w;
    ws += w;
  }
  o = sum / ws;
}`;

  const FRAG_MAIN = `#version 300 es
precision highp float;
uniform sampler2D u_img;
uniform sampler2D u_blur;
uniform vec2 u_res;      // taille de sortie en pixels
uniform vec2 u_uvs;      // recadrage « cover » de l'image : échelle
uniform vec2 u_uvo;      // recadrage « cover » de l'image : décalage
uniform vec2 u_c;        // centre du bloc (pixels, origine en bas à gauche)
uniform vec2 u_hs;       // demi-taille du bloc
uniform float u_r;       // rayon des coins
uniform float u_refr;    // 0..1
uniform float u_mix;     // 0..1 part de flou
uniform float u_rim;     // 0..1
uniform float u_sat;
uniform float u_rimw;    // épaisseur du reflet en pixels
uniform float u_disp;    // 0..1 dispersion des couleurs
uniform sampler2D u_tex; // texture du verre strié
uniform float u_flute;   // 0..1 force du verre strié
uniform float u_fw;      // largeur d'un carreau de texture en pixels
const vec3 EDGE_COLOR = vec3(0.70, 0.72, 0.74);   // gris neutre de la tranche du verre
const float EDGE_FROST = 0.6;                     // part de flou du fond vu à travers la tranche
const float EDGE_BODY = 0.7;                    // opacité de base de la tranche (0 = transparente, 1 = opaque)
const float TEX_BASE = 0.337;   // gris de fond de la texture (86/255) : aucun reflet à ce niveau
uniform vec3 u_tint;     // couleur de la teinte
uniform int u_bmTint;    // mode de fusion de la teinte avec l'image (0 = Normal)
uniform int u_bmTex;     // idem pour la texture (stries et grain)
uniform int u_bmDepth;   // idem pour l'épaisseur du verre (tranche)
uniform float u_tintamt; // 0..1 intensité de la teinte
uniform float u_grain;   // 0..1 intensité du grain
uniform float u_high;    // -1..1 hautes lumières du verre (0 = inchangé)
uniform float u_low;     // -1..1 basses lumières du verre (0 = inchangé)
const float GRAIN_CELLS = 1400.0;   // nombre de grains sur la largeur de l'image
uniform float u_depth;   // 0..1 épaisseur du verre (tranche)
uniform vec2 u_dir;      // côtés de la tranche : (0,0) = tous, sinon -1/0/1 par axe (haut = +1, droite = +1)
uniform float u_edge;    // 0..1 largeur de la bande de réfraction (part du demi-côté le plus court)
const float DISP_MAX = 0.6;
in vec2 v_uv;
out vec4 o;

// Générateur de nombres aléatoires (PCG) : pas de motif visible dans le grain
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

// Modes de fusion de la teinte (même formules que Figma / CSS)
vec3 blendOverlay(vec3 b, vec3 t) {
  return mix(1.0 - 2.0 * (1.0 - b) * (1.0 - t), 2.0 * b * t, step(b, vec3(0.5)));
}
vec3 blendMode(vec3 b, vec3 t, int m) {
  if (m == 1) return min(b, t);                                  // Assombrir
  if (m == 2) return b * t;                                      // Produit
  if (m == 3) return max(b, t);                                  // Éclaircir
  if (m == 4) return 1.0 - (1.0 - b) * (1.0 - t);                // Écran
  if (m == 5) return blendOverlay(b, t);                         // Incrustation
  if (m == 6) {                                                  // Lumière tamisée
    vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
    return mix(b + (2.0 * t - 1.0) * (d - b), b - (1.0 - 2.0 * t) * b * (1.0 - b), step(t, vec3(0.5)));
  }
  if (m == 7) return blendOverlay(t, b);                         // Lumière crue
  if (m == 8) return abs(b - t);                                 // Différence
  return t;                                                      // Normal
}

vec2 mapUV(vec2 q) { return q * u_uvs + u_uvo; }

float sdfR(vec2 p, float r) {
  vec2 q = abs(p - u_c) - u_hs + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdf(vec2 p) { return sdfR(p, u_r); }

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = p / u_res;
  vec2 dx = dFdx(uv) * u_uvs, dy = dFdy(uv) * u_uvs;
  vec3 base = textureGrad(u_img, mapUV(uv), dx, dy).rgb;

  float d = sdf(p);
  vec2 e = vec2(1.0, 0.0);
  vec2 n = vec2(sdf(p + e.xy) - sdf(p - e.xy), sdf(p + e.yx) - sdf(p - e.yx));
  float nl = length(n);
  n = nl > 1e-4 ? n / nl : vec2(0.0);

  // Réfraction : sur les bords, le fond est tiré depuis l'intérieur (effet loupe).
  // Elle utilise des coins adoucis, sinon un trait apparaît sur la diagonale des coins droits.
  float m = min(u_hs.x, u_hs.y);
  float bz = max(u_edge, 0.02) * m;   // largeur de la bande déformée
  float rr = max(u_r, 0.25 * m);
  float dr = sdfR(p, rr);
  vec2 nr = vec2(sdfR(p + e.xy, rr) - sdfR(p - e.xy, rr), sdfR(p + e.yx, rr) - sdfR(p - e.yx, rr));
  float nrl = length(nr);
  nr = nrl > 1e-4 ? nr / nrl : vec2(0.0);
  float t = clamp(-dr / bz, 0.0, 1.0);
  float f = 1.0 - sqrt(1.0 - (1.0 - t) * (1.0 - t));
  float amp = u_refr * 0.7 * m;   // la force ne dépend pas de la largeur
  vec2 shiftRound = nr * amp * f;

  // Coins droits : la déformation est calculée séparément sur chaque axe (gauche/droite, haut/bas).
  // Elle reste continue dans les coins, sans ligne en diagonale. Les coins arrondis gardent le calcul ci-dessus.
  vec2 tt = clamp((u_hs - abs(p - u_c)) / bz, 0.0, 1.0);
  vec2 fs = 1.0 - sqrt(1.0 - (1.0 - tt) * (1.0 - tt));
  vec2 shiftSquare = sign(p - u_c) * fs * amp;
  float wSq = 1.0 - smoothstep(0.0, 0.3, u_r / m);
  vec2 shift = mix(shiftRound, shiftSquare, wSq);


  // Verre strié : la texture (image) est répétée sur le bloc, accrochée à son coin haut-gauche.
  // Elle sert à la fois de lumière (reflets) et de relief : la variation de luminosité d'un côté à l'autre
  // d'un point décale légèrement le fond.
  vec2 tp = vec2(p.x - (u_c.x - u_hs.x), (u_c.y + u_hs.y) - p.y) / u_fw;
  vec2 tdx = dFdx(tp), tdy = dFdy(tp);
  float te = 4.0 / 1254.0;   // distance de comparaison, en proportion de la texture
  float tl = textureGrad(u_tex, tp, tdx, tdy).r;
  float tgrad = textureGrad(u_tex, tp - vec2(te, 0.0), tdx, tdy).r - textureGrad(u_tex, tp + vec2(te, 0.0), tdx, tdy).r;
  shift.x += u_flute * 0.06 * u_fw * tgrad;

  // Dispersion : rouge et bleu sont déviés différemment, vert reste au milieu
  vec3 col;
  for (int c = 0; c < 3; c++) {
    float s = 1.0 + u_disp * DISP_MAX * float(1 - c);
    vec2 quv = (p - shift * s) / u_res;
    col[c] = mix(textureGrad(u_img, mapUV(quv), dx, dy)[c], texture(u_blur, mapUV(quv))[c], u_mix);
  }
  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, u_sat);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float hiMask = pow(clamp((lum - 0.08) / 0.92, 0.0, 1.0), 0.6);  // hautes lumières : dès les tons moyens-sombres
  col = col * (1.0 + u_high * 0.45 * hiMask) + u_high * 0.10 * hiMask;   // (verre uniquement)
  col += u_low * 0.25 * (1.0 - smoothstep(0.0, 0.6, lum));        // basses lumières (verre uniquement)
  col = mix(col, blendMode(col, u_tint, u_bmTint), u_tintamt);
  if (u_bmTex == 0) {
    col += vec3((tl - TEX_BASE) * u_flute * 0.8);                // reflets de la texture
  } else {                                                       // fusionnés avec l'image (gris neutre = 0,5)
    vec3 stries = vec3(clamp(0.5 + (tl - TEX_BASE), 0.0, 1.0));
    col = mix(col, blendMode(col, stries, u_bmTex), u_flute);
  }

  vec2 L = normalize(vec2(-1.0, 1.0));

  // Reflet : fin liseré, plus fort en haut à gauche et en bas à droite
  // Direction de la lumière et halo : calculés avec des coins adoucis (nr, dr), sinon une ligne apparaît
  // sur la diagonale des coins droits. Le liseré fin garde le vrai bord (coin net).
  float k = abs(dot(nr, L));
  float dirf = 0.3 + 0.7 * k * k;
  float rim = pow(clamp(1.0 + d / u_rimw, 0.0, 1.0), 2.0);
  float glow = pow(clamp(1.0 + dr / (u_rimw * 10.0), 0.0, 1.0), 3.0) * 0.15;
  col += vec3((rim * 0.9 + glow) * dirf * u_rim);

  // Épaisseur du verre : une tranche À L'EXTÉRIEUR du bloc. La face du verre (ci-dessus) ne change pas.
  // La tranche plie fortement le fond, est plus claire et légèrement verte (comme un verre épais vu par
  // la tranche), avec un trait de lumière sur son bord extérieur. Coins droits : calcul séparé par axe
  // (pas de ligne en diagonale) ; coins arrondis : calcul sur la distance au bloc.
  float bw = max(0.16 * m * u_depth, 0.001);                      // épaisseur de la tranche
  // Direction : (0,0) = tranche tout autour ; sinon seulement sur les côtés choisis (ex. bas + droite).
  bool allSides = u_dir.x == 0.0 && u_dir.y == 0.0;
  vec2 extLo = allSides ? vec2(bw) : max(-u_dir, vec2(0.0)) * bw;  // épaisseur côté gauche / bas
  vec2 extHi = allSides ? vec2(bw) : max(u_dir, vec2(0.0)) * bw;   // épaisseur côté droit / haut
  vec2 qc = p - u_c;
  vec2 ext = mix(extLo, extHi, step(0.0, qc));
  vec2 dq = (abs(qc) - u_hs) / max(ext, vec2(1e-3)) * step(vec2(1e-4), ext);   // 0 au bord du bloc, 1 au bord extérieur
  vec2 po = pow(clamp(dq, 0.0, 1.0), vec2(2.0));
  float profR = pow(clamp(d / bw, 0.0, 1.0), 2.0);
  float profT = mix(profR, po.x + po.y - po.x * po.y, wSq);
  vec2 shT = mix(n * profR, sign(p - u_c) * po, wSq) * bw * 1.6;
  vec3 tr;
  for (int c = 0; c < 3; c++) {
    float sc = 1.0 + u_disp * DISP_MAX * float(1 - c);
    vec2 tuv = (p - shT * sc) / u_res;
    tr[c] = mix(textureGrad(u_img, mapUV(tuv), dx, dy)[c], texture(u_blur, mapUV(tuv))[c], EDGE_FROST);
  }
  // Le verre épais est peu transparent : le fond est dépoli et recouvert d'un voile coloré
  tr = mix(tr, EDGE_COLOR, EDGE_BODY);
  tr = mix(tr, vec3(1.0) - (vec3(1.0) - tr) * (vec3(1.0) - EDGE_COLOR * 0.35), profT * 0.5);
  // Contour extérieur de la tranche. Les côtés sans tranche reculent d'1 px sous le bloc (pas de liseré).
  vec2 oLo = u_c - u_hs - extLo + (vec2(1.0) - step(vec2(1e-4), extLo));
  vec2 oHi = u_c + u_hs + extHi - (vec2(1.0) - step(vec2(1e-4), extHi));
  vec2 cO = 0.5 * (oLo + oHi), hsO = 0.5 * (oHi - oLo);
  float rO = min(u_r + (allSides ? bw * (1.0 - wSq) : 0.0), min(hsO.x, hsO.y));
  vec2 qo = abs(p - cO) - hsO + rO;
  float dO = length(max(qo, 0.0)) + min(max(qo.x, qo.y), 0.0) - rO;
  float lw = max(0.0025 * u_res.x, 1.0);
  float ring = 1.0 - smoothstep(0.0, lw, abs(dO + lw));
  vec2 dirn = normalize(mix(n, sign(p - u_c) * max(dq, vec2(1e-3)), wSq) + 1e-5);
  tr += vec3(1.0) * ring * u_depth * 0.3 * (0.25 + 0.75 * abs(dot(dirn, L)));

  if (!allSides) {
    // Extrusion en perspective : le bloc est la face avant, une copie décalée de v forme la face arrière,
    // et la tranche est la zone balayée entre les deux (les coins sont reliés, comme un cube vu de biais).
    vec2 v = normalize(u_dir) * bw;
    // dO = distance signée à la forme balayée (minimum de la distance au bloc le long du décalage)
    float lo = 0.0, hi = 1.0;
    for (int i = 0; i < 18; i++) {
      float m1 = lo + (hi - lo) / 3.0, m2 = hi - (hi - lo) / 3.0;
      if (sdf(p - m1 * v) < sdf(p - m2 * v)) hi = m2; else lo = m1;
    }
    float sStar = 0.5 * (lo + hi);
    dO = sdf(p - sStar * v);
    // sT : 0 sur l'arête de la face avant, 1 sur l'arête de la face arrière
    float sT = 0.0;
    if (sdf(p) > 0.0) {
      float a0 = 0.0, b0 = sStar;
      for (int i = 0; i < 14; i++) {
        float mid = 0.5 * (a0 + b0);
        if (sdf(p - mid * v) > 0.0) a0 = mid; else b0 = mid;
      }
      sT = b0;
    }
    vec2 p0 = p - sT * v;                                         // point correspondant sur la face avant
    vec2 nrm = normalize(vec2(sdf(p0 + e.xy) - sdf(p0 - e.xy), sdf(p0 + e.yx) - sdf(p0 - e.yx)) + 1e-6);
    vec2 shE = v * (1.6 * sT * sT);
    for (int c = 0; c < 3; c++) {
      float sc = 1.0 + u_disp * DISP_MAX * float(1 - c);
      vec2 tuv = (p - shE * sc) / u_res;
      tr[c] = mix(textureGrad(u_img, mapUV(tuv), dx, dy)[c], texture(u_blur, mapUV(tuv))[c], EDGE_FROST);
    }
    // Chaque face de la tranche a sa propre luminosité (lumière venant de la gauche)
    vec3 faceTone = EDGE_COLOR * (1.0 + 0.18 * dot(nrm, normalize(vec2(-0.9, 0.45))));
    tr = mix(tr, faceTone, EDGE_BODY);
    tr = mix(tr, vec3(1.0) - (vec3(1.0) - tr) * (vec3(1.0) - EDGE_COLOR * 0.35), sT * sT * 0.5);
    float ringE = 1.0 - smoothstep(0.0, lw, abs(dO + lw));
    tr += vec3(1.0) * ringE * u_depth * 0.3 * (0.25 + 0.75 * abs(dot(nrm, L)));
    // Arêtes qui relient les coins du bloc à ceux de la face arrière (seulement pour les coins droits)
    vec2 vn = v / length(v);
    float edgeLine = 0.0;
    for (int k = 0; k < 4; k++) {
      vec2 cp = u_c + u_hs * vec2((k & 1) == 0 ? -1.0 : 1.0, (k & 2) == 0 ? -1.0 : 1.0);
      vec2 w = p - cp;
      float t = dot(w, vn);
      float dperp = abs(w.x * vn.y - w.y * vn.x);
      edgeLine = max(edgeLine, (1.0 - smoothstep(0.0, lw, dperp)) * step(0.0, t) * step(t, bw));
    }
    tr += vec3(0.4) * edgeLine * wSq * u_depth;
  }
  // Grain fin sur le verre (face et tranche). La grille du grain est proportionnelle à l'image :
  // aperçu et export donnent le même grain, à la résolution près.
  vec2 gcell = floor(uv * vec2(GRAIN_CELLS, GRAIN_CELLS * u_res.y / u_res.x));
  uvec2 gq = uvec2(gcell);
  float gn = (float(pcg(gq.x + pcg(gq.y))) / 4294967295.0 - 0.5) * 2.0 * u_grain * 0.09;
  tr += gn;
  if (u_bmTex == 0) {
    col += gn;
  } else {                                                       // grain fusionné avec l'image
    float grainLayer = 0.5 + gn / 0.09 * 0.18;
    col = blendMode(col, vec3(grainLayer), u_bmTex);
  }

  float aT = (1.0 - smoothstep(-0.75, 0.75, dO)) * step(0.0005, u_depth);
  vec3 outside = mix(base, blendMode(base, clamp(tr, 0.0, 1.0), u_bmDepth), aT);

  float a = 1.0 - smoothstep(-0.75, 0.75, d);
  o = vec4(mix(outside, clamp(col, 0.0, 1.0), a), 1.0);
}`;

  // Un verre = un canvas, une image, une façon de calculer la place du bloc (geometry) et ce qui le redessine (observe).
  // bgBlur : si renseigné (part de la largeur de l'image), l'image entière est très floue (fond du bloc « ne fait pas »).
  function create(img, canvas, opts) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) { canvas.remove(); return; }

  function compile(type, code) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(frag, names) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    names.forEach((n) => (u[n] = gl.getUniformLocation(p, n)));
    return { p, u };
  }
  function texParams(min, wrap) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  }
  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    texParams(gl.LINEAR, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  let programs, imgTex, blurA, blurB, glassTex;
  let ready = false, raf = 0;

  function init() {
    programs = {
      blur: program(FRAG_BLUR, ["u_tex", "u_dir", "u_sigma"]),
      main: program(FRAG_MAIN, ["u_img", "u_blur", "u_res", "u_uvs", "u_uvo", "u_c", "u_hs", "u_r", "u_refr", "u_mix", "u_rim", "u_sat", "u_rimw", "u_disp", "u_edge", "u_tint", "u_tintamt", "u_bmTint", "u_bmTex", "u_bmDepth", "u_flute", "u_fw", "u_tex", "u_depth", "u_dir", "u_grain", "u_high", "u_low"]),
    };
    glassTex = gl.createTexture();   // gris uni : pas de strie
    gl.bindTexture(gl.TEXTURE_2D, glassTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([86, 86, 86, 255]));
    texParams(gl.LINEAR, gl.REPEAT);

    imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    texParams(gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);

    const bw = Math.min(img.naturalWidth, BLUR_TEXTURE_MAX);
    const bh = Math.max(1, Math.round((img.naturalHeight * bw) / img.naturalWidth));
    blurA = target(bw, bh);
    blurB = target(bw, bh);
    const sigma = (opts.bgBlur || GLASS.blur * BLUR_MAX_FRACTION) * bw;
    gl.useProgram(programs.blur.p);
    gl.uniform1i(programs.blur.u.u_tex, 0);
    gl.uniform1f(programs.blur.u.u_sigma, sigma);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.uniform2f(programs.blur.u.u_dir, 1 / bw, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform2f(programs.blur.u.u_dir, 0, 1 / bh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    ready = true;
  }

  function draw() {
    raf = 0;
    if (!ready) return;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const P = programs.main;
    const G = opts.geometry(w, h);
    const fx = G.fx, fy = G.fy, posX = G.posX, posY = G.posY;
    let hsx = G.hsx, hsy = G.hsy;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, opts.bgBlur ? blurB.tex : imgTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, glassTex);
    gl.uniform1i(P.u.u_img, 0);
    gl.uniform1i(P.u.u_blur, 1);
    gl.uniform1i(P.u.u_tex, 2);
    gl.uniform2f(P.u.u_res, w, h);
    gl.uniform2f(P.u.u_uvs, fx, fy);
    gl.uniform2f(P.u.u_uvo, (1 - fx) * posX, (1 - fy) * (1 - posY));
    gl.uniform2f(P.u.u_c, G.cx, G.cy);
    gl.uniform2f(P.u.u_hs, hsx, hsy);
    gl.uniform1f(P.u.u_r, GLASS.round * Math.min(hsx, hsy));
    gl.uniform1f(P.u.u_refr, GLASS.refr);
    gl.uniform1f(P.u.u_mix, 1);
    gl.uniform1f(P.u.u_rim, GLASS.rim);
    gl.uniform1f(P.u.u_sat, SATURATION);
    gl.uniform1f(P.u.u_rimw, RIM_WIDTH * w);
    gl.uniform1f(P.u.u_disp, GLASS.disp);
    gl.uniform1f(P.u.u_edge, GLASS.edge);
    gl.uniform3f(P.u.u_tint, ...GLASS.tintColor);
    gl.uniform1f(P.u.u_tintamt, GLASS.tint * TINT_MAX);
    gl.uniform1i(P.u.u_bmTint, 0);
    gl.uniform1i(P.u.u_bmTex, 0);
    gl.uniform1i(P.u.u_bmDepth, 0);
    gl.uniform1f(P.u.u_flute, GLASS.flute);
    gl.uniform1f(P.u.u_depth, GLASS.depth);
    gl.uniform1f(P.u.u_grain, GLASS.grain);
    gl.uniform1f(P.u.u_high, GLASS.high);
    gl.uniform1f(P.u.u_low, GLASS.low);
    gl.uniform2f(P.u.u_dir, 0, 0);
    gl.uniform1f(P.u.u_fw, 0.4 * w);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    schedule();
  }

  function start() {
    try { init(); } catch (e) { canvas.remove(); return; }
    new ResizeObserver(resize).observe(canvas);
    if (opts.observe) opts.observe(schedule);
    resize();
    if (opts.flag) document.documentElement.classList.add(opts.flag);
  }

  (img.decode ? img.decode() : Promise.resolve()).then(start, () => canvas.remove());
  }

  // Recadrage « cover » de l'image (comme object-fit: cover + object-position), commun aux deux usages
  function cover(img, w, h) {
    const pos = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const posX = Number.isFinite(pos[0]) ? pos[0] : 0.5, posY = Number.isFinite(pos[1]) ? pos[1] : 0.5;
    const ca = w / h, ia = img.naturalWidth / img.naturalHeight;
    const fx = ca > ia ? 1 : ca / ia, fy = ca > ia ? ia / ca : 1;
    return { fx, fy, posX, posY, ox: (1 - fx) * posX, oy: (1 - fy) * (1 - posY) };
  }

  // ---------- « Levez le voile » : bande de verre qui se retire par le haut pendant le scroll ----------
  const voile = document.querySelector("[data-voile]");
  const voileImg = voile && voile.querySelector(".voile__layer--1");
  if (voile && voileImg && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const canvas = document.createElement("canvas");
    canvas.className = "voile__glass";
    canvas.setAttribute("aria-hidden", "true");
    voileImg.after(canvas);
    const progress = () => {
      const p = parseFloat(voile.style.getPropertyValue("--p"));
      return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
    };
    create(voileImg, canvas, {
      flag: "has-glass",
      observe: (schedule) => new MutationObserver(schedule).observe(voile, { attributes: true, attributeFilter: ["style"] }),
      geometry: (w, h) => {
        const g = Math.min(1, Math.max(0, (progress() - START) / (END - START)));
        // La bande va du haut au bas de la photo ; elle se retire par le haut et disparaît tout en bas.
        const yTop = -OVER + g * (1 + OVER);
        const c = cover(voileImg, w, h);
        const toX = (u) => ((u - c.ox) / c.fx) * w;
        const toY = (v) => ((1 - v - c.oy) / c.fy) * h;
        const x0 = toX(STRIP.x0), x1 = toX(STRIP.x1);
        const yHi = toY(yTop), yLo = toY(1 + OVER);
        let hsx = (x1 - x0) / 2, hsy = (yHi - yLo) / 2;
        if (hsy < 0.5) { hsx = 0; hsy = 0; }   // verre entièrement retiré
        return { fx: c.fx, fy: c.fy, posX: c.posX, posY: c.posY, cx: (x0 + x1) / 2, cy: (yHi + yLo) / 2, hsx, hsy };
      },
    });
  }

  // ---------- « Ce que Noike ne fait pas » : un bloc de verre fixe derrière la liste (à droite), sur un fond très flou ----------
  const card = document.querySelector("[data-glass-card]");
  const cardImg = card && card.querySelector(".nofait__bg");
  const cardHead = card && card.querySelector(".nofait__list");
  if (card && cardImg && cardHead) {
    const canvas = document.createElement("canvas");
    canvas.className = "nofait__glass";
    canvas.setAttribute("aria-hidden", "true");
    cardImg.after(canvas);
    create(cardImg, canvas, {
      bgBlur: 0.02,
      observe: (schedule) => {
        const ro = new ResizeObserver(schedule);
        ro.observe(card);
        ro.observe(cardHead);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
      },
      geometry: (w, h) => {
        const c = cover(cardImg, w, h);
        const cr = card.getBoundingClientRect(), lr = cardHead.getBoundingClientRect();
        const s = w / cr.width;                                   // pixels du canvas par pixel d'écran
        const inset = 16, pad = 24;                               // marge égale en haut, à droite et en bas ; air autour de la liste
        const stacked = card.querySelector(".nofait__head").getBoundingClientRect().bottom <= lr.top + 1;   // mobile : liste sous le titre
        const x0 = Math.max(inset, lr.left - cr.left - pad) * s, x1 = w - inset * s;
        const top = (stacked ? Math.max(inset, lr.top - cr.top - pad) : inset) * s, bot = h - inset * s;
        return { fx: c.fx, fy: c.fy, posX: c.posX, posY: c.posY, cx: (x0 + x1) / 2, cy: h - (top + bot) / 2, hsx: (x1 - x0) / 2, hsy: (bot - top) / 2 };
      },
    });
  }
})();
