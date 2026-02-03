
    /**
     * FUSION ENGINE (Reactive Store)
     * Centraliza estado e reage automaticamente a mudanças.
     */
    const FusionEngine = {
        state: {
            apiKey: '',
            infodoseName: '',
            modelName: 'nvidia/nemotron-3-nano-30b-a3b:free',
            assistantEnabled: false,
            trainingActive: false,
            zenMode: false,
            trainingText: '',
            trainingFileName: ''
        },
        
        // Loads from localStorage + Defaults
        init() {
            this.state.apiKey = localStorage.getItem('di_apiKey') || '';
            this.state.infodoseName = localStorage.getItem('di_infodoseName') || '';
            this.state.modelName = localStorage.getItem('di_modelName') || this.state.modelName;
            this.state.assistantEnabled = (localStorage.getItem('di_assistantEnabled') === '1');
            this.state.trainingActive = (localStorage.getItem('di_trainingActive') !== '0'); 
            this.state.trainingText = localStorage.getItem('di_trainingText') || '';
            this.state.trainingFileName = localStorage.getItem('di_trainingFileName') || '';
            this.state.zenMode = document.body.classList.contains('zen-mode');

            this.render(); // Initial UI Sync
            this.bindEvents();
            console.log("Fusion Engine v8: Reactive Core Active");
        },

        // Update State & Trigger Reactivity
        set(key, value) {
            this.state[key] = value;
            
            // Persist
            if(key === 'apiKey') localStorage.setItem('di_apiKey', value);
            if(key === 'infodoseName') localStorage.setItem('di_infodoseName', value);
            if(key === 'modelName') localStorage.setItem('di_modelName', value);
            if(key === 'assistantEnabled') localStorage.setItem('di_assistantEnabled', value ? '1' : '0');
            if(key === 'trainingActive') localStorage.setItem('di_trainingActive', value ? '1' : '0');
            if(key === 'trainingText') localStorage.setItem('di_trainingText', value);
            if(key === 'trainingFileName') localStorage.setItem('di_trainingFileName', value);

            // Special Effects
            if(key === 'zenMode') {
                 if(value) {
                     document.body.classList.add('zen-mode');
                     document.getElementById('mantra-toggle').classList.add('collapsed');
                 } else {
                     document.body.classList.remove('zen-mode');
                     document.getElementById('mantra-toggle').classList.remove('collapsed');
                 }
                 // save UI state handles this in main script, but we sync here
            }

            this.render();
            this.triggerVisualPulse();
        },

        // Sync DOM with State
        render() {
             // Top Info
             const iEl = document.getElementById('displayInfodose');
             if(iEl) iEl.innerText = 'Infodose: ' + (this.state.infodoseName || '—');

             // Inputs (if not focused to avoid cursor jumping, or force update if needed)
             const setVal = (id, v) => {
                 const el = document.getElementById(id);
                 if(el && document.activeElement !== el) el.value = v;
             };
             
             setVal('apiKeyInput', this.state.apiKey);
             setVal('modelInput', this.state.modelName);
             setVal('infodoseNameInput', this.state.infodoseName);
             setVal('modelSelect', this.state.modelName); // Select box

             // Toggles
             const setCheck = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v; };
             setCheck('assistantActiveCheckbox', this.state.assistantEnabled);
             setCheck('trainingActiveCheckbox', this.state.trainingActive);
             setCheck('zenModeCheckbox', this.state.zenMode);

             // Labels
             const tLabel = document.getElementById('trainingFileName');
             if(tLabel) tLabel.innerText = this.state.trainingFileName || 'Vazio';

             // Main Toggle Button Logic
             const btn = document.getElementById('toggleBtn');
             if(btn) {
                if(this.state.assistantEnabled) {
                    btn.classList.add('active');
                    btn.title = "Assistant ON";
                } else {
                    btn.classList.remove('active');
                    btn.title = "Assistant OFF";
                }
             }
        },

        // Auto-bind inputs to state (Two-way binding feeling)
        bindEvents() {
            const bind = (id, key, type='text') => {
                const el = document.getElementById(id);
                if(!el) return;
                if(type === 'text' || type === 'select') {
                    el.addEventListener('input', (e) => this.set(key, e.target.value));
                } else if (type === 'checkbox') {
                    el.addEventListener('change', (e) => this.set(key, e.target.checked));
                }
            };

            bind('apiKeyInput', 'apiKey');
            bind('infodoseNameInput', 'infodoseName');
            bind('modelInput', 'modelName');
            bind('modelSelect', 'modelName', 'select');
            bind('assistantActiveCheckbox', 'assistantEnabled', 'checkbox');
            bind('trainingActiveCheckbox', 'trainingActive', 'checkbox');
            bind('zenModeCheckbox', 'zenMode', 'checkbox');

            // Special: Main Toggle Button
            document.getElementById('toggleBtn')?.addEventListener('click', () => {
                this.set('assistantEnabled', !this.state.assistantEnabled);
                showToaster(this.state.assistantEnabled ? 'Assistant ON' : 'Assistant OFF', 'default');
            });
            
            // Visual trigger on Top Info click
            document.getElementById('topInfo')?.addEventListener('click', () => {
                this.triggerVisualPulse();
                this.render(); // Force re-sync
            });
        },

        triggerVisualPulse() {
            const bar = document.getElementById('topInfo');
            if(bar) {
                bar.classList.remove('pulse-update');
                void bar.offsetWidth; // trigger reflow
                bar.classList.add('pulse-update');
            }
        },
        
        // Helper for AI Calls to get current snapshot
        getSnapshot() {
            return { ...this.state };
        }
    };

    // Global Chat Logic (Consuming the Engine)
    const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    const TEMPERATURE = 0.2;
    let conversation = [];
    let pages = [], currentPage = 0, autoAdvance = true;
    const CRYSTAL_KEY = 'di_cristalizados';

    const createEl = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

    // --- PATCH JS: substituir splitBlocks + renderPaginatedResponse + speakPage/changePage/showLoading ---

    /* simples parser markdown leve */
    function mdToHtml(md){
        if(!md) return '';
        md = md.replace(/```([^`]*)```/gs, (_, code) => '<pre><code>' + escapeHtml(code) + '</code></pre>');
        md = md.replace(/`([^`]+)`/g, (_, c) => '<code>' + escapeHtml(c) + '</code>');
        md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        md = md.replace(/(^|\n)[\-\*]\s+(.+?)(?=\n|$)/g, (_, pre, item) => pre + '<li>' + item + '</li>');
        md = md.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        const paras = md.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        return paras.map(p => '<p>' + p.replace(/\n/g,'<br>') + '</p>').join('');
    }

    const splitBlocks = text => {
        if (!text || !text.trim()) return [['Sem conteúdo.','','']];
        let paras = text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
        if (paras.length < 3 || paras.length % 3 !== 0) {
            const sens = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
            paras = sens.map(s=>s.trim()).filter(Boolean);
        }
        const groups = [];
        for (let i=0;i<paras.length;i+=3) groups.push(paras.slice(i,i+3));
        return groups;
    };

    const renderPaginatedResponse = text => {
        try { speechSynthesis.cancel(); } catch(e){}
        autoAdvance = true;
        const respEl = document.getElementById('response');
        Array.from(respEl.querySelectorAll('.page')).forEach(p => { if (!p.classList.contains('initial')) p.remove(); });
        pages = [];
        const groups = splitBlocks(text);
        const titles = ['🎁 Recompensa Inicial','👁️ Exploração e Curiosidade','⚡ Antecipação Vibracional'];

        groups.forEach((tris, gi) => {
            const page = createEl('div', gi===0 ? 'page active' : 'page');
            tris.forEach((body, j) => {
                const cls = j===0 ? 'intro' : j===1 ? 'middle' : 'ending';
                const htmlBody = mdToHtml(body);
                const b = createEl('div','response-block '+cls, `<h3>${titles[j]}</h3><div class="block-body">${htmlBody}</div>`);
                const meta = createEl('div','meta');
                const crystalBtn = createEl('button','crystal-btn','✶');
                crystalBtn.title = 'Cristalizar';
                crystalBtn.addEventListener('click', (ev)=>{
                    ev.stopPropagation();
                    cristalizar({ title: titles[j], content: body });
                    crystalBtn.innerText = '✓'; setTimeout(()=> crystalBtn.innerText = '✶', 1200);
                });
                meta.appendChild(crystalBtn);
                b.appendChild(meta);
                b.dataset.state = '';
                b.addEventListener('click', (ev) => {
                    if (ev.target.closest('.meta')) return;
                    const alreadySpoken = b.dataset.state === 'spoken';
                    if (!alreadySpoken) {
                        try { speechSynthesis.cancel(); } catch(e){}
                        const textToSpeak = b.querySelector('.block-body') ? b.querySelector('.block-body').innerText : body;
                        speakText(textToSpeak);
                        b.classList.add('clicked'); b.dataset.state = 'spoken';
                    } else {
                        b.classList.add('expanded'); b.dataset.state = '';
                        if (!FusionEngine.state.assistantEnabled) FusionEngine.set('assistantEnabled', true);
                        const blockText = `${titles[j]}\n\n${body}`;
                        showLoading('Pulso em Expansão...');
                        speakText('Pulso em Expansão...');
                        conversation.push({ role:'user', content: blockText });
                        callAI();
                    }
                });
                page.appendChild(b);
            });
            page.appendChild(createEl('p','footer-text',`<em>Do seu jeito. <strong>Sempre</strong> único. <strong>Sempre</strong> seu.</em>`));
            const controls = respEl.querySelector('.response-controls');
            if (controls && controls.parentNode) respEl.insertBefore(page, controls);
            else respEl.appendChild(page);
            pages.push(page);
        });
        currentPage = 0;
        const pi = document.getElementById('pageIndicator');
        if (pi) pi.textContent = `1 / ${pages.length}`;
        speakPage(0);
    };

    const speakText = (txt, onend)=> {
      if (!txt) { if (onend) onend(); return; }
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'pt-BR'; u.rate = 0.99; u.pitch = 1.1;
      if (window._vozes) u.voice = window._vozes.find(v=>v.lang==='pt-BR') || window._vozes[0];
      if (onend) u.onend = onend;
      speechSynthesis.speak(u);
    };

    const speakPage = i => {
        const page = pages[i]; if (!page) return;
        const body = Array.from(page.querySelectorAll('.block-body')).map(n => n.innerText).join(' ');
        speakText(body, () => {
            if (!autoAdvance) return;
            if (i < pages.length - 1) { changePage(1); speakPage(i+1); } else { speakText('Sempre único, sempre seu.'); }
        });
    };

    const changePage = offset => {
        const np = currentPage + offset; if (np<0 || np>=pages.length) return;
        if (pages[currentPage]) pages[currentPage].classList.remove('active');
        if (pages[np]) pages[np].classList.add('active');
        currentPage = np;
        const pi = document.getElementById('pageIndicator');
        if (pi) pi.textContent = `${currentPage+1} / ${pages.length}`;
    };

    const showLoading = msg => {
        const respEl = document.getElementById('response');
        const controls = respEl.querySelector('.response-controls');
        respEl.querySelectorAll('.page').forEach(p => { if(!p.classList.contains('initial')) p.remove(); });
        const page = createEl('div','page active'); page.appendChild(createEl('p','footer-text',msg));
        if (controls && controls.parentNode) respEl.insertBefore(page, controls);
        else respEl.appendChild(page);
        pages = [page];
        currentPage = 0;
        const pi = document.getElementById('pageIndicator');
        if (pi) pi.textContent = '…';
    };

    async function callAI() {
      const cfg = FusionEngine.getSnapshot();
      if (!cfg.apiKey) {
        alert('Nenhuma API Key ativa! Ative uma chave no Card (Cofre) ou no Painel.');
        return;
      }
      const bodyObj = { model: cfg.modelName, messages: conversation.slice(), temperature: TEMPERATURE };
      const messagesToSend = [];
      if (cfg.assistantEnabled && cfg.trainingActive && cfg.trainingText) messagesToSend.push({ role:'system', content: cfg.trainingText });
      conversation.forEach(m => { if (m.role !== 'system') messagesToSend.push(m); });
      bodyObj.messages = messagesToSend;

      try {
        const resp = await fetch(API_ENDPOINT, {
          method:'POST', headers:{ 'Authorization':`Bearer ${cfg.apiKey}`, 'Content-Type':'application/json' },
          body: JSON.stringify(bodyObj)
        });
        if (!resp.ok) throw new Error('Erro API: ' + resp.status);
        const data = await resp.json();
        const answer = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content.trim() : 'Resposta vazia';
        conversation.push({ role:'assistant', content: answer });
        renderPaginatedResponse(answer);
      } catch (err) {
        console.error(err);
        const errorMsg = 'Falha na conexão. Verifique se a chave está ativa.';
        conversation.push({ role:'assistant', content: errorMsg });
        renderPaginatedResponse(errorMsg);
      }
    }

    async function sendMessage(){
      const respEl = document.getElementById('response');
      const initPage = respEl.querySelector('.page.initial');
      if (initPage) initPage.remove();
      const input = document.getElementById('userInput');
      const raw = input.value.trim(); if (!raw) return;
      input.value = '';
      speechSynthesis.cancel(); speakText('');

      const cfg = FusionEngine.getSnapshot();

      if (raw.toLowerCase().includes('oi dual')) {
        FusionEngine.set('assistantEnabled', true);
        showLoading('Conectando Dual Infodose...');
        if (cfg.trainingText && cfg.trainingActive) conversation.unshift({ role:'system', content: cfg.trainingText });
      } else { showLoading('Processando...'); }
      conversation.push({ role:'user', content: raw });
      callAI();
    }
    
    function cristalizar({ title, content }) {
      const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]');
      const cfg = FusionEngine.getSnapshot();
      list.unshift({ id: Date.now(), title, content, user: document.getElementById('inputUser').value, infodose: cfg.infodoseName, at: new Date().toISOString() });
      localStorage.setItem(CRYSTAL_KEY, JSON.stringify(list)); refreshCrystalList();
    }
    function refreshCrystalList() {
      const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]');
      const el = document.getElementById('crystalList'); el.innerHTML = '';
      if (!list.length) { el.innerHTML = '<div class="small">Vazio.</div>'; return; }
      list.forEach(it => {
        const row = createEl('div','crystal-item');
        const left = createEl('div','','<strong>'+it.title+'</strong><div class="small">'+(it.infodose||'')+'</div><div style="margin-top:4px;font-size:0.8em">'+it.content.slice(0,100)+'...</div>');
        const actions = createEl('div','actions');
        const copyBtn = createEl('button','btn btn-sec','Copy'); copyBtn.onclick=()=>navigator.clipboard.writeText(it.content);
        const delBtn = createEl('button','btn btn-sec','Del'); delBtn.onclick=()=>{ 
            const arr=JSON.parse(localStorage.getItem(CRYSTAL_KEY)||'[]'); 
            localStorage.setItem(CRYSTAL_KEY, JSON.stringify(arr.filter(x=>x.id!==it.id))); refreshCrystalList(); 
        };
        actions.append(copyBtn, delBtn); row.append(left, actions); el.appendChild(row);
      });
    }

    // --- SETUP EVENTS ---
    document.addEventListener('DOMContentLoaded', async () => {
      speechSynthesis.onvoiceschanged = () => { window._vozes = speechSynthesis.getVoices(); };

      // Engine Start
      FusionEngine.init();

      try {
        particlesJS('particles-js',{ particles:{ number:{value:24},color:{value:['#0ff','#f0f']}, shape:{type:'circle'},opacity:{value:0.4},size:{value:2.4}, move:{enable:true,speed:1.5} }, retina_detect:true });
      } catch(e) { console.warn('particlesJS init failed', e); }

      document.getElementById('sendBtn').addEventListener('click', sendMessage);
      document.getElementById('userInput').addEventListener('keypress', e => { if (e.key==='Enter') sendMessage(); });
      document.querySelector('[data-action="prev"]').addEventListener('click', () => changePage(-1));
      document.querySelector('[data-action="next"]').addEventListener('click', () => changePage(1));

      // Button "Save Manual" just closes the modal now, since state is reactive
      document.getElementById('saveSystemBtn').addEventListener('click', () => {
         toggleSection('systemCard', false);
         showToaster('Configurações Persistidas', 'success');
      });

      // Crystal
      document.getElementById('crystalBtn').addEventListener('click', ()=>{ refreshCrystalList(); document.getElementById('crystalModal').classList.add('active'); });
      document.getElementById('closeCrystal').addEventListener('click', ()=>document.getElementById('crystalModal').classList.remove('active'));
      document.getElementById('exportAllCrystal').addEventListener('click', ()=>{
          const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY)||'[]');
          if(!list.length) return alert('Nada.');
          const b = new Blob([JSON.stringify(list,null,2)], {type:'application/json'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download='crystals.json'; a.click();
      });
      document.getElementById('clearAllCrystal').addEventListener('click', ()=>{ localStorage.removeItem(CRYSTAL_KEY); refreshCrystalList(); });

      // Copy/Paste Utils
      const copyBtn = document.querySelector('.control-btn.copy-button');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        try {
          const text = document.getElementById('response').innerText.trim();
          await navigator.clipboard.writeText(text);
          showToaster('Texto copiado', 'success');
        } catch (e) { showToaster('Falha ao copiar', 'error'); }
      });
      const pasteBtn = document.querySelector('.control-btn.paste-button');
      if (pasteBtn) pasteBtn.addEventListener('click', async () => {
        try {
          const txt = await navigator.clipboard.readText();
          const ui = document.getElementById('userInput');
          if (ui) { ui.value = txt; ui.focus(); showToaster('Conteúdo colado', 'success'); }
        } catch (e) { showToaster('Falha ao colar', 'error'); }
      });

      // Training Upload
      const trainingInput = document.getElementById('trainingUpload');
      const exportTrainingBtn = document.getElementById('exportTrainingBtn');
      if (trainingInput) {
        trainingInput.addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          const txt = await f.text();
          FusionEngine.set('trainingText', txt);
          FusionEngine.set('trainingFileName', f.name);
          showToaster('Treinamento carregado e salvo', 'success');
        });
      }
      if (exportTrainingBtn) {
        exportTrainingBtn.addEventListener('click', () => {
          const cfg = FusionEngine.getSnapshot();
          if (!cfg.trainingText) { showToaster('Nenhum treinamento', 'error'); return; }
          const b = new Blob([cfg.trainingText], { type: 'text/plain' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (cfg.trainingFileName||'training.txt'); a.click();
        });
      }

      // Keys Export
      const exportKeysBtn = document.getElementById('exportKeysBtn');
      if (exportKeysBtn) exportKeysBtn.addEventListener('click', () => {
        const b = new Blob([JSON.stringify(STATE.keys || [], null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'keys.json'; a.click();
      });
      // Keys Import
      const importKeysBtn = document.getElementById('importKeysBtn');
      const importFileInput = document.getElementById('importFileInput');
      if (importKeysBtn && importFileInput) {
        importKeysBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          try {
            const txt = await f.text();
            const parsed = JSON.parse(txt);
            if (!Array.isArray(parsed)) throw new Error('Formato inválido');
            STATE.keys = parsed;
            saveData(); renderKeysList(); showToaster('Chaves importadas', 'success');
          } catch (e) { showToaster('Erro ao importar', 'error'); }
        });
      }
    });

    // Mantra Toggle
    const mantraBtn = document.getElementById('mantra-toggle');
    const mantraText = document.getElementById('mantra-text');
    let mantraCollapsed = false;
    mantraBtn.addEventListener('click', () => {
      mantraCollapsed = !mantraCollapsed;
      if (mantraCollapsed) {
        mantraBtn.classList.add('collapsed'); document.body.classList.add('zen-mode');
        mantraText.classList.add('fade-out'); setTimeout(()=>{ mantraText.innerHTML = 'USE · TRANSFORME · DEVOLVA'; mantraText.classList.remove('fade-out'); },300);
      } else {
        mantraBtn.classList.remove('collapsed'); document.body.classList.remove('zen-mode');
        mantraText.classList.add('fade-out'); setTimeout(()=>{ mantraText.innerHTML = 'Do seu jeito. <strong>Sempre</strong> único. <strong>Sempre</strong> seu.'; mantraText.classList.remove('fade-out'); },300);
      }
    });
  