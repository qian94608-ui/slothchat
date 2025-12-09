document.addEventListener('DOMContentLoaded', () => {

    // --- 0. 样式 (V71: 完美层级) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --pepe-dark: #46960C; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; margin: 0; overflow: hidden; }
        
        .defi-nav { display: none !important; }
        .hidden { display: none !important; }

        /* 头部固定 */
        .defi-header { 
            position: fixed; top: 0; left: 0; width: 100%; height: 60px; 
            background: #fff; z-index: 1000; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center; padding: 0 15px; box-sizing: border-box;
        }

        /* 主页容器 */
        #view-home { height: 100vh; overflow-y: auto; background: var(--bg); }

        /* 聊天容器 (物理隔离) */
        #view-chat {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #F2F2F7; z-index: 2000; 
            transform: translateX(100%); 
            transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex; flex-direction: column;
        }
        #view-chat.active { transform: translateX(0); }

        /* 消息列表 */
        #messages-container {
            flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
            padding: 15px; padding-bottom: 120px !important; margin-top: 60px;
            display: flex; flex-direction: column; gap: 12px;
        }

        /* 底部输入栏 */
        .chat-footer { 
            position: absolute; bottom: 0; left: 0; width: 100%; height: 70px;
            background: #fff; border-top: 1px solid #eee; z-index: 3000; 
            display: flex; align-items: center; padding: 0 8px; box-sizing: border-box; gap: 5px;
        }
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
            width: 44px; height: 42px; border-radius: 20px; background: var(--pepe-green); 
            color: #fff; border: none; font-weight: bold; flex-shrink: 0; cursor: pointer;
            font-size: 16px; display: flex; justify-content: center; align-items: center;
            z-index: 3001; box-shadow: 0 2px 5px rgba(89, 188, 16, 0.3);
        }
        #chat-send-btn:active { transform: scale(0.95); opacity: 0.9; }

        /* 语音长按条 */
        #voice-bar {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            border-radius: 20px; background: var(--danger); color: #fff; 
            font-weight: bold; font-size: 14px; display: none; 
            justify-content: center; align-items: center; z-index: 10; cursor: pointer; user-select: none;
        }
        #voice-bar.active { display: flex !important; }
        #voice-bar.recording { animation: pulse 1s infinite; background: #cc0000; }

        /* 列表项 */
        .k-list-item { 
            background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 10px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; position: relative; 
            cursor: pointer; z-index: 10; display: flex; align-items: center; gap: 12px;
        }
        .k-list-item:active { background: #f5f5f5; }

        /* 气泡 */
        .msg-row { display: flex; width: 100%; }
        .msg-row.self { justify-content: flex-end; } .msg-row.other { justify-content: flex-start; }
        .bubble { padding: 10px 14px; border-radius: 16px; max-width: 75%; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: 15px; word-break: break-word; }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        .bubble.clean { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }

        /* 语音消息 (播放条) */
        .voice-bubble { display: flex; align-items: center; gap: 10px; min-width: 160px; padding: 5px 0; }
        .voice-play-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); display: flex; justify-content: center; align-items: center; cursor: pointer; color: inherit; }
        .msg-row.other .voice-play-btn { background: #f0f0f0; border-color: #ddd; color: var(--pepe-green); }
        .voice-track { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; }
        .msg-row.other .voice-track { background: #eee; }
        
        /* 音频/文件卡片 */
        .file-card { display: flex; align-items: center; gap: 12px; background: #fff; padding: 12px; border-radius: 12px; text-decoration: none; color: #333 !important; border: 1px solid #eee; width: 220px; box-sizing: border-box; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; }
        .file-icon { font-size: 24px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; }
        .file-type { font-size: 10px; color: #999; font-weight: 700; margin-top: 2px; }
        
        .thumb-img { max-width: 200px; border-radius: 12px; display: block; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; cursor: pointer; }

        /* 拨号盘 */
        .modal-overlay { z-index: 1000000 !important; background: rgba(0,0,0,0.85); }
        .numpad-container { padding: 20px; text-align: center; }
        .id-display-screen { font-size: 40px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 6px; height: 60px; line-height: 60px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 70px; height: 70px; border-radius: 15px; background: #fff; border: 1px solid #eee; font-size: 28px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 0 #eee; color: #333; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); font-size: 36px; }

        .list-edit-btn { margin-left: auto; padding: 10px; font-size: 18px; color: #ccc; }
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--danger); color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 5; border: 2px solid #fff; }
        .drag-overlay { display: none; z-index: 99999; } .drag-overlay.active { display: flex; }
        
        /* 进度条 */
        .progress-wrapper { background: #fff; padding: 10px; border-radius: 12px; border: 2px solid var(--pepe-green); min-width: 180px; color: #333; }
        .msg-row.self .progress-wrapper { background: var(--pepe-dark); color: #fff; border-color: #fff; }
        .progress-track { height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin: 8px 0; overflow: hidden; }
        .msg-row.self .progress-track { background: rgba(255,255,255,0.3); }
        .progress-fill { height: 100%; width: 0%; transition: width 0.1s; }
        .msg-row.self .progress-fill { background: #fff; }
        .msg-row.other .progress-fill { background: var(--pepe-green); }

        @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.02);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); background: #fff0f0; }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
    `;
    document.head.appendChild(styleSheet);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v71_id_fix';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId;
    let activeDownloads = {}, isSending = false, cancelFlag = {}, uploadQueue = [], globalAudio = null;
    let isVoiceMode = false, dialInput = "";

    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 初始化 ---
    const initUI = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        
        setupFooterHTML(); // 强制生成底部
        setupDialpadHTML(); // 强制生成拨号盘
        
        renderFriends();
        setupStickers();
        renderInputZone(); 

        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:150, height:150, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
        }, 500);
    };

    function setupFooterHTML() {
        const inputZone = document.querySelector('.input-zone');
        if (inputZone) {
            inputZone.innerHTML = `
                <input type="text" id="chat-input" placeholder="Type message..." />
                <div id="voice-bar">HOLD TO SPEAK</div>
            `;
        }
    }

    function setupDialpadHTML() {
        const body = document.querySelector('#add-overlay .modal-body');
        if(body) {
            body.innerHTML = `
                <div class="numpad-container">
                    <div id="dial-display" class="id-display-screen">____</div>
                    <div class="numpad-grid">
                        <div class="num-btn" onclick="window.dial(1)">1</div><div class="num-btn" onclick="window.dial(2)">2</div><div class="num-btn" onclick="window.dial(3)">3</div>
                        <div class="num-btn" onclick="window.dial(4)">4</div><div class="num-btn" onclick="window.dial(5)">5</div><div class="num-btn" onclick="window.dial(6)">6</div>
                        <div class="num-btn" onclick="window.dial(7)">7</div><div class="num-btn" onclick="window.dial(8)">8</div><div class="num-btn" onclick="window.dial(9)">9</div>
                        <div class="num-btn clear" onclick="window.dial('C')" style="color:var(--danger)">C</div>
                        <div class="num-btn" onclick="window.dial(0)">0</div>
                        <div class="num-btn connect" onclick="window.dial('OK')">🤝</div>
                    </div>
                </div>`;
        }
    }

    // --- 3. 全局函数 ---
    
    // 打开聊天
    window.openChat = (id) => {
        try {
            activeChatId = id;
            if(!document.getElementById('chat-input')) setupFooterHTML();

            const f = db.friends.find(x => x.id === id);
            document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
            
            isVoiceMode = false; renderInputZone();
            
            document.getElementById('view-chat').classList.add('active');
            window.history.pushState({ chat: true }, "");
            
            const box = document.getElementById('messages-container');
            box.innerHTML = '';
            const msgs = db.history[id] || [];
            msgs.forEach(m => appendMsgDOM(m));
        } catch(e) { console.error(e); }
    };

    // 拨号
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
        if(String(dialInput).length < 4) {
            dialInput += k;
            d.innerText = String(dialInput).padEnd(4,'_');
            if(navigator.vibrate) navigator.vibrate(30);
        }
    };
    
    // --- 界面渲染 ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread?'shake-active':''}`;
            // 绑定点击
            div.onclick = () => window.openChat(f.id);
            div.innerHTML = `
                <img class="header-avatar" style="width:45px;height:45px;border-radius:10px;" src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}">
                <div style="flex:1;margin-left:10px;">
                    <div style="font-weight:bold;font-size:16px;">${f.alias||f.id}</div>
                    <div style="font-size:12px;color:#999;">${f.unread?'📢 New Message!':'Tap to chat'}</div>
                </div>
                <div class="list-edit-btn" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div>
            `;
            list.appendChild(div);
        });
    }

    function renderInputZone() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const voiceBar = document.getElementById('voice-bar');
        const modeBtn = document.getElementById('mode-switch-btn');

        if (!input || !voiceBar) return;

        if (isVoiceMode) {
            input.style.display = 'none';
            sendBtn.style.display = 'none';
            voiceBar.classList.add('active');
            modeBtn.innerText = '⌨️';
        } else {
            input.style.display = 'block';
            sendBtn.style.display = 'flex';
            voiceBar.classList.remove('active');
            modeBtn.innerText = '🎤';
        }
    }

    // --- 网络与文件逻辑 ---
    // (Socket, Tunnel, Queue Logic same as V66/70, fully included here)
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { 
             document.getElementById('conn-status').style.background = 'green';
             socket.emit('register', MY_ID); 
             isSending = false; processQueue();
        });
        socket.on('disconnect', () => { document.getElementById('conn-status').style.background = 'red'; });
        
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
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        
        let f = db.friends.find(x => x.id === fid);
        if(!f) { f = {id:fid, addedAt:Date.now(), unread:true}; db.friends.push(f); }
        else if(activeChatId !== fid) { f.unread = true; }
        
        saveDB(); renderFriends();
        if(activeChatId === fid) appendMsgDOM(msg);
        else document.getElementById('msg-sound').play().catch(()=>{});
    }

    function handleTunnelPacket(p, fid) {
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], total:p.totalSize, cur:0, fileName:p.fileName||"File", fileType:p.fileType, isVoice:p.isVoice };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
            }
            activeDownloads[p.fileId].chunks.push(p.data);
            activeDownloads[p.fileId].cur += Math.floor(p.data.length * 0.75);
            if(activeChatId === fid) updateProgressUI(p.fileId, activeDownloads[p.fileId].cur, activeDownloads[p.fileId].total, 0);
        } else if(p.subType === 'end') {
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const b = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(b);
                let type = 'file';
                if(dl.isVoice || dl.fileName === 'voice.wav') type = 'voice';
                else if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'file'; // 音频文件

                const m = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, m);
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(m); saveDB();
                if(activeChatId !== fid) { renderFriends(); document.getElementById('msg-sound').play().catch(()=>{}); }
                delete activeDownloads[p.fileId];
            }
        }
    }

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
                else if(file.type.startsWith('audio')) type = 'file';
                
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
                        fileName: file.name, fileType: file.type, totalSize: total, isVoice: isVoice
                    })
                });
                offset += chunk.size;
                updateProgressUI(fileId, offset, total, 0);
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- DOM 渲染 ---
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);

        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div class="bubble clean"><img src="${msg.content}" class="sticker-img"></div>`;
        
        else if(msg.type === 'voice') {
            html = `<div class="bubble">
                        <div class="voice-bubble">
                            <div class="voice-play-btn" onclick="window.handleAudio('toggle', '${msg.content}', 'icon-${uid}')">
                                <span id="icon-${uid}">▶</span>
                            </div>
                            <div class="voice-track"><div class="voice-progress"></div></div>
                            <a href="${msg.content}" download="voice.wav" style="text-decoration:none;color:inherit;font-size:12px;">⬇</a>
                        </div>
                    </div>`;
        } 
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="window.previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="window.previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video></div></div>`;
        else if(msg.type === 'file') {
            if (msg.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)) {
                 html = `<div class="bubble clean">
                            <div class="file-card" onclick="window.previewMedia('${msg.content}', 'audio')">
                                <div class="file-icon">🎵</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK TO PLAY</div></div>
                            </div>
                        </div>`;
            } else {
                html = `<div class="bubble clean"><a class="file-card" href="${msg.content}" download="${msg.fileName}"><div class="file-icon">📄</div><div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK SAVE</div></div></a></div>`;
            }
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    // --- Helpers ---
    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble clean"><div class="progress-wrapper"><div style="font-weight:bold;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;">${fileName}</div><div class="progress-track"><div id="bar-${fileId}" class="progress-fill"></div></div><div class="cancel-btn" onclick="window.cancelTransfer('${fileId}', ${isSelf})">✕</div></div></div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
    function updateProgressUI(id, cur, total, spd) { const bar = document.getElementById(`bar-${id}`); if(bar) bar.style.width = `${Math.floor((cur/total)*100)}%`; }
    function replaceProgressWithContent(id, msg) { const row = document.getElementById(`progress-row-${id}`); if(row) { row.remove(); appendMsgDOM(msg); } }
    function sendData(type, content) { if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content, type }); const m = { type, content, isSelf: true, ts: Date.now() }; if(!db.history[activeChatId]) db.history[activeChatId] = []; db.history[activeChatId].push(m); saveDB(); appendMsgDOM(m); }
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // --- Globals ---
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble clean" style="color:red;font-size:12px">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal'); m.classList.remove('hidden');
        const c = document.getElementById('preview-container'); c.innerHTML='';
        if (t==='audio') c.innerHTML = `<audio src="${u}" controls autoplay style="width:80%;"></audio>`;
        else if (t==='image') c.innerHTML = `<img src="${u}" style="max-width:100%;max-height:100vh;">`;
        else c.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.handleAudio = (act, u, id) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        const icon = document.getElementById(id);
        if(act==='toggle') {
            if(globalAudio.src !== u) { globalAudio.src = u; globalAudio.play(); if(icon) icon.innerText='⏸'; }
            else { if(globalAudio.paused) { globalAudio.play(); if(icon) icon.innerText='⏸'; } else { globalAudio.pause(); if(icon) icon.innerText='▶'; } }
            globalAudio.onended = () => { if(icon) icon.innerText='▶'; };
        }
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };

    // --- Bindings ---
    document.getElementById('chat-send-btn').onclick = () => { const t=document.getElementById('chat-input'); if(t.value.trim()){ sendData('text', t.value); t.value=''; t.focus(); } };
    document.getElementById('chat-input').addEventListener('keydown', e=>{if(e.key==='Enter') document.getElementById('chat-send-btn').click();});
    
    document.getElementById('chat-back-btn').onclick = () => {
        if(history.state && history.state.chat) history.back(); else { document.getElementById('view-chat').classList.remove('active'); activeChatId = null; renderFriends(); }
    };
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        if(document.getElementById('view-chat').classList.contains('active')) { document.getElementById('view-chat').classList.remove('active'); activeChatId = null; renderFriends(); }
    });

    document.getElementById('mode-switch-btn').onclick = () => { isVoiceMode = !isVoiceMode; renderInputZone(); };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; setupDialpadHTML(); document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => { document.getElementById('qr-overlay').classList.remove('hidden'); };

    const fIn = document.getElementById('chat-file-input'); fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false)); };
    
    // Stickers
    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        for(let i=1; i<=12; i++) {
            const img = document.createElement('img'); img.src = `./s${i}.png`; 
            img.onerror = () => { img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i}`; };
            img.className='sticker-item'; img.onclick=()=>{ if(activeChatId){ sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); }};
            g.appendChild(img);
        }
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Rec
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{ 
        if(e.target.id !== 'voice-bar') return;
        e.preventDefault(); 
        try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f, true); s.getTracks().forEach(t=>t.stop()); }; rec.start(); e.target.innerText="RECORDING..."; e.target.classList.add('recording'); } catch(e){alert("Mic Error");} 
    };
    const stopR = (e)=>{ 
        if(e.target.id !== 'voice-bar') return;
        e.preventDefault(); 
        if(rec&&rec.state!=='inactive'){ rec.stop(); e.target.innerText="HOLD TO SPEAK"; e.target.classList.remove('
