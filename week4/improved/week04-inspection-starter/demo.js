/* 강의 자료 인터랙티브 예제 공용 헬퍼
   - UI: 슬라이더 / 체크박스 / 셀렉트를 선언적으로 만든다
   - GL: 셰이더 컴파일과 프로그램 링크
   - M4: 필요한 만큼의 4x4 행렬 연산 (외부 라이브러리 없이 동작)          */
(function (global) {
  'use strict';

  /* ---------------- UI ---------------- */

  function UI(hostSelector, defs, onChange) {
    const host = document.querySelector(hostSelector);
    const values = {};
    const labels = {};

    defs.forEach(function (d) {
      const box = document.createElement('div');
      box.className = 'ctl' + (d.type === 'check' ? ' check' : '');

      if (d.type === 'check') {
        values[d.id] = !!d.value;
        const lab = document.createElement('label');
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.checked = !!d.value;
        inp.addEventListener('change', function () {
          values[d.id] = inp.checked;
          fire(d.id);
        });
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(d.label));
        box.appendChild(lab);

      } else if (d.type === 'select') {
        values[d.id] = d.value;
        const lab = document.createElement('label');
        lab.textContent = d.label;
        const sel = document.createElement('select');
        d.options.forEach(function (o) {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          if (o.value === d.value) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
          values[d.id] = sel.value;
          fire(d.id);
        });
        box.appendChild(lab);
        box.appendChild(sel);

      } else if (d.type === 'button') {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = d.label;
        b.addEventListener('click', d.onClick);
        box.className = '';
        box.appendChild(b);

      } else {
        values[d.id] = d.value;
        const lab = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = d.label;
        const val = document.createElement('span');
        val.className = 'val';
        labels[d.id] = { el: val, fmt: d.fmt };
        lab.appendChild(name);
        lab.appendChild(val);

        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = d.min;
        inp.max = d.max;
        inp.step = d.step != null ? d.step : 0.01;
        inp.value = d.value;
        inp.addEventListener('input', function () {
          values[d.id] = parseFloat(inp.value);
          paint(d.id);
          fire(d.id);
        });
        box.appendChild(lab);
        box.appendChild(inp);
      }

      if (d.hint) {
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = d.hint;
        box.appendChild(hint);
      }
      if (d.id) box.dataset.id = d.id;
      host.appendChild(box);
      if (labels[d.id]) paint(d.id);
    });

    function paint(id) {
      const l = labels[id];
      if (!l) return;
      l.el.textContent = l.fmt ? l.fmt(values[id]) : String(values[id]);
    }
    function fire(id) { if (onChange) onChange(values, id); }

    values.$set = function (id, v) {
      values[id] = v;
      const inp = host.querySelector('input[type=range]');
      paint(id);
    };
    return values;
  }

  /* ---------------- 읽기 전용 표시 ---------------- */

  function readout(text) {
    let el = document.querySelector('.readout');
    if (!el) {
      el = document.createElement('div');
      el.className = 'readout';
      document.querySelector('.stage').appendChild(el);
    }
    el.textContent = text;
  }

  function fail(msg) {
    const stage = document.querySelector('.stage');
    if (stage) stage.innerHTML = '<div class="err">' + msg + '</div>';
  }

  /* ---------------- 캔버스 ---------------- */

  // 표시 크기에 맞춰 실제 픽셀 수를 맞춘다. scale 로 해상도를 낮출 수 있다.
  function fit(canvas, scale) {
    scale = scale || 1;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width * dpr * scale));
    const h = Math.max(1, Math.floor(r.height * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      return true;
    }
    return false;
  }

  function loop(fn) {
    let last = performance.now(), acc = 0, n = 0, ms = 0;
    function step(now) {
      const dt = now - last;
      last = now;
      acc += dt; n++;
      if (n >= 30) { ms = acc / n; acc = 0; n = 0; }
      fn(now * 0.001, dt * 0.001, ms);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- WebGL ---------------- */

  function context(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) fail('이 브라우저에서는 WebGL2를 사용할 수 없습니다.\n크롬 또는 엣지 최신 버전에서 열어 주세요.');
    return gl;
  }

  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      fail('셰이더 컴파일 오류\n' + log);
      throw new Error(log);
    }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      fail('프로그램 링크 오류\n' + log);
      throw new Error(log);
    }
    return p;
  }

  // 이름 -> uniform location 을 미리 찾아 둔다
  function uniforms(gl, prog, names) {
    const u = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    return u;
  }

  /* ---------------- 메시 ---------------- */

  // 회전체: profile 은 [[반지름, 높이], ...]
  function revolution(profile, seg) {
    seg = seg || 32;
    const pos = [], nrm = [], uv = [], idx = [];
    const rows = profile.length;

    for (let i = 0; i < rows; i++) {
      const r = profile[i][0], y = profile[i][1];
      const pp = profile[Math.max(i - 1, 0)];
      const pn = profile[Math.min(i + 1, rows - 1)];
      // 프로파일의 접선 (dr, dy) 을 +90도 돌리면 바깥을 향하는 법선이 된다.
      // 프로파일이 위(+y)에서 아래(-y)로 내려가므로 (-dy, dr) 이 바깥 방향이다.
      const dr = pn[0] - pp[0], dy = pn[1] - pp[1];
      const nl = Math.hypot(dr, dy) || 1;
      const nr = -dy / nl, ny = dr / nl;

      for (let j = 0; j <= seg; j++) {
        const t = (j / seg) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        pos.push(r * c, y, r * s);
        nrm.push(nr * c, ny, nr * s);
        uv.push(j / seg, 1 - i / (rows - 1));
      }
    }
    const stride = seg + 1;
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * stride + j, b = a + stride;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx),
    };
  }

  const profiles = {
    sphere: function (R, steps) {
      const p = [];
      for (let i = 0; i <= steps; i++) {
        const phi = Math.PI * (i / steps);
        p.push([R * Math.sin(phi), R * Math.cos(phi)]);
      }
      return p;
    },
    cylinder: function (R, H) {
      return [[0, H / 2], [R, H / 2], [R, -H / 2], [0, -H / 2]];
    },
    cone: function (R, H) {
      return [[0, H / 2], [R, -H / 2], [0, -H / 2]];
    },
    // 단면을 도는 방향이 중요하다. revolution 은 프로파일이 위(+y)에서 아래(-y)로
    // 내려간다고 보고 법선을 정하므로, 여기서도 바깥쪽 점에서 아래로 내려가야 한다.
    // sin 부호를 반대로 두지 않으면 법선이 전부 안쪽을 향한다.
    torus: function (R, r, steps) {
      const p = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        p.push([R + r * Math.cos(t), -r * Math.sin(t)]);
      }
      return p;
    },
    vase: function () {
      return [[0, 1], [0.30, 0.78], [0.62, 0.34], [0.40, -0.14],
              [0.52, -0.56], [0.66, -0.86], [0, -1]];
    },
  };

  // 위치/법선/UV/인덱스를 VAO 로 묶는다 (location 0,1,2)
  function upload(gl, m) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    [['pos', 3, 0], ['nrm', 3, 1], ['uv', 2, 2], ['col', 3, 3]].forEach(function (a) {
      if (!m[a[0]]) return;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, m[a[0]], gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a[2]);
      gl.vertexAttribPointer(a[2], a[1], gl.FLOAT, false, 0, 0);
    });
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, count: m.idx.length, verts: m.pos.length / 3 };
  }

  /* ---------------- 4x4 행렬 (열 우선) ---------------- */

  const M4 = {
    create: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    identity: function (o) {
      o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o;
    },
    copy: function (o, a) { o.set(a); return o; },
    multiply: function (o, a, b) {
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let row = 0; row < 4; row++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
          r[c * 4 + row] = s;
        }
      }
      o.set(r); return o;
    },
    translate: function (o, a, v) {
      const t = M4.identity(M4.create());
      t[12] = v[0]; t[13] = v[1]; t[14] = v[2];
      return M4.multiply(o, a, t);
    },
    scale: function (o, a, v) {
      const t = M4.identity(M4.create());
      t[0] = v[0]; t[5] = v[1]; t[10] = v[2];
      return M4.multiply(o, a, t);
    },
    rotateX: function (o, a, r) {
      const t = M4.identity(M4.create()), c = Math.cos(r), s = Math.sin(r);
      t[5] = c; t[6] = s; t[9] = -s; t[10] = c;
      return M4.multiply(o, a, t);
    },
    rotateY: function (o, a, r) {
      const t = M4.identity(M4.create()), c = Math.cos(r), s = Math.sin(r);
      t[0] = c; t[2] = -s; t[8] = s; t[10] = c;
      return M4.multiply(o, a, t);
    },
    rotateZ: function (o, a, r) {
      const t = M4.identity(M4.create()), c = Math.cos(r), s = Math.sin(r);
      t[0] = c; t[1] = s; t[4] = -s; t[5] = c;
      return M4.multiply(o, a, t);
    },
    perspective: function (o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o.set([f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
      return o;
    },
    ortho: function (o, l, r, b, t, n, f) {
      o.set([2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0,
             -(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1]);
      return o;
    },
    lookAt: function (o, eye, center, up) {
      let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
      let zl = Math.hypot(zx, zy, zz) || 1; zx/=zl; zy/=zl; zz/=zl;
      let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
      let xl = Math.hypot(xx, xy, xz) || 1; xx/=xl; xy/=xl; xz/=xl;
      const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
      o.set([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
             -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
             -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
             -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1]);
      return o;
    },
    // 법선 행렬 = transpose(inverse(model)) 의 좌상단 3x3
    normalFrom: function (m) {
      const a00=m[0],a01=m[1],a02=m[2], a10=m[4],a11=m[5],a12=m[6], a20=m[8],a21=m[9],a22=m[10];
      const b01= a22*a11 - a12*a21, b11=-a22*a10 + a12*a20, b21= a21*a10 - a11*a20;
      let det = a00*b01 + a01*b11 + a02*b21;
      if (!det) return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
      det = 1 / det;
      return new Float32Array([
        b01*det, (-a22*a01 + a02*a21)*det, ( a12*a01 - a02*a11)*det,
        b11*det, ( a22*a00 - a02*a20)*det, (-a12*a00 + a02*a10)*det,
        b21*det, (-a21*a00 + a01*a20)*det, ( a11*a00 - a01*a10)*det,
      ]);
    },
  };

  /* ---------------- 궤도 카메라 (마우스 드래그 / 휠) ---------------- */

  function orbit(canvas, opt) {
    opt = opt || {};
    const st = {
      yaw: opt.yaw != null ? opt.yaw : 0.6,
      pitch: opt.pitch != null ? opt.pitch : 0.5,
      dist: opt.dist != null ? opt.dist : 6,
      min: opt.min || 1.5, max: opt.max || 60,
      up: opt.up === 'z' ? 'z' : 'y',      // 장면의 위쪽 축. lookAt 의 up 과 반드시 맞춰야 한다
    };
    let drag = false, px = 0, py = 0;

    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (e) {
      drag = true; px = e.clientX; py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    ['pointerup', 'pointercancel'].forEach(ev =>
      canvas.addEventListener(ev, function () { drag = false; canvas.style.cursor = 'grab'; }));
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      // 화면 높이만큼 끌면 한 바퀴 — 캔버스 크기와 무관하게 같은 감각이 되도록
      const h = canvas.getBoundingClientRect().height || 600;
      const k = Math.PI * 2 / h;
      // 끄는 방향으로 장면이 따라오게 한다 (오른쪽으로 끌면 장면이 오른쪽으로 돈다)
      st.yaw   -= (e.clientX - px) * k;
      st.pitch += (e.clientY - py) * k;
      const lim = Math.PI / 2 - 0.02;      // up 벡터와 나란해지지 않게 제한
      st.pitch = Math.max(-lim, Math.min(lim, st.pitch));
      px = e.clientX; py = e.clientY;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      st.dist *= Math.exp(e.deltaY * 0.001);
      st.dist = Math.max(st.min, Math.min(st.max, st.dist));
    }, { passive: false });

    st.eye = function (target) {
      target = target || [0, 0, 0];
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      if (st.up === 'z') {                 // Z 가 위 — 고도는 z 로 간다
        return [
          target[0] + st.dist * cp * Math.cos(st.yaw),
          target[1] + st.dist * cp * Math.sin(st.yaw),
          target[2] + st.dist * sp,
        ];
      }
      return [                             // Y 가 위 (기본)
        target[0] + st.dist * cp * Math.sin(st.yaw),
        target[1] + st.dist * sp,
        target[2] + st.dist * cp * Math.cos(st.yaw),
      ];
    };
    return st;
  }

  // ?a=1,1,0&b=0,1,1 형태의 벡터 파라미터를 읽는다. 없거나 형식이 틀리면 null
  function vecParam(name, n) {
    const raw = new URLSearchParams(location.search).get(name);
    if (!raw) return null;
    const v = raw.split(',').map(Number);
    return (v.length === n && v.every(isFinite)) ? v : null;
  }

  // 성분 직접 입력 패널. rows = [{ label:'a', keys:['ax','ay'], value:[1,0] }, ...]
  // 반환값 v 는 키별 현재 숫자, show(on) 으로 패널을 보이고 감춘다.
  function components(hostSelector, rows, opts) {
    opts = opts || {};
    const host = document.querySelector(hostSelector);
    const box = document.createElement('div');
    box.className = 'comp';
    const v = {};

    rows.forEach(function (row) {
      const line = document.createElement('div');
      line.className = 'comp-row';
      const tag = document.createElement('span');
      tag.textContent = row.label;
      line.appendChild(tag);

      row.keys.forEach(function (key, i) {
        v[key] = row.value[i];
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'decimal';
        inp.value = row.value[i];
        inp.setAttribute('aria-label', row.label + ' ' + 'xyzw'[i]);
        inp.addEventListener('input', function () {
          const num = parseFloat(inp.value);
          const ok = isFinite(num);
          inp.classList.toggle('bad', !ok);
          if (ok) v[key] = num;
        });
        line.appendChild(inp);
      });
      box.appendChild(line);
    });

    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'comp-hint';
      h.textContent = opts.hint;
      box.appendChild(h);
    }

    // after 가 가리키는 컨트롤 바로 뒤에 끼워 넣는다 (없으면 맨 끝)
    const anchor = opts.after ? document.querySelector(opts.after) : null;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else host.appendChild(box);

    // 성분 입력을 쓰는 동안에는 무력해진 컨트롤을 감춘다
    const hides = (opts.hides ? Array.prototype.slice.call(document.querySelectorAll(opts.hides)) : [])
      .map(function (el) { return el.closest('.ctl') || el; });

    return {
      v: v,
      show: function (on) {
        box.classList.toggle('on', !!on);
        hides.forEach(function (el) { el.hidden = !!on; });
      }
    };
  }

  // ── 테마 ─────────────────────────────────────────────────────────
  // 강의 페이지 안에서는 부모의 밝은/어두운 설정을 따르고,
  // 단독으로 열면 OS 설정을 따른다. ?theme=light|dark 로 고정할 수도 있다.
  const colorCache = new Map();

  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name === 'dark' ? 'dark' : 'light');
    colorCache.clear();                       // 토큰 값이 바뀌었으니 캐시를 버린다
  }

  (function initTheme() {
    const q = new URLSearchParams(location.search).get('theme');
    const mq = matchMedia('(prefers-color-scheme: dark)');
    let pinned = (q === 'light' || q === 'dark');
    applyTheme(pinned ? q : (mq.matches ? 'dark' : 'light'));

    mq.addEventListener('change', function (e) {
      if (!pinned) applyTheme(e.matches ? 'dark' : 'light');
    });
    addEventListener('message', function (e) {
      const d = e.data;
      if (d && (d.cgTheme === 'light' || d.cgTheme === 'dark')) { pinned = true; applyTheme(d.cgTheme); }
    });
    if (parent !== window) {
      try { parent.postMessage({ cgThemeAsk: true }, '*'); } catch (err) { /* 다른 출처면 무시 */ }
    }
  })();

  // CSS 토큰 이름을 WebGL 용 [r, g, b] (0~1) 로 바꾼다. D.rgb('--d-grid')
  function rgb(token) {
    if (colorCache.has(token)) return colorCache.get(token);
    const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    let out = [1, 0, 1];                      // 못 읽으면 눈에 띄는 자홍색
    let m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(raw))) {
      out = [0, 1, 2].map(function (i) { return parseInt(m[1][i] + m[1][i], 16) / 255; });
    } else if ((m = /^#([0-9a-f]{6})$/i.exec(raw))) {
      out = [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16) / 255; });
    } else if ((m = /^rgba?\(([^)]+)\)$/i.exec(raw))) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      out = [p[0] / 255, p[1] / 255, p[2] / 255];
    }
    colorCache.set(token, out);
    return out;
  }

  // 지우기 색을 테마 배경색으로 맞춘다. 실제 gl.clear 는 호출한 쪽에서 한다
  function clearColor(gl, token) {
    const c = rgb(token || '--d-canvas');
    gl.clearColor(c[0], c[1], c[2], 1);
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // 셰이더를 컴파일하되 실패해도 던지지 않는다. 편집기가 오류를 화면에 보여 줄 수 있게.
  // 반환 { ok, program, stage:'vertex'|'fragment'|'link', log, line }
  function tryProgram(gl, vsSrc, fsSrc) {
    function compile(type, src, stage) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return { ok: true, shader: s };
      const log = gl.getShaderInfoLog(s) || '';
      gl.deleteShader(s);
      const m = /^\s*(?:ERROR:\s*)?\d+:(\d+)/m.exec(log);
      return { ok: false, stage: stage, log: log.trim(), line: m ? parseInt(m[1], 10) : null };
    }
    const vs = compile(gl.VERTEX_SHADER, vsSrc, 'vertex');
    if (!vs.ok) return vs;
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc, 'fragment');
    if (!fs.ok) { gl.deleteShader(vs.shader); return fs; }

    const p = gl.createProgram();
    gl.attachShader(p, vs.shader);
    gl.attachShader(p, fs.shader);
    gl.linkProgram(p);
    gl.deleteShader(vs.shader);
    gl.deleteShader(fs.shader);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = (gl.getProgramInfoLog(p) || '').trim();
      gl.deleteProgram(p);
      return { ok: false, stage: 'link', log: log, line: null };
    }
    return { ok: true, program: p };
  }

  // 정육면체 — 면마다 법선이 달라야 하므로 꼭짓점을 면별로 따로 둔다 (24개)
  function cube(s) {
    s = (s == null ? 1 : s) / 2;
    const F = [
      [[ 0, 0, 1], [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s]],
      [[ 0, 0,-1], [ s,-s,-s], [-s,-s,-s], [-s, s,-s], [ s, s,-s]],
      [[ 1, 0, 0], [ s,-s, s], [ s,-s,-s], [ s, s,-s], [ s, s, s]],
      [[-1, 0, 0], [-s,-s,-s], [-s,-s, s], [-s, s, s], [-s, s,-s]],
      [[ 0, 1, 0], [-s, s, s], [ s, s, s], [ s, s,-s], [-s, s,-s]],
      [[ 0,-1, 0], [-s,-s,-s], [ s,-s,-s], [ s,-s, s], [-s,-s, s]],
    ];
    const pos = [], nrm = [], uv = [], idx = [];
    F.forEach(function (f, i) {
      const n = f[0];
      for (let k = 1; k <= 4; k++) { pos.push.apply(pos, f[k]); nrm.push.apply(nrm, n); }
      uv.push(0,0, 1,0, 1,1, 0,1);
      const b = i * 4;
      idx.push(b, b+1, b+2, b, b+2, b+3);
    });
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm),
             uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  /* ── 유타 주전자 (Utah Teapot) ─────────────────────────────────────────
     1975년 Martin Newell 이 만든 그래픽스의 표준 시험 모델.
     삼각형이 아니라 4×4 제어점을 가진 베지어 패치 32장으로 정의되어 있어,
     분할 수를 바꾸면 원하는 만큼 촘촘하게 삼각형으로 펼 수 있다.
     아래 제어점 자료는 널리 공개된 Newell 원본 데이터이다. */
  const TEAPOT_PATCH = new Uint16Array([
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,
    3,16,17,18,7,19,20,21,11,22,23,24,15,25,26,27,
    18,28,29,30,21,31,32,33,24,34,35,36,27,37,38,39,
    30,40,41,0,33,42,43,4,36,44,45,8,39,46,47,12,
    12,13,14,15,48,49,50,51,52,53,54,55,56,57,58,59,
    15,25,26,27,51,60,61,62,55,63,64,65,59,66,67,68,
    27,37,38,39,62,69,70,71,65,72,73,74,68,75,76,77,
    39,46,47,12,71,78,79,48,74,80,81,52,77,82,83,56,
    56,57,58,59,84,85,86,87,88,89,90,91,92,93,94,95,
    59,66,67,68,87,96,97,98,91,99,100,101,95,102,103,104,
    68,75,76,77,98,105,106,107,101,108,109,110,104,111,112,113,
    77,82,83,56,107,114,115,84,110,116,117,88,113,118,119,92,
    120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,
    123,136,137,120,127,138,139,124,131,140,141,128,135,142,143,132,
    132,133,134,135,144,145,146,147,148,149,150,151,68,152,153,154,
    135,142,143,132,147,155,156,144,151,157,158,148,154,159,160,68,
    161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,
    164,177,178,161,168,179,180,165,172,181,182,169,176,183,184,173,
    173,174,175,176,185,186,187,188,189,190,191,192,193,194,195,196,
    176,183,184,173,188,197,198,185,192,199,200,189,196,201,202,193,
    203,203,203,203,204,205,206,207,208,208,208,208,209,210,211,212,
    203,203,203,203,207,213,214,215,208,208,208,208,212,216,217,218,
    203,203,203,203,215,219,220,221,208,208,208,208,218,222,223,224,
    203,203,203,203,221,225,226,204,208,208,208,208,224,227,228,209,
    209,210,211,212,229,230,231,232,233,234,235,236,237,238,239,240,
    212,216,217,218,232,241,242,243,236,244,245,246,240,247,248,249,
    218,222,223,224,243,250,251,252,246,253,254,255,249,256,257,258,
    224,227,228,209,252,259,260,229,255,261,262,233,258,263,264,237,
    265,265,265,265,266,267,268,269,270,271,272,273,92,119,118,113,
    265,265,265,265,269,274,275,276,273,277,278,279,113,112,111,104,
    265,265,265,265,276,280,281,282,279,283,284,285,104,103,102,95,
    265,265,265,265,282,286,287,266,285,288,289,270,95,94,93,92,
  ]);
  const TEAPOT_CP = new Float32Array([
    1.4,0,2.4,1.4,-0.784,2.4,0.784,-1.4,2.4,
    0,-1.4,2.4,1.3375,0,2.53125,1.3375,-0.749,2.53125,
    0.749,-1.3375,2.53125,0,-1.3375,2.53125,1.4375,0,2.53125,
    1.4375,-0.805,2.53125,0.805,-1.4375,2.53125,0,-1.4375,2.53125,
    1.5,0,2.4,1.5,-0.84,2.4,0.84,-1.5,2.4,
    0,-1.5,2.4,-0.784,-1.4,2.4,-1.4,-0.784,2.4,
    -1.4,0,2.4,-0.749,-1.3375,2.53125,-1.3375,-0.749,2.53125,
    -1.3375,0,2.53125,-0.805,-1.4375,2.53125,-1.4375,-0.805,2.53125,
    -1.4375,0,2.53125,-0.84,-1.5,2.4,-1.5,-0.84,2.4,
    -1.5,0,2.4,-1.4,0.784,2.4,-0.784,1.4,2.4,
    0,1.4,2.4,-1.3375,0.749,2.53125,-0.749,1.3375,2.53125,
    0,1.3375,2.53125,-1.4375,0.805,2.53125,-0.805,1.4375,2.53125,
    0,1.4375,2.53125,-1.5,0.84,2.4,-0.84,1.5,2.4,
    0,1.5,2.4,0.784,1.4,2.4,1.4,0.784,2.4,
    0.749,1.3375,2.53125,1.3375,0.749,2.53125,0.805,1.4375,2.53125,
    1.4375,0.805,2.53125,0.84,1.5,2.4,1.5,0.84,2.4,
    1.75,0,1.875,1.75,-0.98,1.875,0.98,-1.75,1.875,
    0,-1.75,1.875,2,0,1.35,2,-1.12,1.35,
    1.12,-2,1.35,0,-2,1.35,2,0,0.9,
    2,-1.12,0.9,1.12,-2,0.9,0,-2,0.9,
    -0.98,-1.75,1.875,-1.75,-0.98,1.875,-1.75,0,1.875,
    -1.12,-2,1.35,-2,-1.12,1.35,-2,0,1.35,
    -1.12,-2,0.9,-2,-1.12,0.9,-2,0,0.9,
    -1.75,0.98,1.875,-0.98,1.75,1.875,0,1.75,1.875,
    -2,1.12,1.35,-1.12,2,1.35,0,2,1.35,
    -2,1.12,0.9,-1.12,2,0.9,0,2,0.9,
    0.98,1.75,1.875,1.75,0.98,1.875,1.12,2,1.35,
    2,1.12,1.35,1.12,2,0.9,2,1.12,0.9,
    2,0,0.45,2,-1.12,0.45,1.12,-2,0.45,
    0,-2,0.45,1.5,0,0.225,1.5,-0.84,0.225,
    0.84,-1.5,0.225,0,-1.5,0.225,1.5,0,0.15,
    1.5,-0.84,0.15,0.84,-1.5,0.15,0,-1.5,0.15,
    -1.12,-2,0.45,-2,-1.12,0.45,-2,0,0.45,
    -0.84,-1.5,0.225,-1.5,-0.84,0.225,-1.5,0,0.225,
    -0.84,-1.5,0.15,-1.5,-0.84,0.15,-1.5,0,0.15,
    -2,1.12,0.45,-1.12,2,0.45,0,2,0.45,
    -1.5,0.84,0.225,-0.84,1.5,0.225,0,1.5,0.225,
    -1.5,0.84,0.15,-0.84,1.5,0.15,0,1.5,0.15,
    1.12,2,0.45,2,1.12,0.45,0.84,1.5,0.225,
    1.5,0.84,0.225,0.84,1.5,0.15,1.5,0.84,0.15,
    -1.6,0,2.025,-1.6,-0.3,2.025,-1.5,-0.3,2.25,
    -1.5,0,2.25,-2.3,0,2.025,-2.3,-0.3,2.025,
    -2.5,-0.3,2.25,-2.5,0,2.25,-2.7,0,2.025,
    -2.7,-0.3,2.025,-3,-0.3,2.25,-3,0,2.25,
    -2.7,0,1.8,-2.7,-0.3,1.8,-3,-0.3,1.8,
    -3,0,1.8,-1.5,0.3,2.25,-1.6,0.3,2.025,
    -2.5,0.3,2.25,-2.3,0.3,2.025,-3,0.3,2.25,
    -2.7,0.3,2.025,-3,0.3,1.8,-2.7,0.3,1.8,
    -2.7,0,1.575,-2.7,-0.3,1.575,-3,-0.3,1.35,
    -3,0,1.35,-2.5,0,1.125,-2.5,-0.3,1.125,
    -2.65,-0.3,0.9375,-2.65,0,0.9375,-2,-0.3,0.9,
    -1.9,-0.3,0.6,-1.9,0,0.6,-3,0.3,1.35,
    -2.7,0.3,1.575,-2.65,0.3,0.9375,-2.5,0.3,1.125,
    -1.9,0.3,0.6,-2,0.3,0.9,1.7,0,1.425,
    1.7,-0.66,1.425,1.7,-0.66,0.6,1.7,0,0.6,
    2.6,0,1.425,2.6,-0.66,1.425,3.1,-0.66,0.825,
    3.1,0,0.825,2.3,0,2.1,2.3,-0.25,2.1,
    2.4,-0.25,2.025,2.4,0,2.025,2.7,0,2.4,
    2.7,-0.25,2.4,3.3,-0.25,2.4,3.3,0,2.4,
    1.7,0.66,0.6,1.7,0.66,1.425,3.1,0.66,0.825,
    2.6,0.66,1.425,2.4,0.25,2.025,2.3,0.25,2.1,
    3.3,0.25,2.4,2.7,0.25,2.4,2.8,0,2.475,
    2.8,-0.25,2.475,3.525,-0.25,2.49375,3.525,0,2.49375,
    2.9,0,2.475,2.9,-0.15,2.475,3.45,-0.15,2.5125,
    3.45,0,2.5125,2.8,0,2.4,2.8,-0.15,2.4,
    3.2,-0.15,2.4,3.2,0,2.4,3.525,0.25,2.49375,
    2.8,0.25,2.475,3.45,0.15,2.5125,2.9,0.15,2.475,
    3.2,0.15,2.4,2.8,0.15,2.4,0,0,3.15,
    0.8,0,3.15,0.8,-0.45,3.15,0.45,-0.8,3.15,
    0,-0.8,3.15,0,0,2.85,0.2,0,2.7,
    0.2,-0.112,2.7,0.112,-0.2,2.7,0,-0.2,2.7,
    -0.45,-0.8,3.15,-0.8,-0.45,3.15,-0.8,0,3.15,
    -0.112,-0.2,2.7,-0.2,-0.112,2.7,-0.2,0,2.7,
    -0.8,0.45,3.15,-0.45,0.8,3.15,0,0.8,3.15,
    -0.2,0.112,2.7,-0.112,0.2,2.7,0,0.2,2.7,
    0.45,0.8,3.15,0.8,0.45,3.15,0.112,0.2,2.7,
    0.2,0.112,2.7,0.4,0,2.55,0.4,-0.224,2.55,
    0.224,-0.4,2.55,0,-0.4,2.55,1.3,0,2.55,
    1.3,-0.728,2.55,0.728,-1.3,2.55,0,-1.3,2.55,
    1.3,0,2.4,1.3,-0.728,2.4,0.728,-1.3,2.4,
    0,-1.3,2.4,-0.224,-0.4,2.55,-0.4,-0.224,2.55,
    -0.4,0,2.55,-0.728,-1.3,2.55,-1.3,-0.728,2.55,
    -1.3,0,2.55,-0.728,-1.3,2.4,-1.3,-0.728,2.4,
    -1.3,0,2.4,-0.4,0.224,2.55,-0.224,0.4,2.55,
    0,0.4,2.55,-1.3,0.728,2.55,-0.728,1.3,2.55,
    0,1.3,2.55,-1.3,0.728,2.4,-0.728,1.3,2.4,
    0,1.3,2.4,0.224,0.4,2.55,0.4,0.224,2.55,
    0.728,1.3,2.55,1.3,0.728,2.55,0.728,1.3,2.4,
    1.3,0.728,2.4,0,0,0,1.425,0,0,
    1.425,0.798,0,0.798,1.425,0,0,1.425,0,
    1.5,0,0.075,1.5,0.84,0.075,0.84,1.5,0.075,
    0,1.5,0.075,-0.798,1.425,0,-1.425,0.798,0,
    -1.425,0,0,-0.84,1.5,0.075,-1.5,0.84,0.075,
    -1.5,0,0.075,-1.425,-0.798,0,-0.798,-1.425,0,
    0,-1.425,0,-1.5,-0.84,0.075,-0.84,-1.5,0.075,
    0,-1.5,0.075,0.798,-1.425,0,1.425,-0.798,0,
    0.84,-1.5,0.075,1.5,-0.84,0.075,
  ]);

  // 3차 베지어 기저와 그 도함수
  function bez(t) {
    const u = 1 - t;
    return [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
  }
  function dbez(t) {
    const u = 1 - t;
    return [-3*u*u, 3*u*u - 6*u*t, 6*u*t - 3*t*t, 3*t*t];
  }

  // segments = 패치 하나를 몇 칸으로 나눌 것인가 (2~14 권장)
  function teapot(segments) {
    const seg = Math.max(1, Math.min(16, segments || 8));
    const row = seg + 1;
    const pos = [], nrm = [], uv = [], idx = [];

    for (let s = 0; s < 32; s++) {
      const base = s * 16;
      for (let i = 0; i <= seg; i++) {
        const bu = bez(i/seg), du = dbez(i/seg);
        for (let j = 0; j <= seg; j++) {
          const bv = bez(j/seg), dv = dbez(j/seg);
          const p = [0,0,0], ts = [0,0,0], tt = [0,0,0];
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              const cp = TEAPOT_PATCH[base + r*4 + c] * 3;
              const wp = bu[r]*bv[c], ws = du[r]*bv[c], wt = bu[r]*dv[c];
              for (let k = 0; k < 3; k++) {
                const v = TEAPOT_CP[cp + k];
                p[k]  += wp * v;
                ts[k] += ws * v;
                tt[k] += wt * v;
              }
            }
          }
          // 법선 = 두 접선의 외적. 제어점이 한 점으로 모이는 꼭지에서는 0 이 되므로
          // 그럴 때는 위/아래를 향하게 둔다 (뚜껑 꼭대기와 바닥 중심).
          let n = [tt[1]*ts[2]-tt[2]*ts[1], tt[2]*ts[0]-tt[0]*ts[2], tt[0]*ts[1]-tt[1]*ts[0]];
          let nl = Math.hypot(n[0], n[1], n[2]);
          if (nl < 1e-6) { n = [0, 0, p[2] > 1.5 ? 1 : -1]; nl = 1; }
          n = [n[0]/nl, n[1]/nl, n[2]/nl];

          // 원본은 z-up 이다. 이 수업 기준인 y-up 으로 눕히고 (x, z, -y),
          // 가운데를 원점으로 옮긴 뒤 -1~1 안에 들어오게 줄인다.
          const S_ = 0.2605, CX = 0.2625, CZ = 1.575;
          pos.push((p[0]-CX)*S_, (p[2]-CZ)*S_, -p[1]*S_);
          nrm.push(n[0], n[2], -n[1]);
          uv.push(j/seg, i/seg);
        }
      }
      const o = s * row * row;
      for (let i = 0; i < seg; i++) {
        for (let j = 0; j < seg; j++) {
          const a = o + i*row + j;
          idx.push(a, a+1, a+row, a+1, a+row+1, a+row);
        }
      }
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm),
             uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  // 위치를 그대로 색으로 쓰면 어느 면이 어디인지 눈으로 구분된다
  function colorByPosition(mesh, lo, hi) {
    lo = lo == null ? 0.25 : lo; hi = hi == null ? 0.95 : hi;
    const n = mesh.pos.length / 3, c = new Float32Array(n * 3);
    let mx = 1e-9;
    for (let i = 0; i < mesh.pos.length; i++) mx = Math.max(mx, Math.abs(mesh.pos[i]));
    for (let i = 0; i < n * 3; i++) c[i] = lo + (hi - lo) * (mesh.pos[i] / mx * 0.5 + 0.5);
    mesh.col = c;
    return mesh;
  }

  global.D = {
    UI: UI, readout: readout, fail: fail, fit: fit, loop: loop,
    context: context, program: program, uniforms: uniforms,
    revolution: revolution, profiles: profiles, upload: upload,
    tryProgram: tryProgram, cube: cube, colorByPosition: colorByPosition,
    teapot: teapot,
    M4: M4, orbit: orbit,
    components: components, vecParam: vecParam,
    rgb: rgb, clearColor: clearColor, isDark: isDark,
  };
})(window);
