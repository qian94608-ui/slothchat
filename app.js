document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. CSS REWRITE (Addressing UI Chaos) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { 
            --pepe-green: #59BC10; 
            --pepe-dark: #46960C; 
            --bg: #F2F2F7; 
            --danger: #FF3B30; 
            --white: #ffffff;
            --black: #000000;
            --gray: #888888;
        }
        
        body { background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        .defi-nav { display: none !important; }
        
        /* --- LAYOUT CONTAINERS --- */
        
        /* 1. Header (Fixed Top) */
        .defi-header { 
            position: fixed; top: 0; left: 0; width: 100%; height: 60px; 
            background: var(--white); z-index: 1000; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center; padding: 0 15px; box-sizing: border-box;
        }
        .user-pill { display: flex; align-items: center; gap: 8px; background: #f5f5f5; padding: 4px 12px; border-radius: 20px; border: 1px solid #ddd; font-weight: 600; font-size: 14px; cursor: pointer; }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #eee; }

        /* 2. Chat View (Sliding Panel) */
        #view-chat {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: var(--bg); z-index: 2000; /* Above Home */
            transform: translateX(100%); 
            transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex; flex-direction: column;
        }
        #view-chat.active { transform: translateX(0); }

        /* 3. Messages Area (Scrollable) */
        #messages-container {
            flex: 1; 
            overflow-y: auto; 
            -webkit-overflow-scrolling: touch;
            padding: 15px; 
            /* Critical Fix: Huge bottom padding to clear the footer */
            padding-bottom: 120px !important; 
            display: flex; flex-direction: column; gap: 12px;
            margin-top: 60px; /* Clear Header */
        }

        /* 4. Footer (Fixed Bottom) */
        .chat-footer { 
            position: absolute; bottom: 0; left: 0; width: 100%; height: 70px;
            background: var(--white); border-top: 1px solid #eee; z-index: 3000; 
            display: flex; align-items: center; padding: 0 10px; box-sizing: border-box; gap: 8px;
        }

        /* --- CONTROLS & INPUTS --- */
        
        .footer-tool, #sticker-btn, #file-btn, #mode-switch-btn { 
            width: 42px; height: 42px; border-radius: 50%; background: #f2f2f2; 
            border: 1px solid #ddd; font-size: 20px; flex-shrink: 0; 
            display: flex; justify-content: center; align-items: center; cursor: pointer; color: #555;
        }

        .input-zone { flex: 1; position: relative; height: 42px; display: flex; align-items: center; min-width: 0; }
        
        #chat-input { 
            width: 100%; height: 100%; border-radius: 20px; background: #f9f9f9; 
            border: 1px solid #ddd; padding: 0 15px; outline: none; font-size: 16px; color: #000;
        }
        
        #chat-send-btn { 
            width: 44px; height: 44px; border-radius: 50%; background: var(--pepe-green); 
            color: #fff; border: none; font-weight: bold; flex-shrink: 0; cursor: pointer;
            font-size: 16px; display: flex; justify-content: center; align-items: center;
            z-index: 3001; /* Topmost */ box-shadow: 0 2px 5px rgba(89, 188, 16, 0.3);
        }
        #chat-send-btn:active { transform: scale(0.95); opacity: 0.9; }

        #voice-bar {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            border-radius: 20px; background: var(--danger); color: #fff; 
            font-weight: bold; font-size: 14px; display: none; 
            justify-content: center; align-items: center; z-index: 10; cursor: pointer; user-select: none;
        }
        #voice-bar.active { display: flex !important; }
        #voice-bar.recording { animation: pulse 1s infinite; background: #cc0000; }

        /* --- BUBBLES & CONTENT --- */

        .msg-row { display: flex; width: 100%; }
        .msg-row.self { justify-content: flex-end; } 
        .msg-row.other { justify-content: flex-start; }
        
        .bubble { 
            padding: 10px 14px; border-radius: 16px; max-width: 75%; 
            position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
            font-size: 15px; line-height: 1.4; word-break: break-word; 
        }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; border-bottom-right-radius: 4px; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; border-bottom-left-radius: 4px; }
        
        .bubble.clean { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }

        /* --- AUDIO PLAYER FIX (Proper Layout) --- */
        .voice-bubble { 
            display: flex; align-items: center; gap: 12px; 
            min-width: 180px; padding: 4px 0; 
        }
        .voice-play-btn { 
            width: 36px; height: 36px; border-radius: 50%; 
            background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.3); 
            display: flex; justify-content: center; align-items: center; 
            cursor: pointer; color: inherit; font-size: 14px;
        }
        .msg-row.other .voice-play-btn { background: #f0f0f0; border-color: #ddd; color: var(--pepe-green); }
        
        .voice-controls { display: flex; align-items: center; gap: 8px; }
        .voice-stop-btn { font-size: 12px; cursor: pointer; opacity: 0.8; }
        
        .voice-track { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; position: relative; min-width: 60px; }
        .msg-row.other .voice-track { background: #e0e0e0; }
        
        .voice-progress { height: 100%; width: 0%; background: #fff; transition: width 0.2s; }
        .msg-row.other .voice-progress { background: var(--pepe-green); }

        /* --- PROGRESS BAR FIX (Readable Colors) --- */
        .progress-wrapper { 
            padding: 12px; border-radius: 12px; min-width: 200px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
            display: flex; flex-direction: column; gap: 6px;
        }
        /* Self: Green bg, White Text */
        .msg-row.self .progress-wrapper { 
            background: var(--pepe-green); color: #fff; border: 1px solid var(--pepe-dark); 
        }
        /* Other: White bg, Black Text */
        .msg-row.other .progress-wrapper { 
            background: #fff; color: #333; border: 1px solid #ddd; 
        }
        
        .progress-info { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        
        .progress-track { height: 6px; border-radius: 3px; overflow: hidden; width: 100%; background: rgba(0,0,0,0.1); }
        .msg-row.self .progress-track { background: rgba(255,255,255,0.3); }
        
        .progress-fill { height: 100%; width: 0%; transition: width 0.1s linear; }
        .msg-row.self .progress-fill { background: #fff; }
        .msg-row.other .progress-fill { background: var(--pepe-green); }
        
        .progress-meta { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.8; }
        .cancel-btn { 
            width: 20px; height: 20px; background: var(--danger); color: #fff; 
            border-radius: 50%; display: flex; justify-content: center; align-items: center; 
            cursor: pointer; font-size: 10px; margin-left: auto; border: 1px solid #fff;
        }

        /* --- CARDS & MEDIA --- */
        .file-card { display: flex; align-items: center; gap: 12px; background: #fff; padding: 12px; border-radius: 12px; text-decoration: none; color: #333 !important; border: 1px solid #eee; width: 220px; box-sizing: border-box; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; }
        .file-icon { font-size: 26px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #000; }
        .file-type { font-size: 10px; color: #888; font-weight: 700; margin-top: 2px; text-transform: uppercase; }

        .thumb-img { max-width: 220px; border-radius: 12px; display: block; border: 1px solid #eee; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; cursor: pointer; }

        /* --- LIST & DIALPAD --- */
        .k-list-item { 
            background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 10px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; position: relative; 
            cursor: pointer; z-index: 10; display: flex; align-items: center; gap: 12px;
        }
        .k-list-item:active { background: #f9f9f9; transform: scale(0.99); }
        .list-avatar { width: 45px; height: 45px; border-radius: 12px; border: 1px solid #eee; object-fit: cover; }
        .list-info { flex: 1; }
        .list-name { font-weight: 800; font-size: 16px; color: #333; }
        .list-status { font-size: 12px; color: #999; margin-top: 2px; }
        .list-edit { color: #ccc; font-size: 18px; padding: 5px; }

        .modal-overlay { z-index: 1000000 !important; background: rgba(0,0,0,0.85); }
        .numpad-container { padding: 20px; text-align: center; background: #fff; border-radius: 20px; width: 100%; max-width: 320px; margin: 0 auto; }
        .id-display-screen { font-size: 40px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 6px; height: 60px; line-height: 60px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 100%; height: 70px; border-radius: 15px; background: #fff; border: 1px solid #eee; font-size: 28px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 0 #eee; color: #333; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); font-size: 32px; }
        
        .drag-overlay { display: none; z-index: 99999; } .drag-overlay.active { display: flex; }
        .hidden { display: none !important; }
        
        @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.02);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); background: #fff0f0; }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. CONFIG & STATE ---
    const DB_KEY = 'pepe_v70_ui_fix';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId;
    let activeDownloads = {}, isSending = false, cancelFlag = {}, uploadQueue = [], globalAudio = null;
    let isVoiceMode = false, dialInput = "";

    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error();
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. GLOBAL EXPORTS (HTML Calls) ---
    window.openChat = (id) => {
        try {
            activeChatId = id;
            if(!document.getElementById('chat-input')) renderInputZone(); // Defensive

            const f = db.friends.find(x => x.id === id);
            document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
            
            // Show view
            const view = document.getElementById('view-chat');
            view.classList.add('active');
            window.history.pushState({ chat: true }, ""); // History entry
            
            // Reset Input
            isVoiceMode = false; renderInputZone();

            // Load Msgs
            const box = document.getElementById('messages-container');
            box.innerHTML = '';
            const msgs = db.history[id] || [];
            msgs.forEach(m => appendMsgDOM(m));
            
        } catch(e) { console.error(e); }
    };

    window.dial = (k) => {
        const d = document.getElementById('dial-display');
        if(!d) return;
        if(k === 'C') { dialInput = ""; d.innerText = "____"; return; }
        
        if(k === 'OK') { 
            const inputStr = String(dialInput);
            if(inputStr.length === 4) {
                if(inputStr === MY_ID) { alert("No Self-Chat"); return; }
                const target = inputStr;
                if(!db.friends.find(f=>f.id===target)) { 
                    db.friends.push({id:target, addedAt:Date.now(), alias:`User ${target}`, unread:false}); 
                    saveDB(); renderFriends(); 
                }
                window.closeAllModals();
                setTimeout(() => window.openChat(target), 50);
                dialInput = ""; d.innerText = "____";
            } else alert("Enter 4 Digits");
            return; 
        }
        if(String(dialInput).length < 4) { dialInput += k; d.innerText = String(dialInput).padEnd(4,'_'); }
    };

    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    
    // Audio Player Toggle (New Logic for Voice Note)
    window.handleAudio = (act, u, id) => {
        if(!globalAudio) globalAudio = new Audio();
        const icon = document.getElementById(id);
        
        if(act === 'toggle') {
            if(globalAudio.src !== u) { 
                globalAudio.src = u; 
                globalAudio.play(); 
                if(icon) icon.innerText='⏸'; 
            } else {
                if(globalAudio.paused) { 
                    globalAudio.play(); 
                    if(icon) icon.innerText='⏸'; 
                } else { 
                    globalAudio.pause(); 
                    if(icon) icon.innerText='▶'; 
                }
            }
            globalAudio.onended = () => { if(icon) icon.innerText='▶'; };
        } 
        else if (act === 'stop') {
            globalAudio.pause(); 
            globalAudio.currentTime=0; 
            if(icon) icon.innerText='▶';
        }
    };

    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal'); m.classList.remove('hidden');
        const c = document.getElementById('preview-container'); c.innerHTML='';
        const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; }
        
        if(t==='image') c.innerHTML=`<img src="${u}" style="max-width:100%;max-height:100vh;">`;
        else if(t==='video') c.innerHTML=`<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        else if(t==='audio') c.innerHTML=`<audio src="${u}" controls autoplay style="width:80%;"></audio>`;
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.cancelTransfer = (fid, self) => { 
        if(self) cancelFlag[fid]=true; else activeDownloads[fid]='cancelled'; 
        const el = document.getElementById(`progress-row-${fid}`); if(el) el.remove(); 
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    window.editFriendName = () => { if(activeChatId) window.editContactAlias(activeChatId); };

    // --- 3. UI RENDERERS ---
    
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread?'shake-active':''}`;
            div.onclick = () => window.openChat(f.id); // Direct binding
            const status = f.unread ? `<span style="color:var(--danger)">New Message!</span>` : `<span style="color:#999">Tap to chat</span>`;
            div.innerHTML = `
                <img class="list-avatar" src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}">
                <div class="list-info"><div class="list-name">${f.alias||f.id}</div><div class="list-status">${status}</div></div>
                <div class="list-edit" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div>
            `;
            list.appendChild(div);
        });
    }

    function setupDialpadHTML() {
        const body = document.querySelector('#add-overlay .modal-body');
        if(body) {
            body.innerHTML = `
                <div class="numpad-container">
                    <div id="dial-display" class="id-display-screen">____</div>
                    <div class="numpad-grid">
                        <div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div>
                        <div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div>
                        <div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div>
                        <div class="num-btn clear" onclick="dial('C')" style="color:var(--danger)">C</div>
                        <div class="num-btn" onclick="dial(0)">0</div>
                        <div class="num-btn connect" onclick="dial('OK')">🤝</div>
                    </div>
                </div>`;
        }
    }

    function renderInputZone() {
        const zone = document.querySelector('.input-zone');
        if(!zone) return;
        zone.innerHTML = ''; // Clear

        if(isVoiceMode) {
            // Voice Bar
            const btn = document.createElement('div');
            btn.id = 'voice-bar';
            btn.innerText = "HOLD TO SPEAK";
            // Touch events
            btn.onmousedown = startRec; btn.onmouseup = stopRec;
            btn.ontouchstart = startRec; btn.ontouchend = stopRec;
            zone.appendChild(btn);
            
            document.getElementById('mode-switch-btn').innerText = "⌨️";
            document.getElementById('chat-send-btn').style.display = 'none';
        } else {
            // Text Input
            const input = document.createElement('input');
            input.id = 'chat-input';
            input.type = 'text';
            input.placeholder = "Type message...";
            input.onkeydown = (e) => { if(e.key === 'Enter') handleSend(); };
            zone.appendChild(input);
            
            document.getElementById('mode-switch-btn').innerText = "🎤";
            document.getElementById('chat-send-btn').style.display = 'flex';
            
            // Auto focus on desktop
            if(activeChatId && !/Android|iPhone/i.test(navigator.userAgent)) setTimeout(()=>input.focus(), 100);
        }
    }

    // --- 4. MESSAGE DOM ---
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);

        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div class="bubble clean"><img src="${msg.content}" class="sticker-img"></div>`;
        
        // Voice Note (Play/Pause/Stop)
        else if(msg.type === 'voice') {
            html = `<div class="bubble">
                        <div class="voice-bubble" id="vp-${uid}">
                            <div class="voice-play-btn" onclick="window.handleAudio('toggle','${msg.content}','icon-${uid}')"><span id="icon-${uid}">▶</span></div>
                            <div class="voice-controls">
                                <span class="voice-stop-btn" onclick="window.handleAudio('stop','${msg.content}','icon-${uid}')">⏹</span>
                            </div>
                            <div class="voice-track"><div class="voice-progress"></div></div>
                            <a href="${msg.content}" download="voice.wav" style="color:inherit;font-size:12px;text-decoration:none;">⬇</a>
                        </div>
                    </div>`;
        }
        
        // Image/Video
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video></div></div>`;
        
        // Files / Audio Files
        else if(msg.type === 'file') {
            if(msg.fileName.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                // Audio Card
                html = `<div class="bubble clean">
                            <div class="file-card" onclick="window.previewMedia('${msg.content}','audio')">
                                <div class="audio-card-icon">🎵</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK TO PLAY</div></div>
                            </div>
                        </div>`;
            } else {
                // Doc Card
                html = `<div class="bubble clean">
                            <a class="file-card" href="${msg.content}" download="${msg.fileName}">
                                <div class="file-icon">📄</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK SAVE</div></div>
                            </a>
                        </div>`;
            }
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    // Progress Bar (Correct Colors)
    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble clean">
                <div class="progress-wrapper">
                    <div class="progress-info">${fileName}</div>
                    <div class="progress-track"><div id="bar-${fileId}" class="progress-fill"></div></div>
                    <div class="progress-meta">
                        <span id="pct-${fileId}">0%</span>
                        <div class="cancel-btn" onclick="window.cancelTransfer('${fileId}', ${isSelf})">✕</div>
                    </div>
                </div>
            </div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
    function updateProgressUI(id, cur, total, spd) { 
        const bar = document.getElementById(`bar-${id}`); 
        if(bar) {
            const pct = Math.floor((cur/total)*100);
            bar.style.width = `${pct}%`; 
            const p = document.getElementById(`pct-${id}`); if(p) p.innerText = `${pct}%`;
        }
    }
    function replaceProgressWithContent(id, msg) { const row = document.getElementById(`progress-row-${id}`); if(row) { row.remove(); appendMsgDOM(msg); } }

    // --- 5. NETWORK & TUNNEL ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { socket.emit('register', MY_ID); isSending = false; processQueue(); });
        socket.on('receive_msg', (msg) => {
            if(msg.type === 'tunnel_file_packet') {
                try { handleTunnelPacket(JSON.parse(msg.content), msg.from); } catch(e){}
            } else {
                const m = { type: msg.type, content: msg.content, fileName: msg.fileName, isSelf: false, ts: Date.now() };
                saveAndNotify(msg.from, m);
            }
        });
    }

    function saveAndNotify(fid, msg) {
        let f = db.friends.find(x => x.id === fid);
        if(!f) { f = {id:fid, addedAt:Date.now(), unread:true}; db.friends.push(f); }
        else if(activeChatId !== fid) { f.unread = true; }
        
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        saveDB(); renderFriends();
        
        if(activeChatId === fid) appendMsgDOM(msg);
        else document.getElementById('msg-sound').play().catch(()=>{});
    }

    function handleTunnelPacket(p, fid) {
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], total:p.totalSize, cur:0, name:p.fileName, type:p.fileType, isVoice:p.isVoice };
                if(activeChatId===fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
            }
            activeDownloads[p.fileId].chunks.push(p.data);
            activeDownloads[p.fileId].cur += Math.floor(p.data.length * 0.75); // approx
            if(activeChatId===fid) updateProgressUI(p.fileId, activeDownloads[p.fileId].cur, activeDownloads[p.fileId].total, 0);
        } 
        else if(p.subType === 'end') {
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const b = b64toBlob(dl.chunks.join(''), dl.type);
                const url = URL.createObjectURL(b);
                let type = 'file';
                // Detect type from meta
                if(dl.isVoice) type = 'voice';
                else if(dl.type.startsWith('image')) type = 'image';
                else if(dl.type.startsWith('video')) type = 'video';
                
                const m = { type, content: url, fileName: dl.name, isSelf: false, ts: Date.now() };
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, m);
                saveAndNotify(fid, m);
                delete activeDownloads[p.fileId];
            }
        }
    }
    
    // --- 6. UPLOAD QUEUE ---
    function addToQueue(file, isVoice = false) { uploadQueue.push({file, isVoice}); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; const item = uploadQueue.shift(); sendFileChunked(item.file, item.isVoice); }

    function sendFileChunked(file, isVoice) {
        if(!activeChatId || !socket.connected) { alert("Offline"); return; }
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const total = file.size;
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, file.name, true);
        
        let offset=0;
        const readNext = () => {
            if (cancelFlag[fileId]) { isSending = false; setTimeout(processQueue, 500); return; }
            if (offset >= total) {
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify({ subType: 'end', fileId }) });
                
                let type = 'file';
                if(isVoice) type = 'voice';
                else if(file.type.startsWith('image')) type = 'image';
                else if(file.type.startsWith('video')) type = 'video';
                
                const m = { type, content: URL.createObjectURL(file), fileName: file.name, isSelf: true, ts: Date.now() };
                replaceProgressWithContent(fileId, m);
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(m); saveDB();
                
                isSending = false; setTimeout(processQueue, 300); return;
            }
            
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({
                        subType: 'chunk', fileId, data: b64,
                        fileName: file.name, fileType: file.type, totalSize: total,
                        isVoice: isVoice
                    })
                });
                offset += chunk.size;
                updateProgressUI(fileId, offset, total, 0);
                setTimeout(readNext, 20); // Throttled
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }
    
    function sendData(type, content) {
        if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content, type });
        const m = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(m); saveDB(); appendMsgDOM(m);
    }
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // --- 7. INTERACTIONS ---
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t && t.value.trim()){ sendData('text', t.value); t.value=''; t.focus(); }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    
    // Back Button (History Fallback)
    document.getElementById('chat-back-btn').onclick = () => {
        if(history.state && history.state.chat) history.back();
        else {
            document.getElementById('view-chat').classList.remove('active');
            activeChatId = null; renderFriends();
        }
    };
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        if(document.getElementById('view-chat').classList.contains('active')) {
            document.getElementById('view-chat').classList.remove('active');
            activeChatId = null; renderFriends();
        }
    });

    document.getElementById('mode-switch-btn').onclick = () => { isVoiceMode = !isVoiceMode; renderInputZone(); };

    // Dialpad Open
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        dialInput = ""; setupDialpadHTML();
        const d = document.getElementById('dial-display'); if(d) d.innerText = "____";
    };

    // File Input
    const fIn = document.getElementById('chat-file-input'); fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false)); };
    
    // Drag
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId && e.dataTransfer.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false));
    });

    // Stickers
    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        for(let i=1; i<=12; i++) {
            const img = document.createElement('img'); img.src = `./s${i}.png`; 
            img.onerror = () => { img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i}`; };
            img.className='sticker-item'; img.style.width='60px';
            img.onclick=()=>{ if(activeChatId){ sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); }};
            g.appendChild(i);
        }
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Recording (Vars)
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startRec = async(e)=>{ 
        e.preventDefault(); try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f, true); s.getTracks().forEach(t=>t.stop()); }; rec.start(); e.target.innerText="RECORDING..."; e.target.classList.add('recording'); } catch(e){alert("Mic Error");} 
    };
    const stopRec = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); e.target.innerText="HOLD TO SPEAK"; e.target.classList.remove('recording'); } };

    // --- Init ---
    initUI();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
