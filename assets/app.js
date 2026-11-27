(function () {
  "use strict";
  var C = window.CONFIG, $ = function (s) { return document.querySelector(s); };
  var ESTOQUE = null, filtroFam = "", filtroLocal = "", veiculoAtual = null;

  var CORES = {
    "branco summit": "#f4f5f4", "branco dunas": "#e9e2d3", "branco cupuaçu": "#efe9dc", "preto ouro negro": "#16171a",
    "preto rio negro": "#141518", "prata shark": "#b9bec4", "vermelho scarlet": "#b5121b", "azul boreal": "#1e2f4f",
    "azul atlântico": "#2a5d84", "azul anil": "#3b4f9c", "cinza âmbar": "#7d7a73", "cinza urbano": "#6d7378",
    "cinza topázio": "#5a5d61", "cinza redentor": "#8b9095"
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function wa(texto) { return "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(texto); }
  function iniciais(n) { return n.split(/\s+/).filter(Boolean).map(function (p) { return p[0]; }).slice(0, 2).join("").toUpperCase(); }
  function zoom(u) { return /vedo\.ext\.gm\.com/.test(u) ? "z-vedo" : /cgi\.chevrolet\.com/.test(u) ? "z-cgi" : ""; }
  function nomeVeic(v) { return "Chevrolet " + v.modelo + " " + v.cor + " " + v.ano; }

  /* ---------- cartão ---------- */
  function montarCartao() {
    document.querySelectorAll("#avatar,#avatarFin").forEach(function (el) {
      var img = new Image();
      img.alt = C.nome;
      img.onload = function () { el.innerHTML = ""; el.appendChild(img); };
      img.onerror = function () { el.textContent = iniciais(C.nome); };
      el.textContent = iniciais(C.nome);
      img.src = C.foto;
    });
    $("#nome").textContent = C.nome; $("#cargo").textContent = C.cargo; $("#empresa").textContent = C.empresa;
    $("#rodapeNome").textContent = C.nome; $("#rodapeEmpresa").textContent = C.empresa;
    $("#btnWhats").href = wa(C.mensagemPadrao); $("#flutuante").href = wa(C.mensagemPadrao);
    $("#btnInsta").href = "https://www.instagram.com/" + C.instagram + "/";
    $("#fPrazo").innerHTML = C.prazos.map(function (p) { return '<option value="' + p + ' meses"' + (p === 48 ? " selected" : "") + ">" + p + " meses</option>"; }).join("");
  }

  /* ---------- estoque ---------- */
  function carregar() {
    fetch("data/estoque.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { ESTOQUE = d; montarFiltros(); render(); preencherSelect(); })
      .catch(function () { $("#resumo").textContent = "Não foi possível carregar o estoque agora. Fale comigo no WhatsApp!"; preencherSelect(); });
  }

  function montarFiltros() {
    var fams = ESTOQUE.familias, vs = ESTOQUE.veiculos;
    var cont = function (f) { return vs.filter(function (v) { return !f || v.familia === f; }).reduce(function (s, v) { return s + v.unidades; }, 0); };
    var html = '<button class="chip" aria-pressed="true" data-f="">Todos<small>' + cont("") + "</small></button>";
    fams.forEach(function (f) { html += '<button class="chip" aria-pressed="false" data-f="' + f.id + '">' + esc(f.nome) + "<small>" + cont(f.id) + "</small></button>"; });
    $("#filtros").innerHTML = html;
    $("#filtros").onclick = function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      filtroFam = b.dataset.f;
      document.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      render();
    };
    var locais = [];
    vs.forEach(function (v) { v.locais.forEach(function (l) { if (locais.indexOf(l) < 0) locais.push(l); }); });
    locais.sort(function (a, b) { return (a === "Em trânsito") - (b === "Em trânsito") || a.localeCompare(b); });
    $("#filtroLocal").innerHTML = '<option value="">Todas as cidades</option>' + locais.map(function (l) { return "<option>" + esc(l) + "</option>"; }).join("");
    $("#filtroLocal").onchange = function () { filtroLocal = this.value; render(); };
    var dt = new Date(ESTOQUE.atualizadoEm);
    $("#resumo").textContent = ESTOQUE.totalUnidades + " veículos 0 km disponíveis · atualizado em " + dt.toLocaleDateString("pt-BR");
  }

  function iconeLocal() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>'; }

  function render() {
    var lista = ESTOQUE.veiculos.filter(function (v) {
      return (!filtroFam || v.familia === filtroFam) && (!filtroLocal || v.locais.indexOf(filtroLocal) >= 0);
    });
    if (!lista.length) { $("#grade").innerHTML = '<p class="vazio">Nenhum veículo com esse filtro agora. Me chama no WhatsApp que eu encontro para você!</p>'; return; }
    $("#grade").innerHTML = lista.map(function (v) {
      var cor = CORES[v.cor.toLowerCase()] || "#999";
      var selos = '<span class="selo">' + esc(v.familiaNome) + "</span>";
      if (v.reservado) selos += '<span class="selo qtd res">Reservado</span>';
      else if (v.unidades > 1) selos += '<span class="selo qtd">' + v.unidades + " unidades</span>";
      return '<article class="carro">' +
        '<div class="foto">' + selos + '<img loading="lazy" class="' + zoom(v.img) + '" src="' + esc(v.img) + '" alt="' + esc(nomeVeic(v)) + '" onerror="this.style.opacity=0"></div>' +
        '<div class="info"><h3>' + esc(v.modelo) + "</h3>" +
        '<div class="linha-cor"><span class="dot" style="background:' + cor + '"></span>' + esc(v.cor) + "</div>" +
        '<div class="meta"><span>' + esc(v.ano) + "</span><span>" + esc(v.combustivel) + "</span>" + (v.motor ? "<span>" + esc(v.motor) + "</span>" : "") + "</div>" +
        '<p class="onde">' + iconeLocal() + "<span>" + esc(v.locais.join(" · ") || "Consulte") + "</span></p></div>" +
        '<div class="botoes"><div class="dupla"><button class="btn btn-sm btn-marinho" data-det="' + v.id + '">Sobre o carro</button>' +
        '<button class="btn btn-sm btn-roxo" data-financiar="' + v.id + '">Financiamento</button></div>' +
        '<a class="btn btn-sm btn-verde" target="_blank" rel="noopener" href="' + wa(msgInteresse(v)) + '">Entrar em contato</a></div>' +
        "</article>";
    }).join("");
  }

  function msgInteresse(v) {
    return "Olá, Evandro! Vim pelo seu Cartão Digital e me interessei pelo " + nomeVeic(v) +
      (v.locais.length ? " (" + v.locais[0] + ")" : "") + ". Pode me passar mais informações? [Ref. " + (v.refs[0] || v.id) + "]";
  }
  function achar(id) { return ESTOQUE && ESTOQUE.veiculos.filter(function (v) { return v.id === id; })[0]; }

  /* ---------- modais ---------- */
  function abrir(m) { m.classList.add("aberto"); document.body.style.overflow = "hidden"; }
  function fechar(m) { m.classList.remove("aberto"); document.body.style.overflow = ""; }
  document.addEventListener("click", function (e) {
    if (e.target.matches("[data-fechar]") || e.target.classList.contains("modal")) fechar(e.target.closest(".modal"));
    var d = e.target.closest("[data-det]"); if (d) detalhe(achar(d.dataset.det));
    var f = e.target.closest("[data-financiar]"); if (f) financiar(f.dataset.financiar);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.querySelectorAll(".modal.aberto").forEach(fechar); });

  function detalhe(v) {
    if (!v) return;
    veiculoAtual = v;
    var fam = ESTOQUE.familias.filter(function (f) { return f.id === v.familia; })[0] || {};
    $("#detImg").src = v.img; $("#detImg").className = zoom(v.img); $("#detImg").alt = nomeVeic(v);
    $("#detTitulo").textContent = "Chevrolet " + v.modelo;
    $("#detTipo").textContent = [fam.tipo, v.ano].filter(Boolean).join(" · ");
    var ficha = [["Cor", v.cor], ["Combustível", v.combustivel], ["Motor", v.motor], ["Interior", v.corInterna],
      ["Disponível em", v.locais.join(" · ") + (v.unidades > 1 ? "  (" + v.unidades + " unidades)" : ""), 1]];
    $("#detFicha").innerHTML = ficha.filter(function (x) { return x[1]; }).map(function (x) { return '<div class="' + (x[2] ? "largo" : "") + '"><small>' + x[0] + "</small><b>" + esc(x[1]) + "</b></div>"; }).join("");
    $("#detSobre").textContent = fam.sobre || "";
    $("#detSite").href = fam.site || "https://www.chevrolet.com.br/";
    $("#detWhats").href = wa(msgInteresse(v));
    abrir($("#mDetalhe"));
  }
  $("#detFin").onclick = function () { fechar($("#mDetalhe")); financiar(veiculoAtual && veiculoAtual.id); };

  /* ---------- financiamento ---------- */
  function preencherSelect() {
    var opts = '<option value="">Escolha o veículo</option>';
    if (ESTOQUE) ESTOQUE.veiculos.forEach(function (v) { opts += '<option value="' + v.id + '">' + esc(v.modelo + " · " + v.cor) + "</option>"; });
    opts += '<option value="outro">Outro modelo Chevrolet</option>';
    $("#fVeic").innerHTML = opts;
  }
  function financiar(id) {
    $("#formFin").hidden = false; $("#finOk").hidden = true;
    $("#fVeic").value = id && achar(id) ? id : "";
    abrir($("#mFin"));
  }

  function soDig(s) { return String(s).replace(/\D/g, ""); }
  function cpfValido(c) {
    c = soDig(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((10 * s) % 11) % 10 !== +c[t]) return false; }
    return true;
  }
  $("#fCPF").oninput = function () { var d = soDig(this.value).slice(0, 11); this.value = d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); };
  $("#fTel").oninput = function () { var d = soDig(this.value).slice(0, 11); this.value = d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, ""); };
  $("#fEntrada").oninput = function () { var d = soDig(this.value); this.value = d ? (+d / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""; };

  function validar() {
    var ok = true;
    function marca(id, cond) { var c = $(id).closest(".campo"); c.classList.toggle("invalido", !cond); if (!cond) ok = false; }
    marca("#fNome", $("#fNome").value.trim().split(/\s+/).length >= 2);
    marca("#fNasc", !!$("#fNasc").value);
    marca("#fCPF", cpfValido($("#fCPF").value));
    marca("#fTel", soDig($("#fTel").value).length >= 10);
    marca("#fVeic", !!$("#fVeic").value);
    if (!$("#fOk").checked) { ok = false; $("#fOk").focus(); }
    return ok;
  }

  $("#formFin").onsubmit = function (e) {
    e.preventDefault();
    if (!validar()) { var p = document.querySelector(".campo.invalido input,.campo.invalido select"); if (p) p.focus(); return; }
    var sel = $("#fVeic").value, v = achar(sel);
    var veicTxt = v ? nomeVeic(v) + " — disponível em " + v.locais.join(", ") + " [Ref. " + v.refs.join(", ") + "]" : "Outro modelo Chevrolet";
    var nasc = $("#fNasc").value.split("-").reverse().join("/");
    var dados = {
      "Nome": $("#fNome").value.trim(), "Data de nascimento": nasc, "CPF": $("#fCPF").value, "Telefone": $("#fTel").value,
      "Veículo": veicTxt, "Entrada": $("#fEntrada").value || "Não informada", "Prazo": $("#fPrazo").value,
      "CNH": document.querySelector('input[name="CNH"]:checked').value
    };
    var assunto = "Simulação de financiamento — " + dados.Nome + " — " + (v ? v.modelo : "Outro modelo");
    var whatsOk = wa("Olá, Evandro! Acabei de enviar uma simulação de financiamento pelo seu Cartão Digital (" + (v ? v.modelo + " " + v.cor : "outro modelo") + "). Meu nome é " + dados.Nome + ".");

    function sucesso(txt) {
      $("#formFin").hidden = true; $("#finOk").hidden = false;
      if (txt) $("#finOkTexto").textContent = txt;
      $("#finOkWhats").href = whatsOk;
      $("#formFin").reset(); $("#fVeic").value = "";
    }
    function viaMailto() {
      var corpo = Object.keys(dados).map(function (k) { return k + ": " + dados[k]; }).join("\n");
      location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpo);
      sucesso("Abrimos o seu aplicativo de e-mail com a simulação preenchida. É só tocar em Enviar.");
    }
    if (C.envioFormulario !== "formsubmit") return viaMailto();

    var btn = $("#fEnviar"); btn.classList.add("carregando"); btn.textContent = "Enviando…";
    var payload = Object.assign({ _subject: assunto, _template: "table", _captcha: "false" }, dados);
    fetch("https://formsubmit.co/ajax/" + C.email, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (String(r.success) === "true") sucesso(); else throw new Error(r.message); })
      .catch(function () { viaMailto(); })
      .finally(function () { btn.classList.remove("carregando"); btn.textContent = "Enviar simulação"; });
  };

  montarCartao();
  carregar();
})();
