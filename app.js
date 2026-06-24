const HAS_NAMES = NODES.some(n => Object.prototype.hasOwnProperty.call(n, 'nombre'));
const byId = new Map(NODES.map(n => [n.id, n]));

const controls = {
  root: document.getElementById('root-filter'),
  branch: document.getElementById('branch-filter'),
  level: document.getElementById('level-filter'),
  cluster: document.getElementById('cluster-filter')
};
const branchSearch = document.getElementById('branch-search');
const btnClear = document.getElementById('btn-clear-filters');
const btnTheme = document.getElementById('btn-theme');

// --- Theme (per DESIGN_SYSTEM.md section 11) ---
const THEME_KEY = 'db-theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  btnTheme.textContent = theme === 'dark' ? '☀' : '☾';
}

applyTheme(getTheme());

btnTheme.addEventListener('click', function () {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  draw();
});

// --- Helpers ---
function option(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function unique(field) {
  return [...new Set(NODES.map(n => n[field]).filter(v => v !== null))].sort((a, b) => a - b);
}

function getMaxLevelForBranch(branchId) {
  const subNodes = NODES.filter(n => String(n.rama_nivel_2) === String(branchId));
  if (!subNodes.length) return null;
  return Math.max(...subNodes.map(n => n.nivel_grafo));
}

// --- Populate Filters ---
function populateLevelFilter() {
  const branch = controls.branch.value;
  const prev = controls.level.value;
  controls.level.replaceChildren();
  let levels = unique('nivel_grafo');
  if (branch !== 'all') {
    const maxLvl = getMaxLevelForBranch(branch);
    if (maxLvl !== null) levels = levels.filter(l => l <= maxLvl);
  }
  controls.level.append(option('all', 'Todos'));
  levels.forEach(v => controls.level.append(option(v, v)));
  if (levels.includes(Number(prev))) controls.level.value = prev;
  else controls.level.value = 'all';
}

function populateBranchFilter(filter) {
  const prev = controls.branch.value;
  controls.branch.replaceChildren();
  controls.branch.append(option('all', 'Todas'));
  let branches = unique('rama_nivel_2');
  if (filter) {
    const q = filter.toLowerCase();
    branches = branches.filter(v => String(v).toLowerCase().includes(q));
  }
  branches.forEach(v => {
    const node = byId.get(v);
    const lbl = node && node.nombre ? v + ' · ' + node.nombre : String(v);
    controls.branch.append(option(v, lbl));
  });
  if (!filter && branches.includes(Number(prev))) controls.branch.value = prev;
}

// --- Initial population ---
controls.root.append(option('all', 'Todas'));
unique('raiz_id').forEach(v => controls.root.append(option(v, v)));
controls.root.value = unique('raiz_id').includes(24) ? '24' : 'all';

populateBranchFilter();
populateLevelFilter();
controls.level.value = '3';

controls.cluster.append(option('all', 'Todos'));
unique('cluster_red').forEach(v => controls.cluster.append(option(v, v)));

// --- Events ---
branchSearch.addEventListener('input', function () {
  populateBranchFilter(branchSearch.value);
});

controls.branch.addEventListener('change', function () {
  populateLevelFilter();
  draw();
});

controls.root.addEventListener('change', draw);
controls.level.addEventListener('change', draw);
controls.cluster.addEventListener('change', draw);

btnClear.addEventListener('click', function () {
  controls.root.value = 'all';
  controls.branch.value = 'all';
  controls.cluster.value = 'all';
  branchSearch.value = '';
  populateBranchFilter();
  populateLevelFilter();
  controls.level.value = '3';
  draw();
});

// --- Word Cloud ---
function renderWordCloud(visible) {
  const counts = new Map();
  let contributors = 0;
  visible.forEach(function (node) {
    const tokens = node.interest_tokens || [];
    if (tokens.length) contributors += 1;
    tokens.forEach(function (token) {
      counts.set(token, (counts.get(token) || 0) + 1);
    });
  });
  const entries = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, 60);
  const cloud = document.getElementById('wordcloud');
  cloud.replaceChildren();
  document.getElementById('wordcloud-summary').textContent =
    contributors.toLocaleString('es-MX') + ' de ' + visible.length.toLocaleString('es-MX') +
    ' nodos visibles aportaron intereses · ' + entries.length + ' términos mostrados';
  if (!entries.length) {
    const empty = document.createElement('span');
    empty.className = 'cloud-empty';
    empty.textContent = 'No hay intereses para los nodos visibles.';
    cloud.appendChild(empty);
    return;
  }
  const values = entries.map(function (e) { return e[1]; });
  const minimum = Math.min.apply(null, values);
  const maximum = Math.max.apply(null, values);
  const palette = ['#7bc11d', '#3eb340', '#a3e635', '#60a5fa', '#a5b4fc', '#34d399', '#fcd34d'];
  entries.forEach(function (entry, index) {
    var word = entry[0], count = entry[1];
    var ratio = maximum === minimum ? 0.55 :
      (Math.sqrt(count) - Math.sqrt(minimum)) / (Math.sqrt(maximum) - Math.sqrt(minimum));
    var span = document.createElement('span');
    span.className = 'cloud-word';
    span.textContent = word;
    span.style.fontSize = (14 + 34 * ratio).toFixed(1) + 'px';
    span.style.color = palette[index % palette.length];
    span.style.transform = 'rotate(' + [-3, 0, 2, 0][index % 4] + 'deg)';
    span.title = word + ': ' + count + ' nodos';
    cloud.appendChild(span);
  });
}

// --- Main Draw ---
function draw(zoomToNode) {
  var isDark = document.documentElement.dataset.theme !== 'light';
  var paperBg = isDark ? '#0d0d0d' : '#ffffff';
  var edgeColor = isDark ? 'rgba(123,193,29,0.3)' : 'rgba(80,140,20,0.25)';
  var textColor = isDark ? '#ffffff' : '#111c06';
  var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  var markerLine = isDark ? 'rgba(123,193,29,0.5)' : 'rgba(80,140,20,0.4)';

  var root = controls.root.value;
  var branch = controls.branch.value;
  var level = controls.level.value;
  var cluster = controls.cluster.value;

  var visible = NODES.filter(function (n) {
    return (root === 'all' || String(n.raiz_id) === root) &&
      (branch === 'all' || String(n.rama_nivel_2) === branch) &&
      (level === 'all' || n.nivel_grafo <= Number(level)) &&
      (cluster === 'all' || String(n.cluster_red) === cluster);
  });

  var ids = new Set(visible.map(function (n) { return n.id; }));
  var edgeX = [], edgeY = [];
  EDGES.forEach(function (e) {
    if (ids.has(e.source) && ids.has(e.target)) {
      edgeX.push(byId.get(e.source).x, byId.get(e.target).x, null);
      edgeY.push(byId.get(e.source).y, byId.get(e.target).y, null);
    }
  });

  var edgeTrace = {
    x: edgeX, y: edgeY,
    mode: 'lines', hoverinfo: 'skip',
    line: { color: edgeColor, width: 0.8 },
    type: 'scattergl'
  };

  var labels = visible.map(function (n) {
    return HAS_NAMES ? n.id + ' · ' + n.nombre : String(n.id);
  });

  var hover = visible.map(function (n) {
    var desc = typeof n.descendientes_por_nivel === 'string'
      ? JSON.parse(n.descendientes_por_nivel) : n.descendientes_por_nivel;
    var descLines = Object.entries(desc)
      .filter(function (kv) { return kv[1] > 0; })
      .map(function (kv) { return '  Nivel ' + kv[0] + ': ' + kv[1]; })
      .join('<br>');
    return '<b>Origen ID: ' + n.id + '</b>' +
      (HAS_NAMES ? '<br>' + n.nombre : '') +
      '<br>Nivel: ' + n.nivel_grafo +
      '<br>Parent: ' + (n.parent_id != null ? n.parent_id : 'raíz') +
      '<br>Directos: ' + n.hijos_directos +
      '<br>Indirectos: ' + n.descendientes_total +
      '<br>Descendientes por nivel:<br>' + (descLines || '  (ninguno)');
  });

  var nodeTrace = {
    x: visible.map(function (n) { return n.x; }),
    y: visible.map(function (n) { return n.y; }),
    text: labels,
    hovertext: hover,
    hoverinfo: 'text',
    mode: 'markers',
    type: 'scattergl',
    marker: {
      size: visible.map(function (n) { return Math.min(22, 6 + Math.log1p(n.descendientes_total) * 2); }),
      color: visible.map(function (n) { return n.nivel_grafo; }),
      colorscale: 'Viridis',
      showscale: true,
      colorbar: {
        title: { text: 'Nivel', font: { color: textColor, family: 'Barlow', size: 12 } },
        tickfont: { color: textColor, family: 'Barlow', size: 11 }
      },
      line: { width: 0.4, color: markerLine }
    },
    customdata: visible.map(function (n) { return n.id; })
  };

  var layout = {
    margin: { l: 10, r: 10, t: 10, b: 10 },
    paper_bgcolor: paperBg,
    plot_bgcolor: paperBg,
    showlegend: false,
    xaxis: { visible: false },
    yaxis: { visible: false },
    dragmode: 'pan',
    hoverlabel: {
      bgcolor: isDark ? '#161616' : '#ffffff',
      bordercolor: '#7bc11d',
      font: { family: 'Barlow', size: 12, color: textColor }
    }
  };


  Plotly.react('graph', [edgeTrace, nodeTrace], layout, {
    responsive: true, scrollZoom: true, displaylogo: false
  });

  var graphEl = document.getElementById('graph');
  if (graphEl.removeAllListeners) graphEl.removeAllListeners('plotly_click');
  graphEl.on('plotly_click', function (data) {
    if (!data || !data.points || !data.points.length) return;
    var pt = data.points[0];
    if (pt.data.customdata) {
      var clickedId = pt.data.customdata[pt.pointIndex];
      var clickedNode = byId.get(clickedId);
      if (clickedNode && clickedNode.nivel_grafo >= 2) {
        var branchId = clickedNode.rama_nivel_2 || clickedId;
        branchSearch.value = '';
        populateBranchFilter();
        controls.branch.value = String(branchId);
        populateLevelFilter();
        draw(clickedId);
      }
    }
  });

  document.getElementById('summary').textContent =
    'Nodos visibles: ' + visible.length.toLocaleString('es-MX') +
    ' · Aristas visibles: ' + (edgeX.length / 3).toLocaleString('es-MX');
  renderWordCloud(visible);
}

// --- Init ---
draw();
