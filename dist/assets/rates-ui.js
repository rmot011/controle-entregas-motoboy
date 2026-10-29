(() => {
  // Tabela independente da interface original: usa as mesmas chaves do localStorage.
  const RATE_KEY = 'taxas-motoboy';
  const CLIENT_KEY = 'clientes-motoboy';
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const money = (value) => Number(String(value).replace(',', '.')) || 0;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const style = document.createElement('style');
  style.textContent = `
    #rates-manager-launcher{margin:12px auto 0;display:block;width:100%;max-width:420px;border:1px solid #dbe3ec;border-radius:8px;padding:10px 14px;background:#fff;color:#17243b;font-size:13px;font-weight:600;cursor:pointer}
    #rates-manager-launcher:hover{background:#f4f8fb;border-color:#b9c9da}
    #rates-manager-overlay{position:fixed;z-index:99999;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.52);font-family:ui-sans-serif,system-ui,sans-serif}
    #rates-manager-overlay.open{display:flex}
    .rates-manager-card{width:min(680px,100%);max-height:min(760px,92vh);overflow:auto;border-radius:14px;background:#fff;box-shadow:0 22px 70px rgba(15,23,42,.28);padding:20px}
    .rates-manager-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
    .rates-manager-head h2{margin:0;color:#17243b;font-size:20px}.rates-manager-head p{margin:5px 0 0;color:#64748b;font-size:12px}.rates-manager-count{display:inline-block;margin-left:6px;padding:3px 7px;border-radius:999px;background:#e8f1f8;color:#335d84;font-size:11px;font-weight:700}
    .rates-manager-close{border:0;border-radius:50%;width:30px;height:30px;background:#f1f5f9;color:#475569;cursor:pointer;font-size:18px}
    .rates-manager-table{width:100%;border-collapse:collapse;font-size:12px}.rates-manager-table th{padding:9px 7px;text-align:left;color:#64748b;background:#f8fafc;font-size:11px}.rates-manager-table td{padding:8px 7px;border-bottom:1px solid #edf1f5;vertical-align:middle}.rates-manager-table input{width:100%;border:1px solid #d8e1ea;border-radius:6px;padding:8px;color:#17243b;background:#fff;font-size:12px;box-sizing:border-box}.rates-manager-table .rate-input{max-width:120px}.rates-manager-delete{border:0;background:transparent;color:#dc2626;cursor:pointer;font-size:11px}.rates-manager-add{margin-top:12px;border:1px dashed #b9c9da;border-radius:7px;padding:9px 12px;background:#f8fbfd;color:#335d84;cursor:pointer;font-size:12px}.rates-manager-backup{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid #edf1f5}.rates-manager-backup button{border:1px solid #cbd5e1;border-radius:7px;padding:9px 11px;background:#f8fafc;color:#335d84;cursor:pointer;font-size:11px;font-weight:700}.rates-manager-backup p{width:100%;margin:0;color:#64748b;font-size:11px;line-height:1.4}.rates-manager-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.rates-manager-actions button{border:0;border-radius:7px;padding:10px 16px;cursor:pointer;font-size:12px;font-weight:700}.rates-manager-cancel{background:#f1f5f9;color:#475569}.rates-manager-save{background:#171717;color:#fff}.rates-manager-empty{padding:24px 8px;text-align:center;color:#64748b;font-size:12px}.rates-manager-toast{position:fixed;z-index:100000;right:18px;bottom:18px;border-radius:8px;padding:11px 14px;color:#fff;background:#17243b;font-size:12px;box-shadow:0 8px 25px rgba(15,23,42,.2)}
  `;
  document.head.appendChild(style);

  const getActiveClient = () => {
    const selector = document.querySelector('[role="combobox"]');
    const name = selector ? selector.textContent.trim() : '';
    const clients = read(CLIENT_KEY, []);
    return clients.find((client) => client.nome === name) || clients[0] || null;
  };

  const overlay = document.createElement('div');
  overlay.id = 'rates-manager-overlay';
  document.body.appendChild(overlay);

  const toast = (message) => {
    const node = document.createElement('div');
    node.className = 'rates-manager-toast'; node.textContent = message; document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  };

  const openTable = () => {
    const client = getActiveClient();
    if (!client) { toast('Crie ou selecione um estabelecimento primeiro.'); return; }
    const allRates = read(RATE_KEY, {});
    const prefix = `${client.id}::`;
    const rows = Object.entries(allRates).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ bairro: key.slice(prefix.length), valor: value }));
    overlay.innerHTML = `<div class="rates-manager-card" role="dialog" aria-modal="true"><div class="rates-manager-head"><div><h2>Taxas por bairro <span class="rates-manager-count">${rows.length} ${rows.length === 1 ? 'bairro' : 'bairros'}</span></h2><p>Estabelecimento: <strong>${client.nome}</strong></p></div><button class="rates-manager-close" aria-label="Fechar">×</button></div><div class="rates-manager-body"></div><button class="rates-manager-add">+ Adicionar bairro</button><div class="rates-manager-backup"><p>Compartilhe esta tabela com outros motoboys ou importe um backup recebido.</p><button type="button" class="rates-manager-export">⬇ Exportar / compartilhar</button><button type="button" class="rates-manager-import">⬆ Importar tabela</button><input class="rates-manager-file" type="file" accept="application/json,.json" hidden></div><div class="rates-manager-actions"><button class="rates-manager-cancel">Cancelar</button><button class="rates-manager-save">Salvar tabela</button></div></div>`;
    overlay.classList.add('open');
    const body = overlay.querySelector('.rates-manager-body');
    // Mantém o total de bairros visível e sincronizado com as linhas da tabela.
    const atualizarContador = () => {
      const total = body.querySelectorAll('tr[data-rate-row]').length;
      const contador = overlay.querySelector('.rates-manager-count');
      if (contador) contador.textContent = `${total} ${total === 1 ? 'bairro' : 'bairros'}`;
    };
    const render = () => {
      const current = [...body.querySelectorAll('tr[data-rate-row]')];
      if (!current.length) { body.innerHTML = '<div class="rates-manager-empty">Nenhuma taxa cadastrada para este estabelecimento.</div>'; atualizarContador(); return; }
      const table = document.createElement('table'); table.className = 'rates-manager-table';
      table.innerHTML = '<thead><tr><th>Bairro</th><th>Taxa (R$)</th><th></th></tr></thead><tbody></tbody>';
      current.forEach((row) => table.querySelector('tbody').appendChild(row));
      body.innerHTML = ''; body.appendChild(table); atualizarContador();
    };
    const addRow = (bairro = '', valor = '') => {
      if (body.querySelector('.rates-manager-empty')) body.innerHTML = '';
      let tbody = body.querySelector('tbody');
      if (!tbody) { body.innerHTML = '<table class="rates-manager-table"><thead><tr><th>Bairro</th><th>Taxa (R$)</th><th></th></tr></thead><tbody></tbody></table>'; tbody = body.querySelector('tbody'); }
      const tr = document.createElement('tr'); tr.dataset.rateRow = '1';
      tr.innerHTML = `<td><input class="rate-neighborhood" value="${bairro.replaceAll('"', '&quot;')}" placeholder="Ex.: Vila Nova"></td><td><input class="rate-input" inputmode="decimal" value="${valor}" placeholder="0,00"></td><td><button class="rates-manager-delete" type="button">Excluir</button></td>`;
      tr.querySelector('.rates-manager-delete').onclick = () => { tr.remove(); if (!tbody.children.length) render(); else atualizarContador(); };
      tbody.appendChild(tr);
      atualizarContador();
    };
    rows.forEach((row) => addRow(row.bairro, String(row.valor).replace('.', ',')));
    if (!rows.length) render();
    overlay.querySelector('.rates-manager-add').onclick = () => addRow();
    const exportTable = async () => {
      const taxas = Object.entries(read(RATE_KEY, {}))
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ bairro: key.slice(prefix.length), valor: Number(value) || 0 }))
        .sort((a, b) => a.bairro.localeCompare(b.bairro, 'pt-BR', { sensitivity: 'base' }));
      const backup = { app: 'Gerenciador de Entregas', tipo: 'tabela-taxas', versao: 1, estabelecimento: client.nome, taxas };
      const json = JSON.stringify(backup, null, 2);
      const fileName = `tabela-taxas-${normalize(client.nome).replace(/[^a-z0-9]+/g, '-') || 'backup'}.json`;
      const file = new File([json], fileName, { type: 'application/json' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: 'Tabela de taxas', text: `Tabela de taxas - ${client.nome}`, files: [file] });
          toast('Tabela compartilhada.');
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.style.display = 'none';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Backup baixado. Agora envie o arquivo pelo WhatsApp.');
    };
    const importTable = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const backup = JSON.parse(String(reader.result || '{}'));
          if (backup.tipo !== 'tabela-taxas' || !Array.isArray(backup.taxas)) throw new Error('formato');
          body.innerHTML = '';
          backup.taxas.forEach((item) => {
            const bairro = String(item.bairro || '').trim();
            const valor = money(item.valor);
            if (bairro) addRow(bairro, String(valor).replace('.', ','));
          });
          toast(`${backup.taxas.length} taxas importadas. Toque em Salvar tabela.`);
        } catch {
          toast('Arquivo inválido. Use um backup exportado por este app.');
        }
      };
      reader.readAsText(file);
    };
    overlay.querySelector('.rates-manager-export').onclick = exportTable;
    const fileInput = overlay.querySelector('.rates-manager-file');
    overlay.querySelector('.rates-manager-import').onclick = () => fileInput.click();
    fileInput.onchange = () => { if (fileInput.files?.[0]) importTable(fileInput.files[0]); fileInput.value = ''; };
    const close = () => overlay.classList.remove('open');
    overlay.querySelector('.rates-manager-close').onclick = close;
    overlay.querySelector('.rates-manager-cancel').onclick = close;
    overlay.onclick = (event) => { if (event.target === overlay) close(); };
    overlay.querySelector('.rates-manager-save').onclick = () => {
      const updated = { ...read(RATE_KEY, {}) };
      Object.keys(updated).filter((key) => key.startsWith(prefix)).forEach((key) => delete updated[key]);
      overlay.querySelectorAll('tr[data-rate-row]').forEach((row) => {
        const bairro = row.querySelector('.rate-neighborhood').value.trim();
        const valor = money(row.querySelector('.rate-input').value);
        if (bairro && valor >= 0) updated[`${client.id}::${normalize(bairro)}`] = valor;
      });
      write(RATE_KEY, updated); close(); toast('Tabela de taxas salva.');
    };
  };

  // Liga as sugestões salvas ao formulário original e atualiza o input React de forma nativa.
  const setControlledInput = (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const syncDeliveryRateSuggestions = () => {
    const neighborhood = document.querySelector('#cliente');
    const rate = document.querySelector('#valor');
    const client = getActiveClient();
    if (!neighborhood || !rate || !client) return;

    const allRates = read(RATE_KEY, {});
    const prefix = `${client.id}::`;
    const saved = Object.entries(allRates)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ bairro: key.slice(prefix.length), valor: value }));

    let list = document.getElementById('rates-neighborhood-suggestions');
    if (!list) {
      list = document.createElement('datalist');
      list.id = 'rates-neighborhood-suggestions';
      document.body.appendChild(list);
    }
    list.innerHTML = saved.map((item) => `<option value="${item.bairro.replaceAll('"', '&quot;')}">${Number(item.valor).toFixed(2).replace('.', ',')}</option>`).join('');
    neighborhood.setAttribute('list', list.id);

    if (neighborhood.dataset.rateSuggestionBound === client.id) return;
    neighborhood.dataset.rateSuggestionBound = client.id;
    const applySavedRate = () => {
      const savedRate = findSavedRate(client, neighborhood.value);
      if (savedRate !== undefined) setControlledInput(rate, String(savedRate).replace('.', ','));
    };
    neighborhood.addEventListener('input', applySavedRate);
    neighborhood.addEventListener('change', applySavedRate);
    neighborhood.addEventListener('keyup', applySavedRate);
  };

  // Picker próprio, em vez de depender do datalist, para funcionar no Chrome/Samsung Internet.
  const findSavedRate = (client, text) => {
    if (!client) return undefined;
    const query = normalize(text);
    if (!query) return undefined;
    const allRates = read(RATE_KEY, {});
    const prefix = `${client.id}::`;
    const entries = Object.entries(allRates).filter(([key]) => key.startsWith(prefix));
    const exact = entries.find(([key]) => key.slice(prefix.length) === query);
    if (exact) return exact[1];
    const starts = entries.find(([key]) => key.slice(prefix.length).startsWith(query));
    if (starts) return starts[1];
    const tokens = query.split(/\s+/).filter(Boolean);
    const partial = entries.find(([key]) => tokens.every((token) => key.slice(prefix.length).includes(token)));
    return partial ? partial[1] : undefined;
  };
  const applyRateToCurrentDelivery = () => {
    const neighborhood = document.querySelector('#cliente');
    const rate = document.querySelector('#valor');
    const savedRate = findSavedRate(getActiveClient(), neighborhood?.value);
    if (!neighborhood || !rate || savedRate === undefined) return false;
    setControlledInput(rate, String(savedRate).replace('.', ','));
    return true;
  };

  // Exibe uma tabela fixa e rolável para escolher diretamente uma taxa salva.
  const instalarTabelaTaxasEntrega = () => {
    const bairro = document.querySelector('#cliente');
    const valor = document.querySelector('#valor');
    const cliente = getActiveClient();
    if (!bairro || !valor || !cliente || !bairro.parentElement) return;
    // O cadastro funciona exclusivamente pela tabela; remove menus e sugestões antigas.
    document.getElementById('rates-clickable-suggestions')?.remove();
    document.getElementById('rates-neighborhood-suggestions')?.remove();
    bairro.removeAttribute('list');
    // O cadastro funciona como uma lista de atalhos: não exibe campos para digitação.
    const blocoBairro = bairro.parentElement;
    const blocoValor = valor.parentElement;
    const formulario = blocoValor?.parentElement || blocoBairro.parentElement;
    blocoBairro.style.display = 'none';
    if (blocoValor) blocoValor.style.display = 'none';
    let tabela = document.getElementById('tabela-taxas-entrega');
    if (!tabela) {
      tabela = document.createElement('div');
      tabela.id = 'tabela-taxas-entrega';
    }
    if (formulario && tabela.parentElement !== formulario) formulario.appendChild(tabela);
    const taxas = Object.entries(read(RATE_KEY, {}))
      .filter(([chave]) => chave.startsWith(`${cliente.id}::`))
      .map(([chave, taxa]) => ({ bairro: chave.slice(`${cliente.id}::`.length), taxa }))
      .sort((a, b) => a.bairro.localeCompare(b.bairro, 'pt-BR', { sensitivity: 'base' }));

    // Evita reconstruir a tabela a cada intervalo, preservando foco, texto e teclado.
    const assinatura = `${cliente.id}|${taxas.map((item) => `${item.bairro}:${item.taxa}`).join('|')}`;
    if (tabela.dataset.assinatura === assinatura) return;
    tabela.dataset.assinatura = assinatura;
    tabela.style.cssText = 'display:block;width:100%;max-height:230px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;';
    tabela.innerHTML = '';

    const titulo = document.createElement('div');
    titulo.textContent = `Escolha uma entrega pronta para adicionar — ${taxas.length} ${taxas.length === 1 ? 'bairro cadastrado' : 'bairros cadastrados'}`;
    titulo.style.cssText = 'padding:2px 4px 8px;color:#334155;font-size:12px;font-weight:700;';
    tabela.appendChild(titulo);
    // Pesquisa rápida para localizar um bairro sem precisar rolar toda a lista.
    const pesquisa = document.createElement('input');
    pesquisa.type = 'search';
    pesquisa.placeholder = 'Pesquisar bairro...';
    pesquisa.setAttribute('aria-label', 'Pesquisar bairro');
    pesquisa.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:0 0 8px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#17243b;font-size:12px;';
    tabela.appendChild(pesquisa);
    if (!taxas.length) {
      const vazio = document.createElement('div');
      vazio.textContent = 'Nenhuma taxa cadastrada para este estabelecimento.';
      vazio.style.cssText = 'padding:8px 4px;color:#64748b;font-size:12px;';
      tabela.appendChild(vazio);
      return;
    }

    taxas.forEach((item) => {
      const linha = document.createElement('div');
      linha.dataset.bairro = normalize(item.bairro);
      linha.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 4px;border-top:1px solid #e2e8f0;';
      const texto = document.createElement('span');
      texto.textContent = `${item.bairro} — R$ ${Number(item.taxa).toFixed(2).replace('.', ',')}`;
      texto.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17243b;font-size:12px;';
      const selecionar = document.createElement('button');
      selecionar.type = 'button';
      selecionar.textContent = 'Adicionar entrega';
      selecionar.style.cssText = 'flex:0 0 auto;padding:8px 10px;border:0;border-radius:6px;background:#17243b;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;';
      selecionar.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setControlledInput(bairro, item.bairro);
        setControlledInput(valor, String(item.taxa).replace('.', ','));
        selecionar.textContent = 'Salvando...';
        selecionar.style.background = '#15803d';
        setTimeout(() => {
          const adicionar = [...document.querySelectorAll('button')]
            .find((botao) => botao.textContent.trim() === 'Adicionar');
          if (adicionar) adicionar.click();
          else {
            selecionar.textContent = 'Tentar novamente';
            selecionar.style.background = '#b91c1c';
          }
        }, 120);
      };
      linha.appendChild(texto);
      linha.appendChild(selecionar);
      tabela.appendChild(linha);
    });
    pesquisa.addEventListener('input', () => {
      const termo = normalize(pesquisa.value);
      tabela.querySelectorAll('[data-bairro]').forEach((linha) => {
        linha.style.display = !termo || linha.dataset.bairro.includes(termo) ? 'flex' : 'none';
      });
    });
  };

  const installInteractiveRatePicker = () => {
    const neighborhood = document.querySelector('#cliente');
    const rate = document.querySelector('#valor');
    const client = getActiveClient();
    if (!neighborhood || !rate || !client) return;

    let picker = document.getElementById('rates-clickable-suggestions');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'rates-clickable-suggestions';
      picker.style.cssText = 'position:static;z-index:100001;display:none;width:100%;max-height:190px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;margin-top:8px;padding:6px;border:1px solid #d8e1ea;border-radius:8px;background:#fff;box-shadow:0 5px 16px rgba(15,23,42,.10);font-family:ui-sans-serif,system-ui,sans-serif;';
      document.body.appendChild(picker);
    }
    const hide = () => { picker.style.display = 'none'; };
    const show = () => {
      const allRates = read(RATE_KEY, {});
      const prefix = `${client.id}::`;
      const query = normalize(neighborhood.value);
      const saved = Object.entries(allRates)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ bairro: key.slice(prefix.length), valor: value }))
        .filter((item) => !query || item.bairro.includes(query) || query.split(/\s+/).filter(Boolean).every((part) => item.bairro.includes(part)));
      if (!saved.length) { hide(); return; }
      picker.innerHTML = '<div style="padding:4px 8px 6px;color:#64748b;font-size:10px;font-weight:700">Taxas salvas neste estabelecimento</div>';
      saved.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${item.bairro}  ·  R$ ${Number(item.valor).toFixed(2).replace('.', ',')}`;
        button.style.cssText = 'display:block;width:100%;padding:9px 8px;border:0;border-radius:6px;text-align:left;background:#fff;color:#17243b;font-size:12px;cursor:pointer;';
        button.onmouseenter = () => { button.style.background = '#f1f5f9'; };
        button.onmouseleave = () => { button.style.background = '#fff'; };
        button.onmousedown = (event) => event.preventDefault();
        const choose = (event) => {
          event.preventDefault();
          setControlledInput(neighborhood, item.bairro);
          setControlledInput(rate, String(item.valor).replace('.', ','));
          hide();
        };
        button.onclick = choose;
        button.ontouchend = choose;
        picker.appendChild(button);
      });
      const parent = neighborhood.parentElement;
      if (parent) {
        parent.appendChild(picker);
        picker.style.display = 'block';
      }
    };
    const isNewField = neighborhood.dataset.clickRatePicker !== client.id;
    if (isNewField) {
      neighborhood.dataset.clickRatePicker = client.id;
      neighborhood.addEventListener('focus', show);
      neighborhood.addEventListener('input', show);
      neighborhood.addEventListener('change', show);
      neighborhood.addEventListener('blur', () => setTimeout(hide, 180));
      show();
    }
  };

  const installLauncher = () => {
    if (!document.querySelector('[role="combobox"]') || document.getElementById('rates-manager-launcher')) return;
    const button = document.createElement('button');
    button.id = 'rates-manager-launcher'; button.type = 'button'; button.textContent = '⚙ Consultar e editar taxas por bairro'; button.onclick = openTable;
    const anchor = document.querySelector('[role="combobox"]')?.closest('div');
    const root = document.getElementById('root');
    (anchor?.parentElement || root)?.appendChild(button);
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const text = button.textContent.trim().toLowerCase();
    if (text === 'adicionar' || text === 'salvar') applyRateToCurrentDelivery();
  }, true);

  // Não observar o body: a própria lista cria nós e isso causava um loop infinito no Samsung.
  // Uma varredura leve detecta apenas quando o modal Nova Entrega é aberto.
  setInterval(() => {
    installLauncher();
    instalarTabelaTaxasEntrega();
  }, 900);
  installLauncher();
})();
