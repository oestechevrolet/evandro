# Cartão Digital — Evandro Oliveira (Oeste Veículos · Chevrolet)

Site estático (GitHub Pages) com:
- **index.html** — cartão digital + estoque real a pronta entrega (sem preços), WhatsApp, Instagram e simulação de financiamento por e-mail.
- **admin.html** — página do Evandro para subir a planilha exportada pelo DMS e publicar o estoque atualizado.

## Estrutura
```
index.html            página pública
admin.html            página de administrador (não aparece no Google)
assets/config.js      nome, WhatsApp, Instagram, e-mail, opções  ← edite aqui
assets/catalogo.js    leitura da planilha + base de imagens Chevrolet
assets/app.js         lógica da página pública
assets/admin.js       lógica do administrador
assets/style.css      visual
assets/evandro.jpg    FOTO DO EVANDRO (adicionar — quadrada, ~600×600)
data/estoque.json     estoque publicado (gerado pelo admin, já vem com o estoque de 27/11)
data/imagens.json     imagens trocadas manualmente no admin
```

## 1. Publicar no GitHub (uma vez)
1. Crie uma conta em github.com (ex.: `oesteveiculos`).
2. **New repository** → nome `evandro` → **Public** → Create.
3. **Add file → Upload files** → arraste **todo o conteúdo** desta pasta (inclusive `assets` e `data`) → Commit.
4. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save.
5. Em ~1 minuto o site fica em `https://oesteveiculos.github.io/evandro/`
   e o administrador em `https://oesteveiculos.github.io/evandro/admin.html`.

## 2. Foto do Evandro
Envie uma foto quadrada com o nome `evandro.jpg` para a pasta `assets/`. Sem a foto, aparecem as iniciais "EO".

## 3. Ativar o envio das simulações por e-mail (uma vez)
O formulário usa o serviço gratuito **FormSubmit** (formsubmit.co), que encaminha para `evandro@oesteveiculos.com.br`.
1. Abra o site e envie uma simulação de teste.
2. Chega um e-mail "FormSubmit – Activate Form" no e-mail do Evandro → clique em **Activate Form**.
3. Pronto: as próximas simulações chegam direto no e-mail, em formato de tabela.

Enquanto não ativar (ou se o serviço falhar), o site abre o aplicativo de e-mail do cliente com tudo preenchido.
Para usar sempre esse modo, troque `envioFormulario: "mailto"` em `assets/config.js`.

## 4. Atualizar o estoque (rotina do Evandro)
1. No DMS, exporte o estoque (CSV ou Excel).
2. Abra `.../admin.html`.
3. Primeira vez: preencha usuário, repositório e o **token** (instruções na própria página) → *Salvar e testar*.
4. Arraste a planilha → confira as fotos → **Publicar no site**. Em 1–2 minutos o site mostra o novo estoque.

O que **não** vai para o site: preço, dias de estoque, nome de quem reservou, pedido de fábrica, chassi completo
(só os 6 últimos dígitos, para o Evandro identificar o carro na conversa do WhatsApp).
Carros reservados ficam ocultos (mude `mostrarReservados: true` no config para mostrá-los com selo "Reservado").

⚠️ **Nunca suba a planilha original do DMS para o repositório** — ele é público e a planilha tem preços.

## 5. Imagens
As fotos vêm do site oficial da Chevrolet (configurador de cores), escolhidas automaticamente pela versão e cor
de cada carro. Se a Chevrolet mudar alguma imagem ou faltar uma combinação, o admin marca como "aproximada"
e permite colar o link de outra imagem — essa troca fica salva em `data/imagens.json`.

## Domínio próprio (opcional)
Settings → Pages → Custom domain (ex.: `evandro.oesteveiculos.com.br`) e um registro CNAME no DNS apontando para `oesteveiculos.github.io`.
