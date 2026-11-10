// 插圖：8 種新竹人的「竹筍人」角色，以及會動的神秘禮物盒。全部是 SVG 字串，結果卡和存圖共用。
const ART = (() => {
  const INK = '#1d2b25', BLUSH = '#e7a08f';
  const eyes = {
    dot: '<circle cx="86" cy="112" r="5" fill="#1d2b25"/><circle cx="114" cy="112" r="5" fill="#1d2b25"/><circle cx="87.5" cy="110.5" r="1.6" fill="#fff"/><circle cx="115.5" cy="110.5" r="1.6" fill="#fff"/>',
    sleepy: '<path d="M79 112q7 5 14 0M107 112q7 5 14 0" stroke="#1d2b25" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    happy: '<path d="M79 115q7-9 14 0M107 115q7-9 14 0" stroke="#1d2b25" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    down: '<circle cx="86" cy="116" r="4.2" fill="#1d2b25"/><circle cx="114" cy="116" r="4.2" fill="#1d2b25"/>',
    fierce: '<circle cx="86" cy="113" r="5" fill="#1d2b25"/><circle cx="114" cy="113" r="5" fill="#1d2b25"/><path d="M77 102l15 4M123 102l-15 4" stroke="#1d2b25" stroke-width="3.2" stroke-linecap="round"/>',
    dizzy: '<path d="M86 112m-6 0a6 6 0 1 0 12 0a4 4 0 1 0-8 0a2 2 0 1 0 4 0M114 112m-6 0a6 6 0 1 0 12 0a4 4 0 1 0-8 0a2 2 0 1 0 4 0" stroke="#1d2b25" stroke-width="2.4" fill="none"/>',
  };
  const mouths = {
    smile: '<path d="M92 128q8 8 16 0" stroke="#1d2b25" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    big: '<path d="M90 126q10 14 20 0z" fill="#9c4c48" stroke="#1d2b25" stroke-width="2.6" stroke-linejoin="round"/>',
    flat: '<path d="M94 130h12" stroke="#1d2b25" stroke-width="3.2" stroke-linecap="round"/>',
    o: '<ellipse cx="100" cy="131" rx="4" ry="5" fill="#1d2b25"/>',
    wavy: '<path d="M90 130q2.5-4 5 0t5 0t5 0t5 0" stroke="#1d2b25" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
  };
  // 竹筍身體：米色筍肉＋兩片綠色筍殼＋頂芽
  const body = `
    <ellipse cx="100" cy="180" rx="54" ry="7" fill="#1d2b25" opacity=".12"/>
    <path d="M100 34C120 58 146 104 146 140c0 26-20 36-46 36s-46-10-46-36c0-36 26-82 46-106z" fill="#ecdcaa"/>
    <path d="M54 140c0-22 12-42 28-56-2 26 4 56 18 92-26 0-46-10-46-36z" fill="#7aa364"/>
    <path d="M146 140c0-22-12-42-28-56 2 26-4 56-18 92 26 0 46-10 46-36z" fill="#5f8f50"/>
    <path d="M100 34c-4-12 0-22 8-28 2 12-2 22-8 28z" fill="#7aa364"/>
    <ellipse cx="77" cy="126" rx="7" ry="4.5" fill="${BLUSH}" opacity=".75"/><ellipse cx="123" cy="126" rx="7" ry="4.5" fill="${BLUSH}" opacity=".75"/>`;
  const face = (e, m) => eyes[e] + mouths[m];

  // 每一型的道具。back 畫在身體後面，front 畫在臉上面；faceLast 時臉畫在最上層（例如裹著棉被）。
  const P = {
    HPS: { e: 'dot', m: 'flat', front: `
      <circle cx="86" cy="112" r="10" fill="none" stroke="${INK}" stroke-width="2.6"/><circle cx="114" cy="112" r="10" fill="none" stroke="${INK}" stroke-width="2.6"/><path d="M96 112h8" stroke="${INK}" stroke-width="2.6"/>
      <rect x="112" y="132" width="66" height="44" rx="4" fill="#33424a"/><rect x="117" y="137" width="56" height="34" rx="2" fill="#14251c"/>
      <path d="M122 145h18M122 152h30M128 159h20M122 166h12" stroke="#8fd19e" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M106 178h80l-6-6h-68z" fill="#56656d"/>
      <rect x="22" y="148" width="22" height="26" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.4"/><path d="M44 154q9 0 9 7t-9 7" fill="none" stroke="${INK}" stroke-width="2.4"/>
      <path d="M28 142q3-5 0-10M37 142q3-5 0-10" stroke="#9aa59f" stroke-width="2" fill="none" stroke-linecap="round"/>` },
    HPG: { e: 'dot', m: 'o', front: `
      <rect x="138" y="100" width="40" height="66" rx="7" fill="${INK}"/><rect x="142" y="108" width="32" height="50" rx="3" fill="#fff"/>
      <rect x="146" y="114" width="20" height="6" rx="2" fill="#8a5a1c"/><rect x="146" y="124" width="10" height="6" rx="2" fill="#c9b58e"/><rect x="146" y="134" width="24" height="6" rx="2" fill="#c9b58e"/><rect x="146" y="144" width="6" height="6" rx="2" fill="#c9b58e"/>
      <path d="M20 36h62a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H46l-12 10v-10H20a8 8 0 0 1-8-8V44a8 8 0 0 1 8-8z" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
      <text x="51" y="62" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="17" fill="#8a5a1c">+1 嗎？</text>
      <path d="M128 92q5 8 0 12q-5-4 0-12z" fill="#7fb4d6"/>` },
    HFS: { e: 'sleepy', m: 'flat', faceLast: true, front: `
      <path d="M48 176c-6-40 6-86 52-94 46 8 58 54 52 94z" fill="#7a95a8"/>
      <path d="M62 110c8-14 22-22 38-22s30 8 38 22c-6 26-20 40-38 40s-32-14-38-40z" fill="#ecdcaa"/>
      <path d="M52 176c4-18 20-28 48-28s44 10 48 28z" fill="#64808f"/>
      <path d="M8 74q20-8 34 0M2 96q24-8 40 0M14 118q18-6 28 0" stroke="#9fb5c3" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M170 52q10 4 8 14q-10-2-8-14z" fill="#7aa364" transform="rotate(20 174 60)"/>
      <text x="150" y="44" font-family="sans-serif" font-weight="700" font-size="16" fill="#4c6b7d">z z</text>` },
    HFG: { e: 'down', m: 'o', front: `
      <rect x="72" y="100" width="56" height="26" rx="12" fill="#bfe1ee" fill-opacity=".55" stroke="#5b4e7d" stroke-width="4"/>
      <path d="M128 110h12v-46" stroke="#5b4e7d" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="134" y="54" width="12" height="10" rx="3" fill="#e0a34a"/>
      <rect x="80" y="142" width="40" height="34" rx="6" fill="${INK}"/><rect x="84" y="146" width="32" height="24" rx="2" fill="#dde6da"/>
      <circle cx="118" cy="142" r="13" fill="#b23a2b"/><text x="118" y="147" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff">99+</text>
      <circle cx="40" cy="70" r="6" fill="none" stroke="#9db8c7" stroke-width="2.4"/><circle cx="30" cy="50" r="4" fill="none" stroke="#9db8c7" stroke-width="2.4"/><circle cx="44" cy="34" r="3" fill="none" stroke="#9db8c7" stroke-width="2.4"/>` },
    OPS: { e: 'fierce', m: 'smile', front: `
      <path d="M68 92q32-12 64 0v9q-32-12-64 0z" fill="#b23a2b"/><path d="M132 94l14-8 2 12z" fill="#b23a2b"/>
      <circle cx="156" cy="70" r="24" fill="#fff" stroke="${INK}" stroke-width="3.4"/><rect x="150" y="38" width="12" height="8" rx="2" fill="${INK}"/>
      <path d="M156 70V54M156 70l10 6" stroke="#b23a2b" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M6 120h34M14 136h28M4 152h36" stroke="#d9a39b" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M134 120q6 8 0 12q-6-4 0-12z" fill="#7fb4d6"/>` },
    OPG: { e: 'happy', m: 'big', back: `
      <path d="M160 186V40" stroke="#8a5a1c" stroke-width="5" stroke-linecap="round"/><path d="M162 42l34 14-34 14z" fill="#b23a2b"/>`, front: `
      <path d="M70 76q30-20 60 0z" fill="#2e5b45"/><path d="M128 76q16 0 22 6h-24z" fill="#2e5b45"/>
      <circle cx="152" cy="150" r="9" fill="#ecdcaa" stroke="#5f8f50" stroke-width="2.4"/>
      <path d="M18 54l4 10 10 2-8 6 2 10-8-6-8 6 2-10-8-6 10-2z" fill="#e0a34a"/>` },
    OFS: { e: 'happy', m: 'smile', front: `
      <ellipse cx="100" cy="152" rx="62" ry="17" fill="none" stroke="#e57a4a" stroke-width="13"/>
      <path d="M48 144l-6 12M78 136l-2 14M122 136l2 14M152 144l6 12" stroke="#fff" stroke-width="7"/>
      <path d="M150 128L190 40" stroke="#b08d57" stroke-width="4" stroke-linecap="round"/>
      <circle cx="160" cy="104" r="11" fill="#9a6b45"/><circle cx="169" cy="84" r="11" fill="#a87a50"/><circle cx="178" cy="64" r="11" fill="#9a6b45"/>
      <path d="M18 70q8-10 16 0t16 0" stroke="#7fb4d6" stroke-width="3.4" fill="none" stroke-linecap="round"/>` },
    OFG: { e: 'dizzy', m: 'wavy', back: `
      <ellipse cx="100" cy="70" rx="80" ry="22" fill="none" stroke="#b23a2b" stroke-width="3.4" stroke-dasharray="10 8"/>`, front: `
      <path d="M176 66l8 4-8 6" fill="none" stroke="#b23a2b" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 140h34l-4 38H18z" fill="#e0a34a"/><path d="M22 140q9-16 18 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <path d="M152 136h34l-4 42h-26z" fill="#7a95a8"/><path d="M160 136q9-16 18 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <path d="M40 148h-6M168 148h6" stroke="#fff" stroke-width="3"/>` },
  };

  function mascot(code, { bg = true } = {}) {
    const t = TYPES[code], p = P[code];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${t.name}的插圖">`
      + (bg ? `<circle cx="100" cy="100" r="98" fill="${t.color}" fill-opacity=".14"/>` : '')
      + (p.back || '') + body + (p.faceLast ? (p.front || '') + face(p.e, p.m) : face(p.e, p.m) + (p.front || '')) + '</svg>';
  }

  // 神秘禮物：盒子會晃、蓋子會跳、旁邊有閃光（動畫寫在 style.css 的 .gift）
  const gift = `<svg class="gift" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150" role="img" aria-label="神秘禮物">
    <g class="spark s1"><path d="M22 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#e0a34a"/></g>
    <g class="spark s2"><path d="M138 30l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="#e0a34a"/></g>
    <g class="spark s3"><circle cx="142" cy="92" r="4" fill="#b23a2b"/></g>
    <ellipse cx="80" cy="142" rx="50" ry="5" fill="#1d2b25" opacity=".14"/>
    <g class="box">
      <rect x="36" y="78" width="88" height="62" rx="4" fill="#b23a2b"/>
      <rect x="72" y="78" width="16" height="62" fill="#e0a34a"/>
      <rect x="36" y="78" width="88" height="8" fill="#8f2c20" opacity=".45"/>
      <g class="lid">
        <text class="qm" x="80" y="40" text-anchor="middle" font-family="serif" font-weight="900" font-size="30" fill="#2e5b45">?</text>
        <path d="M80 58c-14-20-34-14-24-2 6 6 24 4 24 2zM80 58c14-20 34-14 24-2-6 6-24 4-24 2z" fill="#e0a34a" stroke="#b88324" stroke-width="2"/>
        <rect x="30" y="58" width="100" height="22" rx="4" fill="#c8483a"/>
        <rect x="72" y="58" width="16" height="22" fill="#f0b85a"/>
      </g>
    </g>
  </svg>`;

  return { mascot, gift };
})();
