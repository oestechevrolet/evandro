(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var CHAVE_LS = "cartao-admin-github";
  var veiculosLidos = null, estoque = null, overrides = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function status(id, tipo, html) { var el = $(id); el.className = "status " + tipo; el.innerHTML = html; }

  /* ---------- conexão GitHub ---------- */
  function cfg() { try { return JSON.parse(localStorage.getItem(CHAVE_LS)) || {}; } catch (e) { return {}; } }
  function carregarCfg() {
    var c = cfg();
    // sugere usuário/repositório quando o site já está no GitHub Pages
    var m = location.hostname.match(/^([^.]+)\.github\.io$/);
    $("#gOwner").value = c.owner || (m ? m[1] : "");
    var partes = location.pathname.split("/").filter(Boolean);
    var repoSugerido = m ? (partes.length > 1 ? partes[0] : m[1] + ".github.io") : "";
    $("#gRepo").value = c.repo || repoSugerido;
    $("#gBranch").value = c.branch || "main";
    $("#gToken").value = c.token || "";
    if (c.token) status("#gStatus", "ok", "Conexão salva neste aparelho: <b>" + esc(c.owner + "/" + c.repo) + "</b>");
  }
  function api(caminho, opcoes) {
    var c = cfg();
    opcoes = opcoes || {};
    opcoes.headers = Object.assign({ "Authorization": "Bearer " + c.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, opcoes.headers || {});
    return fetch("https://api.github.com/repos/" + c.owner + "/" + c.repo + caminho, opcoes);
  }
  $("#gSalvar").onclick = function () {
    var c = { owner: $("#gOwner").value.trim(), repo: $("#gRepo").value.trim(), branch: $("#gBranch").value.trim() || "main", token: $("#gToken").value.trim() };
    if (!c.owner || !c.repo || !c.token) return status("#gStatus", "erro", "Preencha usuário, repositório e token.");
    localStorage.setItem(CHAVE_LS, JSON.stringify(c));
    status("#gStatus", "info", "Testando…");
    api("").then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
      if (!x.r.ok) throw new Error(x.j.message || x.r.status);
      if (x.j.permissions && !x.j.permissions.push) throw new Error("o token não tem permissão de escrita (Contents: Read and write)");
      status("#gStatus", "ok", "Conectado a <b>" + esc(x.j.full_name) + "</b>. Pode enviar a planilha.");
    }).catch(function (e) { status("#gStatus", "erro", "Não consegui acessar o repositório: " + esc(e.message) + ". Confira o nome e o token."); });
  };
  $("#gEsquecer").onclick = function () { localStorage.removeItem(CHAVE_LS); $("#gToken").value = ""; status("#gStatus", "info", "Dados removidos deste aparelho."); };

  /* ---------- imagens personalizadas já salvas ---------- */
  fetch("data/imagens.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { overrides = j || {}; }).catch(function () {});

  /* ---------- leitura do arquivo ---------- */
  var drop = $("#drop");
  ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("sobre"); }); });
  ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("sobre"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer.files[0]) ler(e.dataTransfer.files[0]); });
  $("#arquivo").onchange = function () { if (this.files[0]) ler(this.files[0]); this.value = ""; };

  function carregarSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (ok, falha) {
      var s = document.createElement("script");
      s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      s.onload = ok; s.onerror = function () { falha(new Error("não consegui carregar o leitor de Excel (sem internet?) — tente exportar em CSV")); };
      document.head.appendChild(s);
    });
  }

  function ler(arq) {
    status("#aStatus", "info", "Lendo <b>" + esc(arq.name) + "</b>…");
    var excel = /\.xlsx?$/i.test(arq.name);
    arq.arrayBuffer().then(function (buf) {
      if (!excel) return Catalogo.lerCSV(Catalogo.decodificar(buf));
      return carregarSheetJS().then(function () {
        var wb = XLSX.read(buf, { type: "array" });
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      });
    }).then(function (linhas) {
      veiculosLidos = Catalogo.linhasParaVeiculos(linhas);
      if (!veiculosLidos.length) throw new Error("nenhum veículo encontrado na planilha");
      montar();
      status("#aStatus", "ok", "<b>" + veiculosLidos.length + "</b> veículos lidos de " + esc(arq.name) + ". Confira abaixo e publique.");
      $("#pPrevia").hidden = false; $("#pPrevia").scrollIntoView({ behavior: "smooth" });
    }).catch(function (e) { status("#aStatus", "erro", "Não consegui ler o arquivo: " + esc(e.message)); });
  }

  function montar() {
    estoque = Catalogo.montarEstoque(veiculosLidos, { imagens: overrides, mostrarReservados: window.CONFIG.mostrarReservados });
    var reservados = veiculosLidos.filter(function (v) { return v.reservado; }).length;
    var aprox = estoque.veiculos.filter(function (v) { return !v.imgExata; }).length;
    $("#kpis").innerHTML =
      '<div class="kpi"><b>' + estoque.totalUnidades + "</b><small>no site</small></div>" +
      '<div class="kpi"><b>' + reservados + "</b><small>reservados " + (window.CONFIG.mostrarReservados ? "(aparecem)" : "(ocultos)") + "</small></div>" +
      '<div class="kpi"><b>' + estoque.veiculos.length + "</b><small>cards (modelo + cor)</small></div>" +
      '<div class="kpi"><b>' + aprox + "</b><small>fotos aproximadas</small></div>";
    $("#tbody").innerHTML = estoque.veiculos.map(function (v, i) {
      return "<tr><td><img src=\"" + esc(v.img) + "\" alt=\"\" onerror=\"this.style.opacity=.2\"></td>" +
        "<td><b>" + esc(v.modelo) + "</b><br>" + esc(v.cor) + " · " + esc(v.ano) + "</td>" +
        "<td>" + v.unidades + "</td><td>" + esc(v.locais.join(", ")) + "</td>" +
        "<td>" + (v.imgExata ? '<span class="tag ok">exata</span>' : '<span class="tag aprox">aproximada</span>') + "</td>" +
        '<td><input data-i="' + i + '" placeholder="https://…" value="' + esc(overrides[v.imgChave] || "") + '"></td></tr>';
    }).join("");
  }
  $("#tbody").addEventListener("change", function (e) {
    if (!e.target.matches("input[data-i]")) return;
    var v = estoque.veiculos[+e.target.dataset.i], url = e.target.value.trim();
    if (url) overrides[v.imgChave] = url; else delete overrides[v.imgChave];
    montar();
  });

  /* ---------- publicação ---------- */
  function base64(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function salvarArquivo(caminho, conteudo, mensagem) {
    var c = cfg();
    return api("/contents/" + caminho + "?ref=" + encodeURIComponent(c.branch))
      .then(function (r) { return r.status === 404 ? {} : r.json(); })
      .then(function (atual) {
        var corpo = { message: mensagem, content: base64(conteudo), branch: c.branch };
        if (atual.sha) corpo.sha = atual.sha;
        return api("/contents/" + caminho, { method: "PUT", body: JSON.stringify(corpo) });
      })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || r.status); return j; }); });
  }

  $("#publicar").onclick = function () {
    var c = cfg();
    if (!c.token) { status("#pStatus", "erro", "Configure a conexão com o GitHub no passo 1 primeiro."); $("#pConexao").scrollIntoView({ behavior: "smooth" }); return; }
    var btn = this; btn.classList.add("carregando"); btn.textContent = "Publicando…";
    estoque.atualizadoEm = new Date().toISOString();
    var data = new Date().toLocaleString("pt-BR");
    salvarArquivo("data/estoque.json", JSON.stringify(estoque, null, 1), "Atualiza estoque (" + estoque.totalUnidades + " veículos) — " + data)
      .then(function () { return salvarArquivo("data/imagens.json", JSON.stringify(overrides, null, 1), "Atualiza imagens personalizadas — " + data); })
      .then(function () {
        status("#pStatus", "ok", "Publicado! O site atualiza em 1 a 2 minutos. <a href=\"./\" target=\"_blank\">Abrir o site</a>");
      })
      .catch(function (e) { status("#pStatus", "erro", "Falha ao publicar: " + esc(e.message) + ". Se persistir, use \"Baixar estoque.json\" e envie manualmente pelo GitHub."); })
      .finally(function () { btn.classList.remove("carregando"); btn.textContent = "Publicar no site"; });
  };

  $("#baixar").onclick = function () {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(estoque, null, 1)], { type: "application/json" }));
    a.download = "estoque.json"; a.click();
  };

  carregarCfg();
})();
