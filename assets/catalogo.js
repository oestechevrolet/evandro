/* ==========================================================
   CATÁLOGO — leitura da planilha do DMS, limpeza dos dados
   e base de imagens oficiais Chevrolet por versão e cor.
   Usado pela página pública e pela página de administrador.
   ========================================================== */
(function (root) {
  "use strict";

  /* ---------- utilitários de texto ---------- */
  function semAcento(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function chave(s) {
    return semAcento(s).toUpperCase().replace(/\s+/g, " ").trim();
  }
  var SIGLAS = { MT: 1, AT: 1, RS: 1, LT: 1, LTZ: 1, EUV: 1, S10: 1, "4X4": 1, "4X2": 1, CD: 1, CS: 1, WT: 1, Z71: 1, EV: 1, SUV: 1 };
  function titulo(s) {
    return String(s || "").toLowerCase().split(/\s+/).filter(Boolean).map(function (p) {
      var up = p.toUpperCase();
      if (SIGLAS[semAcento(up)]) return up;
      if (["da", "de", "do", "das", "dos", "e"].indexOf(p) >= 0) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(" ");
  }

  /* ---------- leitura de CSV ---------- */
  function lerCSV(texto) {
    texto = String(texto).replace(/^﻿/, "");
    var primeira = texto.split(/\r?\n/)[0] || "";
    var sep = (primeira.split(";").length >= primeira.split(",").length) ? ";" : ",";
    var linhas = [], campo = "", linha = [], aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(function (l) { return l.some(function (x) { return String(x).trim() !== ""; }); });
  }

  /* Decodifica o arquivo: o DMS exporta em Windows-1252 (acentos), não em UTF-8 */
  function decodificar(buffer) {
    var u8 = new Uint8Array(buffer);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u8); }
    catch (e) { return new TextDecoder("windows-1252").decode(u8); }
  }

  /* ---------- mapeamento das colunas ---------- */
  var COLUNAS = {
    linha: ["LINHA"],
    cor: ["COR EXTERNA", "COR"],
    chassi: ["CHASSI COMPLETO", "CHASSI"],
    modelo: ["MODELO"],
    ano: ["ANO/M", "ANO/MODELO", "ANO"],
    comb: ["COMB", "COMBUSTIVEL"],
    patio: ["PATIO", "LOCAL"],
    motor: ["MOTOR"],
    opcionais: ["OPCIONAIS"],
    corInterna: ["COR INTERNA"],
    reservado: ["RESERVADO POR", "RESERVADO"]
  };

  function linhasParaVeiculos(linhas) {
    if (!linhas.length) throw new Error("A planilha está vazia.");
    // acha a linha de cabeçalho (a primeira que contém MODELO e CHASSI)
    var hi = linhas.findIndex(function (l) {
      var k = l.map(chave);
      return k.indexOf("MODELO") >= 0 && k.some(function (x) { return x.indexOf("CHASSI") === 0; });
    });
    if (hi < 0) throw new Error("Não encontrei as colunas \"Modelo\" e \"Chassi\". Confira se é a planilha de estoque exportada pelo DMS.");
    var cab = linhas[hi].map(chave);
    var idx = {};
    Object.keys(COLUNAS).forEach(function (k) {
      idx[k] = -1;
      COLUNAS[k].some(function (nome) { var p = cab.indexOf(nome); if (p >= 0) { idx[k] = p; return true; } return false; });
    });
    var out = [];
    for (var i = hi + 1; i < linhas.length; i++) {
      var l = linhas[i];
      var get = function (k) { return idx[k] >= 0 ? String(l[idx[k]] == null ? "" : l[idx[k]]).trim() : ""; };
      if (!get("modelo")) continue;
      out.push({
        linha: get("linha").toUpperCase(),
        cor: get("cor"),
        chassi: get("chassi").toUpperCase(),
        modelo: get("modelo"),
        ano: get("ano"),
        comb: get("comb"),
        patio: get("patio"),
        motor: get("motor"),
        opcionais: get("opcionais"),
        corInterna: get("corInterna"),
        reservado: get("reservado")
      });
    }
    return out;
  }

  /* ---------- famílias de modelos ---------- */
  var FAMILIAS = {
    onixplus: { nome: "Onix Plus", tipo: "Sedã", site: "https://www.chevrolet.com.br/carros/novo-onix-plus",
      sobre: "Sedã compacto com porta-malas amplo, motor 1.0 ou 1.0 Turbo econômico e central multimídia com Android Auto e Apple CarPlay sem fio." },
    onix: { nome: "Onix", tipo: "Hatch", site: "https://www.chevrolet.com.br/carros/novo-onix",
      sobre: "Hatch econômico e conectado, com versões 1.0 aspirado e 1.0 Turbo, manuais e automáticas, e central multimídia com espelhamento sem fio." },
    tracker: { nome: "Tracker", tipo: "SUV", site: "https://www.chevrolet.com.br/suvs/novo-tracker",
      sobre: "SUV com posição de dirigir elevada, motor turbo e câmbio automático. Espaço e conforto para a família no dia a dia e na estrada." },
    sonic: { nome: "Sonic", tipo: "SUV Cupê", site: "https://www.chevrolet.com.br/suvs/sonic",
      sobre: "SUV cupê com visual esportivo, motor 1.0 Turbo de 115 cv, câmbio automático e faróis full LED." },
    spark: { nome: "Spark EUV", tipo: "SUV 100% elétrico", site: "https://www.chevrolet.com.br/eletrico/spark-euv",
      sobre: "SUV 100% elétrico, silencioso e com custo de rodagem baixíssimo. Carrega em casa ou em eletropostos." },
    s10: { nome: "S10", tipo: "Picape", site: "https://www.chevrolet.com.br/picapes/s10",
      sobre: "Picape média com motor 2.8 Turbo Diesel Duramax, tração 4x4 e robustez para o trabalho e para a estrada." },
    outros: { nome: "Chevrolet", tipo: "", site: "https://www.chevrolet.com.br/", sobre: "" }
  };

  function familia(v) {
    var m = chave(v.modelo);
    if (/ONIX PLUS/.test(m)) return "onixplus";
    if (/ONIX/.test(m)) return "onix";
    if (/TRACKER/.test(m)) return "tracker";
    if (/SONIC/.test(m)) return "sonic";
    if (/SPARK/.test(m)) return "spark";
    if (/S-?10\b/.test(m)) return "s10";
    return "outros";
  }

  /* ---------- base de imagens (site oficial chevrolet.com.br) ---------- */
  var DAM = "https://www.chevrolet.com.br/content/dam/chevrolet/south-america/brazil/portuguese/index/visid/";
  var W = "?imwidth=960";
  function grade(base, mapa) { var o = {}; Object.keys(mapa).forEach(function (c) { o[c] = DAM + base + mapa[c] + W; }); return o; }

  var ON = "cars/onix/refresh/colorizer/trims/";
  var OP = "cars/onix-plus/refresh/colorizer/trims/";
  var S10 = "pickups-and-trucks/2026-s10/mov/colorizer-360/trims/";
  var SP = "electric/spark-euv/refresh/colorizer/trims/euv/exterior/";

  var IMG = {
    onix: {
      "RS": grade(ON + "rs/exterior/", { "BRANCO SUMMIT": "brancosummit/onix-rs-turbo-branco-summit-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-rs-turbo-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-rs-turbo-vermelho-scarlet-ext.001.png" }),
      "PREMIER": grade(ON + "premier/exterior/", { "AZUL BOREAL": "azulboreal/v2-onix-premier-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-premier-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/v2-onix-premier-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-premier-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-premier-vermelho-scarlet-ext.001.png" }),
      "TURBO AT": grade(ON + "lt-turbo/exterior/", { "AZUL BOREAL": "azulboreal/onix-turbo-at-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-turbo-at-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-turbo-at-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-turbo-at-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-turbo-at-vermelho-scarlet-ext.001.png" }),
      "TURBO MT": grade(ON + "mt-turbo/exterior/", { "AZUL BOREAL": "azulboreal/v3-onix-turbo-mt-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/v3-onix-turbo-mt-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/v3-onix-turbo-mt-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/v3-onix-turbo-mt-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/v3-onix-turbo-mt-vermelho-scarlet-ext.001.png" }),
      "ACTIV": grade(ON + "activ/exterior/", { "AZUL BOREAL": "azulboreal/onix-activ-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-activ-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-activ-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-activ-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-activ-vermelho-scarlet-ext.001.png" }),
      "MT": grade(ON + "mt/exterior/", { "AZUL BOREAL": "azulboreal/onix-10-mt-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-10-mt-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-10-mt-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-10-mt-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-10-mt-vermelho-scarlet-ext.001.png" })
    },
    onixplus: {
      "PREMIER": grade(OP + "premier/exterior/", { "AZUL BOREAL": "azulboreal/onix-premier-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-premier-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-premier-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-premier-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-premier-velmelho-scarlet-ext.001.png" }),
      "LTZ": grade(OP + "ltz/exterior/", { "AZUL BOREAL": "azulboreal/onix-plus-ltz-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-plus-ltz-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-plus-ltz-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-plus-ltz-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-plus-ltz-vermelho-scarlet-ext.001.png" }),
      "TURBO AT": grade(OP + "at/exterior/", { "AZUL BOREAL": "azulboreal/onix-plus-at-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-plus-at-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-plus-at-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-plus-at-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-plus-at-vermelho-scarlet-ext.001.png" }),
      "TURBO MT": grade(OP + "mt/exterior/", { "AZUL BOREAL": "azulboreal/onix-plus-mt-azul-boreal-ext.001.png", "BRANCO SUMMIT": "brancosummit/onix-plus-mt-branco-summit-ext.001.png", "PRATA SHARK": "pratashark/onix-plus-mt-prata-shark-ext.001.png", "PRETO OURO NEGRO": "pretoouronegro/onix-plus-mt-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelhoscarlet/onix-plus-mt-vermelho-scarlet-ext.001.png" }),
      "MT": grade(OP + "1-0-mt/exterior/", { "AZUL BOREAL": "azul-boreal/onix-plus-10mt-azul-boreal-ext.001.png", "BRANCO SUMMIT": "branco-summit/onix-plus-10mt-bramco-summit-ext.001.png", "PRATA SHARK": "prata-shark/onix-plus-10mt-prata-shark-ext.001.png", "PRETO OURO NEGRO": "preto-ouro-negro/onix-plus-10mt-preto-ouro-negro-ext.001.png", "VERMELHO SCARLET": "vermelho-scarlet/onix-plus-10mt-bermlho-scarlet-ext.001.png" })
    },
    s10: (function () {
      function t(pasta, pref) {
        return grade(S10 + pasta + "/exterior/", {
          "BRANCO DUNAS": "branco-dunas/v2-" + pref + "-branco-dunas-ext.001.png", "PRETO OURO NEGRO": "preto-ouro-negro/v2-" + pref + "-preto-ext.001.png",
          "BRANCO SUMMIT": "branco-summit/v2-" + pref + "-branco-summit-ext.001.png", "PRATA SHARK": "prata-shark/v2-" + pref + "-prata-ext.001.png",
          "CINZA TOPAZIO": "cinza-topazio/v2-" + pref + "-cinzatopazio-ext.001.png", "VERMELHO SCARLET": "vermelho-scarlet/v2-" + pref + "-vermelho-ext.001.png"
        });
      }
      var o = { "HIGH COUNTRY": t("hc", "hc"), "Z71": t("z71", "z71"), "LTZ": t("ltz", "ltz"), "WT": t("wt-at", "wt"), "CABINE SIMPLES": t("cs", "cabinesimple") };
      o["HIGH COUNTRY"]["CINZA AMBAR"] = DAM + S10 + "hc/exterior/cinza-ambar/s10-highcountry-cinza-ambar-ext.001.png" + W;
      o["Z71"]["CINZA AMBAR"] = DAM + S10 + "z71/exterior/cinza-ambar/s10-z71-cinza-ambar-ext.001.png" + W;
      o["LTZ"]["CINZA AMBAR"] = DAM + S10 + "ltz/exterior/cinza-ambar/s10-ltz-cinza-ambar-ext.001.png" + W;
      o["WT"]["CINZA AMBAR"] = DAM + S10 + "wt-at/exterior/cinza-ambar/s10-wt-at-cinza-ambar-ext.001.png" + W;
      o["CABINE SIMPLES"]["CINZA AMBAR"] = DAM + S10 + "cs/exterior/cinza-ambar/s10-cabinesimples-cinza-ambar-ext.001.png" + W;
      o["TRAIL BOSS"] = grade(S10 + "trailboss/exterior/", {
        "BRANCO DUNAS": "branco-dunas/s10-trail-boss-whithe-sand.ext.001.jpg", "PRETO OURO NEGRO": "preto-ouro-negro/s10-trail-boss-preto-ouro-negro.ext.001.jpg",
        "BRANCO SUMMIT": "branco-summit/s10-trail-boss-branco-sumit.ext.001.jpg", "PRATA SHARK": "prata-shark/s10-trail-boss-prata-shark.ext.001.jpg",
        "CINZA AMBAR": "cinza-topazio/s10-trail-boss-v1-cinza-ambar.ext.001.jpg", "VERMELHO SCARLET": "vermelho-scarlet/s10-trail-boss-vermelho-escarlate.ext.001.jpg"
      });
      return o;
    })(),
    spark: {
      "EUV": grade(SP, { "AZUL ATLANTICO": "azulatlantico/my27-spark-euv-eva1-g9h-ext.001.png", "BRANCO CUPUACU": "brancocupuacu/my27-spark-euv-eva1-04u-ext.001.png", "CINZA REDENTOR": "cinzaredentor/my27-spark-euv-eva1-88u-ext.001.png", "AZUL ANIL": "azulanil/my27-spark-euv-eva1-g6h-ext.001.png", "PRETO RIO NEGRO": "pretorionegro/my27-spark-euv-eva1-82u-ext.001.png" })
    }
  };

  /* Tracker e Sonic: imagens do configurador oficial, montadas pelo código de pintura GM */
  var PINTURA = { "BRANCO SUMMIT": "GAZ", "PRETO OURO NEGRO": "GB8", "PRATA SHARK": "GR2", "VERMELHO SCARLET": "GFP", "AZUL BOREAL": "GR9", "CINZA AMBAR": "GEK", "CINZA URBANO": "GRE" };
  var TRACKER = {
    pasta: { "RS": "5D76TV_RG0", "PREMIER": "5Y76TV_R8I", "LTZ": "5N76DV_R8F", "LT": "5B76DV_R8D", "BASE": "5X76DV_R8E" },
    cores: { "RS": ["GAZ", "GFP", "GB8", "GEK", "GRE"], "PREMIER": ["GAZ", "GR9", "GFP", "GR2", "GB8", "GEK", "GRE"], "LTZ": ["GAZ", "GR9", "GFP", "GR2", "GB8", "GEK", "GRE"], "LT": ["GAZ", "GR9", "GFP", "GR2", "GB8", "GEK"], "BASE": ["GAZ", "GR9", "GFP", "GR2", "GB8", "GEK"] },
    url: function (pasta, cod) { return "https://vedo.ext.gm.com/asset-gateway/f9e8695d-bae7-4c79-b6a6-261e1e40267c/optimized/2d/main-camera/" + pasta + "/" + cod + "-0001.webp"; }
  };
  var SONIC = {
    caminho: { "PREMIER": "2027/1EE58/1EE58__PR1/CV2_{c}_H2G_MDV_V8Bgmds2.jpg", "RS": "2027/1EF58/1EF58__1RS/94T_CV2_{c}_H5H_MDV_V8Bgmds2.jpg" },
    cores: { "PREMIER": ["GAZ", "GB8", "GFP", "GRE", "GR2", "GR9"], "RS": ["GAZ", "GB8", "GFP", "GRE"] },
    url: function (versao, cod) { return "https://cgi.chevrolet.com/mmgprod-us/dynres/prove/image.gen?country=BR&std=true&v=deg01&i=" + encodeURIComponent(SONIC.caminho[versao].replace("{c}", cod)) + "&transparentBackgroundPng=true"; }
  };

  function versaoImagem(fam, m) {
    if (fam === "onix") {
      if (/PREMIER/.test(m)) return "PREMIER"; if (/\bRS\b/.test(m)) return "RS"; if (/ACTIV/.test(m)) return "ACTIV";
      if (/ECO/.test(m) || (/TURBO/.test(m) && /\bAT\b/.test(m))) return "TURBO AT"; if (/TURBO/.test(m)) return "TURBO MT"; return "MT";
    }
    if (fam === "onixplus") {
      if (/PREMIER/.test(m)) return "PREMIER"; if (/LTZ/.test(m)) return "LTZ";
      if (/ECO/.test(m) || (/TURBO/.test(m) && /\bAT\b/.test(m))) return "TURBO AT"; if (/TURBO/.test(m)) return "TURBO MT"; return "MT";
    }
    if (fam === "s10") {
      if (/HIGH COUNTRY/.test(m)) return "HIGH COUNTRY"; if (/TRAIL/.test(m)) return "TRAIL BOSS"; if (/Z71/.test(m)) return "Z71";
      if (/\bWT\b/.test(m)) return "WT"; if (/\bCS\b|CABINE SIMPLES/.test(m)) return "CABINE SIMPLES"; return "LTZ";
    }
    if (fam === "tracker") { if (/\bRS\b/.test(m)) return "RS"; if (/PREMIER/.test(m)) return "PREMIER"; if (/LTZ/.test(m)) return "LTZ"; if (/\bLT\b/.test(m)) return "LT"; return "BASE"; }
    if (fam === "sonic") return /\bRS\b/.test(m) ? "RS" : "PREMIER";
    if (fam === "spark") return "EUV";
    return "";
  }

  /* Devolve { url, exata } — exata=false quando usou a cor/versão mais próxima */
  function imagemOficial(fam, modelo, cor) {
    var m = chave(modelo), c = chave(cor), v = versaoImagem(fam, m);
    if (fam === "tracker" || fam === "sonic") {
      var T = fam === "tracker" ? TRACKER : SONIC, cod = PINTURA[c];
      var mk = function (ver, cd) { return fam === "tracker" ? TRACKER.url(TRACKER.pasta[ver], cd) : SONIC.url(ver, cd); };
      if (cod && T.cores[v].indexOf(cod) >= 0) return { url: mk(v, cod), exata: true };
      for (var ver in T.cores) if (cod && T.cores[ver].indexOf(cod) >= 0) return { url: mk(ver, cod), exata: false };
      return { url: mk(v, T.cores[v][0]), exata: false };
    }
    var fonte = IMG[fam];
    if (!fonte) return { url: "", exata: false };
    if (fonte[v] && fonte[v][c]) return { url: fonte[v][c], exata: true };
    for (var k in fonte) if (fonte[k][c]) return { url: fonte[k][c], exata: false };
    var pv = fonte[v] || fonte[Object.keys(fonte)[0]];
    return { url: pv[Object.keys(pv)[0]], exata: false };
  }

  /* ---------- nomes amigáveis ---------- */
  var CIDADES = { "TANGARA DA SERRA": "Tangará da Serra", "BARRA DO GARCAS": "Barra do Garças", "NOVA MUTUM": "Nova Mutum", "CAMPO NOVO DO PARECIS": "Campo Novo do Parecis", "CUIABA": "Cuiabá", "SINOP": "Sinop" };
  function local(p) {
    var k = chave(p);
    if (!k) return "";
    if (/TRANSITO|CEGONHA/.test(k)) return "Em trânsito";
    return CIDADES[k] || titulo(p);
  }
  function combustivel(c) { var k = chave(c); return k === "ELETRICO" ? "Elétrico" : titulo(c); }
  function corBonita(c) {
    var t = titulo(c);
    return t.replace(/\bAmbar\b/, "Âmbar").replace(/\bAtlantico\b/, "Atlântico").replace(/\bCupuacu\b/, "Cupuaçu").replace(/\bTopazio\b/, "Topázio");
  }

  /* ---------- monta o JSON público (sem preço, sem nomes, sem pedido) ---------- */
  function montarEstoque(veiculos, opcoes) {
    opcoes = opcoes || {};
    var overrides = opcoes.imagens || {};
    var mostrarReservados = !!opcoes.mostrarReservados;
    var grupos = {}, ordem = [];
    veiculos.forEach(function (v) {
      var reservado = !!v.reservado;
      if (reservado && !mostrarReservados) return;
      var fam = familia(v);
      var key = [chave(v.modelo), chave(v.cor), chave(v.ano), reservado ? "R" : ""].join("|");
      if (!grupos[key]) {
        var chaveImg = chave(v.modelo) + "|" + chave(v.cor);
        var of = imagemOficial(fam, v.modelo, v.cor);
        grupos[key] = {
          id: "", familia: fam, familiaNome: FAMILIAS[fam].nome,
          modelo: titulo(v.modelo), cor: corBonita(v.cor), ano: v.ano,
          combustivel: combustivel(v.comb), motor: v.motor, corInterna: titulo(v.corInterna),
          unidades: 0, locais: [], refs: [], reservado: reservado,
          img: overrides[chaveImg] || of.url, imgChave: chaveImg, imgExata: !!overrides[chaveImg] || of.exata
        };
        ordem.push(key);
      }
      var g = grupos[key];
      g.unidades++;
      var l = local(v.patio);
      if (l && g.locais.indexOf(l) < 0) g.locais.push(l);
      if (v.chassi) g.refs.push(v.chassi.slice(-6));
    });
    var famOrdem = ["onix", "onixplus", "tracker", "sonic", "spark", "s10", "outros"];
    var lista = ordem.map(function (k) { return grupos[k]; });
    lista.sort(function (a, b) {
      return famOrdem.indexOf(a.familia) - famOrdem.indexOf(b.familia) || a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor);
    });
    lista.forEach(function (g, i) {
      g.id = (g.familia + "-" + chave(g.modelo + " " + g.cor).toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/-+$/, "") + "-" + i;
      g.locais.sort(function (a, b) { return (a === "Em trânsito") - (b === "Em trânsito") || a.localeCompare(b); });
    });
    return {
      atualizadoEm: new Date().toISOString(),
      totalUnidades: lista.reduce(function (s, g) { return s + g.unidades; }, 0),
      familias: famOrdem.filter(function (f) { return lista.some(function (g) { return g.familia === f; }); })
        .map(function (f) { return { id: f, nome: FAMILIAS[f].nome, tipo: FAMILIAS[f].tipo, sobre: FAMILIAS[f].sobre, site: FAMILIAS[f].site }; }),
      veiculos: lista
    };
  }

  var API = {
    lerCSV: lerCSV, decodificar: decodificar, linhasParaVeiculos: linhasParaVeiculos,
    montarEstoque: montarEstoque, imagemOficial: imagemOficial, familia: familia, chave: chave, FAMILIAS: FAMILIAS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.Catalogo = API;
})(typeof window !== "undefined" ? window : this);
