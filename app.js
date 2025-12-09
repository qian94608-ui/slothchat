document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 样式 (V67 稳定版) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --pepe-dark: #46960C; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 100px !important; }

        /* 头部 */
        .defi-header { 
            position: fixed; top: 0; left: 0; width: 100%; height: 60px; 
            background: #fff; z-index: 100; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center; padding: 0 15px; box-sizing: border-box;
        }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 20px; cursor: pointer; border: 1px solid #ddd; font-weight: 600; font-size: 14px; }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #eee; }

        /* 聊天视图 */
        #view-chat {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #F2F2F7; z-index: 600; 
            transform: translateX(100%); 
            transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex; flex-direction: column;
        }
        #view-chat.active { transform: translateX(0); }

        /* 消息列表 */
        #messages-container {
            flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
            padding: 15px; padding-bottom: 30px; 
            display: flex; flex-direction: column; gap: 12px;
        }

        /* 底部输入栏 */
        .chat-footer { 
            height: 70px; flex-shrink: 0; background: #fff; 
            display: flex; align-items: center; padding: 0 8px; 
            border-top: 1px solid #eee; z-index: 999; box-sizing: border-box; gap: 5px;
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
            z-index: 1000; box-shadow: 0 2px 5px rgba(89, 188, 16, 0.3);
        }
        #chat-send-btn:active { transform: scale(0.95); opacity: 0.9; }

        #voice-bar {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            border-radius: 20px; background: var(--danger); color: #fff; 
            font-weight: bold; font-size: 14px; display: none; 
            justify-content: center; align-items: center; z-index: 10; cursor: pointer;
        }
        #voice-bar.active { display: flex !important; }
        #voice-bar.recording { animation: pulse 1s infinite; background: #cc0000; }

        .hidden { display: none !important; }

        /* 列表项 */
        .k-list-item { 
            background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; position: relative; 
            cursor: pointer; z-index: 10; 
        }
        .k-list-item:active { background: #f5f5f5; transform: scale(0.98); }

        /* 气泡 */
        .msg-row { display: flex; width: 100%; }
        .msg-row.self { justify-content: flex-end; } 
        .msg-row.other { justify-content: flex-start; }
        .bubble { padding: 10px 14px; border-radius: 16px; max-width: 75%; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: 15px; line-height: 1.4; word-break: break-word; }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; border-bottom-right-radius: 4px; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; border-bottom-left-radius: 4px; }
        .bubble.clean { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }

        /* 语音消息 */
        .voice-bubble { display: flex; align-items: center; gap: 10px; min-width: 160px; padding: 5px 0; }
        .voice-play-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); display: flex; justify-content: center; align-items: center; cursor: pointer; color: inherit; }
        .msg-row.other .voice-play-btn { background: #f0f0f0; border-color: #ddd; color: var(--pepe-green); }
        .voice-track { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; position: relative; }
        .msg-row.other .voice-track { background: #eee; }
        .voice-progress { height: 100%; width: 0%; background: #fff; transition: width 0.2s; }
        .msg-row.other .voice-progress { background: var(--pepe-green); }

        /* 文件卡片 */
        .file-card { display: flex; align-items: center; gap: 12px; background: #fff; padding: 12px; border-radius: 12px; text-decoration: none; color: #333 !important; border: 1px solid #eee; width: 220px; box-sizing: border-box; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; }
        .file-icon { font-size: 24px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name { font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; }
        .file-type { font-size: 10px; color: #999; font-weight: 700; margin-top: 2px; }
        
        .thumb-img { max-width: 200px; border-radius: 12px; display: block; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; cursor: pointer; }

        /* 拨号盘 */
        .modal-overlay { z-index: 1000000 !important; background: rgba(0,0,0,0.85); }
        .numpad-container { padding: 20px; text-align: center; background: #fff; border-radius: 20px; }
        .id-display-screen { font-size: 40px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 6px; height: 60px; line-height: 60px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 70px; height: 70px; border-radius: 15px; background: #fff; border: 1px solid #eee; font-size: 28px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 0 #eee; color: #333; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); font-size: 36px; }

        .list-edit-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); padding: 10px; font-size: 18px; color: #ccc; z-index: 10; }
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--danger); color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 5; border: 2px solid #fff; }
        .drag-overlay { display: none; z-index: 99999; } .drag-overlay.active { display: flex; }
        @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.02);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v68_global_scope';
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
        
        const avatar = document.getElementById('my-avatar');
        avatar.src = './icon.png';
        avatar.onerror = () => { avatar.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`; };

        setupFooterHTML();
        setupDialpadHTML();
        
        renderFriends();
        setupStickers();
        renderInputZone(); 

        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
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

    // ★★★ 3. 全局暴露核心函数 (解决作用域问题) ★★★
    
    // 打开聊天
    window.openChat = (id) => {
        try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        isVoiceMode = false; renderInputZone();
        
        const view = document.getElementById('view-chat');
        view.classList.add('active');
        window.history.pushState({ chat: true }, "");
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
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
                    saveDB(); 
                    renderFriends(); 
                }
                window.closeAllModals();
                setTimeout(() => window.openChat(target), 50); // 调用全局 openChat
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
    
    // 其他全局函数
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble clean" style="color:red;font-size:12px">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; }
        if (t==='audio') c.innerHTML = `<audio src="${u}" controls autoplay style="width:80%;"></audio>`;
        else if (t==='image') c.innerHTML = `<img src="${u}" style="max-width:100%;max-height:100vh;">`;
        else c.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        m.classList.remove('hidden'); m.style.display='flex';
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.handleAudio = (act, u, id) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        const icon = document.getElementById(id); // span icon
        // 简单处理：如果找不到icon元素（比如传的是btn），尝试找子元素或自身
        
        if(act==='toggle') {
            if(globalAudio.src !== u) { globalAudio.src = u; globalAudio.play(); if(icon) icon.innerText='⏸'; }
            else { 
                if(globalAudio.paused) { globalAudio.play(); if(icon) icon.innerText='⏸'; } 
                else { globalAudio.pause(); if(icon) icon.innerText='▶'; } 
            }
            globalAudio.onended = () => { if(icon) icon.innerText='▶'; };
        }
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    window.editFriendName = () => { if(activeChatId) window.editContactAlias(activeChatId); };

    // --- 绑定 ---
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        dialInput = ""; setupDialpadHTML();
        const d = document.getElementById('dial-display'); if(d) d.innerText = "____";
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{ if(window.Html5Qrcode) { const s=new Html5Qrcode("qr-reader"); window.scanner=s; s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) { if(!db.friends.find(f=>f.id===t)) { db.friends.push({id:t, addedAt:Date.now(), alias:`User ${t}`}); saveDB(); renderFriends(); } window.openChat(t); } }); }); } }, 300);
    };
    document.querySelector('.user-pill').onclick = window.editMyName;
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    // --- 底部栏渲染 ---
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

    // --- 网络 ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { 
            document.getElementById('conn-status').className = "status-dot green"; 
            socket.emit('register', MY_ID); 
            isSending = false; processQueue();
        });
        
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f=>f.id===fid);
            if(!friend) { friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false }; db.friends.push(friend); }

            if(msg.type === 'tunnel_file_packet') {
                try { const p = JSON.parse(msg.content); handleTunnelPacket(p, fid, friend); } catch(e){} return;
            }
            const m = { type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName };
            saveAndNotify(fid, m, friend);
        });
    }

    function saveAndNotify(fid, msg, friend) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        saveDB();

        if(activeChatId === fid) {
            appendMsgDOM(msg);
        } else {
            if(friend) friend.unread = true; saveDB(); renderFriends();
            if(navigator.vibrate) navigator.vibrate(100);
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    // --- 文件传输 ---
    function handleTunnelPacket(p, fid, friend) {
        const safeName = p.fileName || "File_" + Date.now();
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:safeName, fileType:p.fileType, isVoice: p.isVoice };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, safeName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data);
            dl.receivedSize += Math.floor(p.data.length * 0.75);
            
            const now = Date.now();
            if(now - dl.lastTime > 500 && activeChatId === fid) {
                const spd = ((dl.receivedSize - dl.lastBytes)/1024)/((now - dl.lastTime)/1000);
                updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, spd);
                dl.lastTime = now; dl.lastBytes = dl.receivedSize;
            }
        } 
        else if(p.subType === 'end') {
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                
                let type = 'file';
                if (dl.isVoice || dl.fileName === 'voice.wav') type = 'voice';
                else if (dl.fileType.startsWith('image')) type = 'image';
                else if (dl.fileType.startsWith('video')) type = 'video';
                else if (dl.fileType.startsWith('audio')) type = 'file';

                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); saveDB();
                if(activeChatId !== fid && friend) { friend.unread = true; saveDB(); renderFriends(); }
                delete activeDownloads[p.fileId];
            }
        }
    }

    function addToQueue(file, isVoice = false) { uploadQueue.push({file, isVoice}); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; const item = uploadQueue.shift(); sendFileChunked(item.file, item.isVoice); }

    function sendFileChunked(file, isVoice) {
        if(!activeChatId || !socket.connected) { alert("Net Error"); return; }
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const total = file.size;
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset=0;
        const readNext = () => {
            if (cancelFlag[fileId] || !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }
            if (offset >= total) {
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify({ subType: 'end', fileId }) });
                
                let type = 'file';
                if(isVoice) type = 'voice';
                else if(file.type.startsWith('image')) type = 'image';
                else if(file.type.startsWith('video')) type = 'video';
                else if(file.type.startsWith('audio')) type = 'file';
                
                const m = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true, ts: Date.now() };
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
                    content: JSON.stringify({ subType: 'chunk', fileId, data: b64, fileName: sendName, fileType: file.type, totalSize: total, isVoice: isVoice })
                });
                offset += chunk.size;
                const now = Date.now();
                if(now - Date.now() > 500) { updateProgressUI(fileId, offset, total, 0); }
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    function traverseFileTree(item) {
        if (item.isFile) { item.file(file => addToQueue(file)); } 
        else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(entries => { for (let i=0; i<entries.length; i++) traverseFileTree(entries[i]); });
        }
    }

    // --- 7. 发送与返回 ---
    const handleSend = (e) => {
        if(e) e.preventDefault();
        const t = document.getElementById('chat-input');
        if(t && t.value.trim()){ sendData('text', t.value); t.value=''; t.focus(); }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keydown', e=>{if(e.key==='Enter') handleSend();});

    window.goBack = () => {
        if(history.state && history.state.chat) history.back();
        else closeChatUI();
    };
    function closeChatUI() {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        activeChatId = null; 
        renderFriends();
    }
    document.getElementById('chat-back-btn').onclick = window.goBack;
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        if(document.getElementById('view-chat').classList.contains('active')) closeChatUI();
    });

    document.getElementById('mode-switch-btn').onclick = () => { isVoiceMode = !isVoiceMode; renderInputZone(); };

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
                            <div class="voice-play-btn" onclick="handleAudio('toggle', '${msg.content}', 'icon-${uid}')">
                                <span id="icon-${uid}">▶</span>
                            </div>
                            <div class="voice-track"><div class="voice-progress"></div></div>
                            <a href="${msg.content}" download="voice.wav" style="text-decoration:none;color:inherit;font-size:12px;opacity:0.7">⬇</a>
                        </div>
                    </div>`;
        } 
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:24px;">▶</div></div></div>`;
        
        else if(msg.type === 'file') {
            if (msg.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)) {
                 html = `<div class="bubble clean">
                            <div class="file-card" onclick="previewMedia('${msg.content}', 'audio')">
                                <div class="file-icon">🎵</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK TO PLAY</div></div>
                            </div>
                        </div>`;
            } else {
                let icon = '📄';
                if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
                else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
                html = `<div class="bubble clean"><a class="file-card" href="${msg.content}" download="${msg.fileName}"><div class="file-icon">${icon}</div><div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK SAVE</div></div></a></div>`;
            }
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    const fIn = document.getElementById('chat-file-input'); fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false)); };
    
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId) {
            if(e.dataTransfer.items) for(let i=0; i<e.dataTransfer.items.length; i++) traverseFileTree(e.dataTransfer.items[i].webkitGetAsEntry());
            else if(e.dataTransfer.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false));
        }
    });

    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        for(let i=1; i<=12; i++) {
            const img = document.createElement('img'); img.src = `./s${i}.png`; 
            img.onerror = () => { img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i}`; };
            img.className='sticker-item'; img.onclick=()=>{ if(activeChatId){ sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); }};
            g.appendChild(i);
        }
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 录音
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{ 
        if(e.target.id !== 'voice-bar') return;
        e.preventDefault(); 
        try { 
            const s = await navigator.mediaDevices.getUserMedia({audio:true}); 
            let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; 
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; 
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; 
            rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f, true); s.getTracks().forEach(t=>t.stop()); }; 
            rec.start(); 
            e.target.innerText="RECORDING..."; e.target.classList.add('recording'); 
        } catch(e){alert("Mic Error");} 
    };
    const stopR = (e)=>{ 
        if(e.target.id !== 'voice-bar') return;
        e.preventDefault(); 
        if(rec&&rec.state!=='inactive'){ rec.stop(); e.target.innerText="HOLD TO SPEAK"; e.target.classList.remove('recording'); } 
    };
    document.body.addEventListener('mousedown', startR);
    document.body.addEventListener('mouseup', stopR);
    document.body.addEventListener('touchstart', startR);
    document.body.addEventListener('touchend', stopR);

    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML='';
        db.friends.forEach(f => {
            // ★ 核心：使用 onclick="window.openChat(...)"，确保能调用全局函数 ★
            const div = document.createElement('div'); div.className=`k-list-item ${f.unread?'shake-active':''}`;
            const statusHtml = f.unread ? `<div class="marquee-text">📢 MESSAGE COMING...</div>` : `<div style="font-size:12px;color:#999;">Tap to chat</div>`;
            div.innerHTML = `<div style="display:flex;align-items:center;gap:10px;" onclick="window.openChat('${f.id}')"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px;border-radius:10px;"><div style="flex:1;"><div style="font-weight:800;">${f.alias||f.id}</div>${statusHtml}</div><div class="list-edit-btn" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div></div>`;
            list.appendChild(div);
        });
    }

    initUI();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
