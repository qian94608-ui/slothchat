document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (绿调回归 + 拨号盘样式) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.95);
            /* ★ 回归 Pepe 绿色 ★ */
            --primary: #59BC10; 
            --primary-dark: #46960C;
            --danger: #FF3B30;
            --bg-color: #F0F5F2;
        }

        body { background: var(--bg-color); font-family: -apple-system, BlinkMacSystemFont, sans-serif; -webkit-tap-highlight-color: transparent; }

        /* 强制隐藏旧导航 */
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 20px !important; }

        /* 列表项 */
        .k-list-item {
            background: #fff; border-radius: 16px; padding: 12px; margin-bottom: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.02);
            transition: transform 0.1s;
        }
        .k-list-item:active { transform: scale(0.98); background: #f9f9f9; }

        /* 拨号盘样式 (新功能) */
        .numpad-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
        .id-display-screen {
            font-size: 40px; font-weight: 800; letter-spacing: 8px; color: var(--primary);
            margin-bottom: 20px; min-height: 50px; text-align: center;
            border-bottom: 2px solid #eee; width: 80%;
        }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 280px; }
        .num-btn {
            width: 65px; height: 65px; border-radius: 50%; background: #fff;
            box-shadow: 0 4px 0 #eee; border: 1px solid #ddd;
            font-size: 24px; font-weight: bold; color: #333;
            display: flex; justify-content: center; align-items: center; cursor: pointer;
            transition: all 0.1s;
        }
        .num-btn:active { transform: translateY(4px); box-shadow: 0 0 0 #eee; background: var(--primary); color: #fff; }
        .num-btn.clear { color: var(--danger); font-size: 18px; }

        /* 气泡与消息 */
        .bubble { border: none !important; border-radius: 18px !important; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .msg-row.self .bubble { background: var(--primary); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; }
        
        /* 模态框修正 */
        .modal-header { background: var(--primary) !important; color: #fff; border:none; }
        .close-x { color: #fff !important; background: rgba(0,0,0,0.2) !important; }
        .modal-box { border-radius: 24px; overflow: hidden; border: none; }

        /* 动画 */
        @keyframes shake { 0%,100% {transform:translateX(0);} 25% {transform:translateX(-3px);} 75% {transform:translateX(3px);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); }
        
        /* 取消按钮 */
        .cancel-btn { position: absolute; top:-8px; right:-8px; background:var(--danger); color:#fff; width:22px; height:22px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:12px; z-index:10; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框HTML
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:99999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:100000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px;">✕</button>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据层 ---
    const DB_KEY = 'pepe_v33_green_dial';
    const CHUNK_SIZE = 12 * 1024;
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Init");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 拨号盘逻辑 (新功能) ---
    let dialInput = "";
    
    // 生成拨号盘 HTML 并注入到原有的 Add Modal 中
    const setupDialpad = () => {
        const modalBody = document.querySelector('#add-overlay .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="numpad-container">
                    <div id="dial-display" class="id-display-screen">____</div>
                    <div class="numpad-grid">
                        <div class="num-btn" onclick="dial(1)">1</div>
                        <div class="num-btn" onclick="dial(2)">2</div>
                        <div class="num-btn" onclick="dial(3)">3</div>
                        <div class="num-btn" onclick="dial(4)">4</div>
                        <div class="num-btn" onclick="dial(5)">5</div>
                        <div class="num-btn" onclick="dial(6)">6</div>
                        <div class="num-btn" onclick="dial(7)">7</div>
                        <div class="num-btn" onclick="dial(8)">8</div>
                        <div class="num-btn" onclick="dial(9)">9</div>
                        <div class="num-btn clear" onclick="dial('C')">C</div>
                        <div class="num-btn" onclick="dial(0)">0</div>
                        <div class="num-btn" style="background:none; border:none; box-shadow:none;"></div>
                    </div>
                </div>
            `;
        }
    };
    
    window.dial = (key) => {
        const display = document.getElementById('dial-display');
        if (key === 'C') {
            dialInput = "";
            display.innerText = "____";
            return;
        }
        
        if (dialInput.length < 4) {
            dialInput += key;
            display.innerText = dialInput.padEnd(4, '_');
            
            // ★ 输满4位自动握手
            if (dialInput.length === 4) {
                if(navigator.vibrate) navigator.vibrate(50);
                setTimeout(() => {
                    handleAddFriend(dialInput);
                    window.closeAllModals();
                    dialInput = ""; // 重置
                    display.innerText = "____";
                }, 200);
            }
        }
    };

    // --- 3. UI 初始化 ---
    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        setTimeout(() => {
            const qrEl = document.getElementById("qrcode");
            if(qrEl && window.QRCode) {
                qrEl.innerHTML = '';
                new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" });
            }
        }, 500);
    };
    renderProfile();
    setupDialpad(); // 初始化拨号盘

    // --- 4. 核心逻辑 (修复握手) ---
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB();
            renderFriends();
        }
        openChat(id); // ★ 强制打开聊天
    }

    // 绑定按钮事件
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        dialInput = ""; // 打开时清空
        document.getElementById('dial-display').innerText = "____";
    };
    
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader"); window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                if(navigator.vibrate) navigator.vibrate(200);
                scanner.stop().then(() => { window.closeAllModals(); if(txt.length === 4) handleAddFriend(txt); });
            }).catch(()=>{ alert("Cam Error"); window.closeAllModals(); });
        }, 300);
    };

    // --- 5. 网络与传输 (保持隧道协议) ---
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'], upgrade: false });
        
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };

        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            registerSocket();
            isSending = false;
        });
        
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (socket.disconnected) socket.connect(); else registerSocket(); } });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) {
                friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false };
                db.friends.push(friend);
            }

            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                friend.unread = true;
                saveDB();
                renderFriends();
                if('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    const v = window.speechSynthesis.getVoices().find(v=>v.name.includes('Female'));
                    if(v) u.voice = v;
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate([100,50,100]);
            }

            // 隧道接收
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    if(p.subType === 'chunk') {
                        if(activeDownloads[p.fileId] === 'cancelled') return;
                        if(!activeDownloads[p.fileId]) {
                            activeDownloads[p.fileId] = {
                                chunks:[], totalSize:p.totalSize, receivedSize:0,
                                lastBytes:0, lastTime:Date.now(), fileName:p.fileName, fileType:p.fileType
                            };
                            if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
                        }
                        const dl = activeDownloads[p.fileId];
                        dl.chunks.push(p.data);
                        dl.receivedSize += Math.floor(p.data.length * 0.75);
                        const now = Date.now();
                        if(now - dl.lastTime > 500) {
                            const spd = ((dl.receivedSize - dl.lastBytes)/1024)/((now-dl.lastTime)/1000);
                            updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, spd);
                            dl.lastBytes = dl.receivedSize; dl.lastTime = now;
                        }
                    } else if(p.subType === 'end') {
                        if(activeDownloads[p.fileId] === 'cancelled') return;
                        const dl = activeDownloads[p.fileId];
                        if(dl) {
                            const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                            const url = URL.createObjectURL(blob);
                            let type = 'file';
                            if(dl.fileType.startsWith('image')) type = 'image';
                            else if(dl.fileType.startsWith('video')) type = 'video';
                            else if(dl.fileType.startsWith('audio')) type = 'voice';
                            const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                            replaceProgressWithContent(p.fileId, finalMsg);
                            if(!db.history[fid]) db.history[fid] = [];
                            db.history[fid].push({...finalMsg, content: '[File Saved]', type: 'text'}); saveDB();
                            delete activeDownloads[p.fileId];
                            document.getElementById('success-sound').play().catch(()=>{});
                        }
                    }
                } catch(e){}
                return;
            }

            if(msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB();
                if(activeChatId === fid) appendMsgDOM(msg, false);
            }
        });
    }

    // --- 6. 发送逻辑 (隧道) ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket || !socket.connected) { alert("Connect first"); return; }
        if(isSending) { alert("Busy"); return; }
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0; let lastTime = Date.now(); let lastBytes = 0; const total = file.size;
        const readNext = () => {
            if(cancelFlag[fileId] || !socket.connected) { isSending = false; return; }
            if(offset >= total) {
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify({ subType: 'end', fileId }) });
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                const finalMsg = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
                replaceProgressWithContent(fileId, finalMsg);
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push({...finalMsg, content: '[File Sent]', type: 'text'}); saveDB();
                isSending = false; return;
            }
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({ subType: 'chunk', fileId, data: b64, fileName: sendName, fileType: sendType, totalSize: total })
                });
                offset += chunk.size;
                const now = Date.now();
                if(now - lastTime > 200) {
                    const spd = ((offset - lastBytes)/1024)/((now - lastTime)/1000);
                    updateProgressUI(fileId, offset, total, spd);
                    lastTime = now; lastBytes = offset;
                }
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- 7. UI Helpers ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            let nameHtml = `<div style="font-weight:bold; font-size:16px;">${f.alias||f.id}</div>`;
            if(f.unread) nameHtml = `<div style="display:flex;align-items:center;gap:5px;"><div style="font-weight:bold;">${f.alias||f.id}</div><div class="marquee-container"><div class="marquee-text">📢 MESSAGE COMING...</div></div></div>`;
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; height:45px; border-radius:50%;">
                    <div style="flex:1;">${nameHtml}<div style="font-size:12px; color:#888;">${f.unread?'<span style="color:red">● New Message</span>':'Click to chat'}</div></div>
                </div>`;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('chat-online-dot').className = "status-dot red"; // Reset
        document.getElementById('view-chat').classList.remove('right-sheet');
        document.getElementById('view-chat').classList.add('active');
        const box = document.getElementById('messages-container'); box.innerHTML = '';
        const msgs = db.history[id] || []; msgs.forEach(m => appendMsgDOM(m, m.isSelf));
    }

    function appendMsgDOM(msg, isSelf) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);
        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<div class="bubble" style="background:transparent;box-shadow:none;"><img src="${msg.content}" class="sticker-img" style="width:100px;"></div>`;
        else if(msg.type==='voice') html=`<div id="v-${uid}" class="bubble voice-bubble ${isSelf?'':'other'}" style="cursor:pointer;display:flex;align-items:center;gap:5px;" onclick="playVoice('${msg.content}','v-${uid}')"><span>▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px;"><div class="thumb-box"><img src="${msg.content}" class="thumb-img" onclick="previewMedia('${msg.content}','image')"></div></div>`;
        else if(msg.type==='video') html=`<div class="bubble" style="padding:4px;"><div class="thumb-box" style="background:#000;height:80px;display:flex;align-items:center;justify-content:center;" onclick="previewMedia('${msg.content}','video')"><span style="color:#fff;font-size:24px;">▶</span></div></div>`;
        else if(msg.type==='file') html=`<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}">Download</a></div>`;
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold;margin-bottom:4px;overflow:hidden;">${isSelf?'⬆':'⬇'} ${fileName}</div>
                <div style="background:#eee;height:6px;border-radius:3px;overflow:hidden;"><div id="bar-${fileId}" style="width:0%;height:100%;background:${isSelf?'#59BC10':'#46960C'};transition:width 0.1s;"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:2px;opacity:0.6;"><span id="spd-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span></div>
            </div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function updateProgressUI(id, cur, total, spd) {
        const bar = document.getElementById(`bar-${id}`);
        const spdEl = document.getElementById(`spd-${id}`);
        const pctEl = document.getElementById(`pct-${id}`);
        if(bar) {
            const p = total>0 ? Math.floor((cur/total)*100) : 0;
            bar.style.width = `${p}%`; pctEl.innerText = `${p}%`; spdEl.innerText = `${spd.toFixed(1)} KB/s`;
        }
    }

    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg, msg.isSelf); }
    }

    // --- Utils ---
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal');
        const c = document.getElementById('preview-container');
        c.innerHTML = '';
        let el;
        if(type==='image') { el=document.createElement('img'); el.src=url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; }
        else { el=document.createElement('video'); el.src=url; el.controls=true; el.autoplay=true; el.style.maxWidth='100%'; }
        if(el) { c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; window.history.pushState({p:1},""); }
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };
    window.cancelTransfer = (id, isSelf) => {
        if(isSelf) cancelFlag[id] = true; else activeDownloads[id] = 'cancelled';
        const row = document.getElementById(`progress-row-${id}`);
        if(row) row.innerHTML = `<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>`;
    };
    window.playVoice = (url, id) => {
        const a = new Audio(url); a.play();
        const b = document.getElementById(id);
        if(b) { b.classList.add('playing'); a.onended = () => b.classList.remove('playing'); }
    };
    window.switchTab = (id) => {
        if(id === 'tab-identity') return;
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
    };
    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
        renderFriends();
    };
    function b64toBlob(b64, type) {
        try {
            const bin = atob(b64); const arr = new Uint8Array(bin.length);
            for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], {type});
        } catch(e) { return new Blob([], {type}); }
    }

    // --- Inputs ---
    document.getElementById('chat-send-btn').onclick = () => { const t = document.getElementById('chat-input'); if(t.value) { sendData('text', t.value); t.value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    
    // Mode Switch
    const modeBtn = document.getElementById('mode-switch-btn');
    let isVoice = false;
    modeBtn.onclick = () => {
        isVoice = !isVoice;
        const vBtn = document.getElementById('voice-record-btn');
        const tBox = document.getElementById('text-input-wrapper');
        if(isVoice) { tBox.classList.add('hidden'); tBox.style.display='none'; vBtn.classList.remove('hidden'); vBtn.style.display='block'; modeBtn.innerText="⌨️"; }
        else { vBtn.classList.add('hidden'); vBtn.style.display='none'; tBox.classList.remove('hidden'); tBox.style.display='flex'; modeBtn.innerText="🎤"; }
    };

    // File
    const fIn = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files[0]) sendFileChunked(e.target.files[0]); fIn.value=''; };

    // Sticker
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<10; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        img.className='sticker-item'; img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Drag
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId && e.dataTransfer.files[0]) {
            const f = e.dataTransfer.files[0];
            if(!f.type && f.size%4096===0) alert("No Folders"); else sendFileChunked(f);
        }
    });

    document.body.onclick = () => document.getElementById('msg-sound').load();
});
