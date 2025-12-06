document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // =========================================================
    // 0. 样式定义 (严格审查过的 UI 规范)
    // =========================================================
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --pepe-dark: #46960C; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
        
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 80px !important; } /* 给底部留足空间 */

        /* 头部 */
        .defi-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; z-index: 100; position: relative; border-bottom: 1px solid #eee; }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 20px; cursor: pointer; border: 1px solid #ddd; }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ddd; object-fit: cover; }

        /* ★ 底部栏 (防挤压终极修复) ★ */
        .chat-footer { 
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; 
            background: #fff; display: flex; align-items: center; padding: 0 8px; 
            border-top: 1px solid #eee; z-index: 500; box-sizing: border-box;
        }
        /* 核心：所有功能键禁止压缩 */
        .footer-tool, #sticker-btn, #file-btn, #mode-switch-btn { 
            width: 40px; height: 40px; border-radius: 50%; background: #f2f2f2; 
            border: 1px solid #ddd; font-size: 20px; flex-shrink: 0; margin: 0 3px; 
            display: flex; justify-content: center; align-items: center; cursor: pointer;
        }

        /* 输入区自适应 */
        .input-zone { flex: 1; position: relative; height: 42px; margin: 0 4px; display: flex; min-width: 0; }
        
        /* 文本框容器 */
        .text-wrapper { 
            width: 100%; height: 100%; display: flex; align-items: center; 
            position: absolute; top: 0; left: 0; z-index: 20; background: #fff; 
            transition: opacity 0.1s;
        }
        .text-wrapper.hidden { display: none !important; }
        
        /* 语音按钮 */
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 21px; background: var(--danger); 
            color: #fff; font-weight: bold; border: none; font-size: 14px;
            position: absolute; top: 0; left: 0; z-index: 10; 
            display: none; cursor: pointer;
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }

        #chat-input { flex: 1; height: 100%; border-radius: 20px; background: #f9f9f9; border: 1px solid #ddd; padding: 0 12px; outline: none; font-size: 16px; min-width: 0; }
        .send-arrow { width: 40px; height: 40px; border-radius: 50%; background: var(--pepe-green); color: #fff; border: none; font-weight: bold; flex-shrink: 0; margin-left: 5px; cursor: pointer; }

        /* 气泡系统 */
        .k-list-item { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; position: relative; }
        .bubble { padding: 10px 14px; border-radius: 16px; max-width: 75%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        
        /* ★ 特殊气泡 (去除背景，防止丑陋边框) ★ */
        .bubble.clean { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
        
        .thumb-box { border-radius: 12px; overflow: hidden; background: #000; max-width: 200px; display: block; }
        .thumb-img { width: 100%; height: auto; display: block; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; display: block; }
        
        /* ★ 文档卡片 (自适应修复) ★ */
        .doc-card { 
            display: flex; align-items: center; gap: 10px; 
            background: #fff; padding: 10px; border-radius: 10px; 
            text-decoration: none; color: #333; border: 1px solid #eee; 
            width: auto; min-width: 180px; max-width: 100%; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .doc-icon { font-size: 24px; flex-shrink: 0; }
        .doc-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; min-width: 0; }
        .doc-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .doc-type { font-size: 9px; opacity: 0.6; text-transform: uppercase; font-weight: 700; margin-top: 2px; }

        /* ★ 进度条 (修复颜色反向) ★ */
        .progress-wrapper { background: #fff; padding: 10px; border-radius: 10px; border: 2px solid var(--pepe-green); min-width: 160px; }
        .msg-row.self .progress-wrapper { background: var(--pepe-green); color: #fff; border: 2px solid #fff; }
        .progress-track { height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin: 5px 0; overflow: hidden; }
        .msg-row.self .progress-track { background: rgba(255,255,255,0.3); }
        .progress-fill { height: 100%; width: 0%; transition: width 0.1s; }
        .msg-row.self .progress-fill { background: #fff; }
        .msg-row.other .progress-fill { background: var(--pepe-green); }

        /* 音频 */
        .audio-player { display: flex; align-items: center; gap: 8px; min-width: 140px; }
        .audio-btn { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4); color: inherit; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .msg-row.other .audio-btn { background: #f0f0f0; border-color: #ddd; color: #333; }

        /* 模态框 */
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.8); }
        .numpad-container { padding: 15px; text-align: center; }
        .id-display-screen { font-size: 36px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 4px; height: 50px; line-height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 60px; height: 60px; border-radius: 12px; background: #fff; box-shadow: 0 4px 0 #ddd; border: 2px solid #eee; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); }

        /* 动效 */
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); background: #fff0f0; }
        .marquee-box { overflow: hidden; max-width: 140px; white-space: nowrap; display: inline-block; vertical-align: middle; }
        .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 4s linear infinite; color: var(--danger); font-size: 10px; font-weight: 900; }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
        @keyframes scroll { 100% { transform: translateX(-100%); } }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.05);} }
        
        .list-edit-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #ccc; font-size: 18px; padding: 5px; z-index: 10; }
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; background: var(--danger); color: #fff; border-radius: 50%; font-size: 12px; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 5; border: 2px solid #fff; }
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据初始化 ---
    const DB_KEY = 'pepe_v52_audit_final';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId;
    let activeDownloads = {}, isSending = false, cancelFlag = {}, uploadQueue = [], globalAudio = null;

    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 界面初始化 ---
    const initUI = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        
        renderFriends();
        setupDialpad();
        setupStickers(); // 初始化表情
        
        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
        }, 500);
    };

    // --- 3. 网络核心 (隧道模式) ---
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
            if(!friend) {
                friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false };
                db.friends.push(friend);
            }

            // ★ 1. 隧道文件处理 ★
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    handleTunnelPacket(p, fid, friend);
                } catch(e) { console.error(e); }
                return; 
            }

            // 2. 普通消息
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
            if(navigator.vibrate) navigator.vibrate([100,50,100]);
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    // ★ 核心：隧道接收逻辑 (修复双重显示) ★
    function handleTunnelPacket(p, fid, friend) {
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                // 强制使用包内的文件名，防止 undefined
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:p.fileName || "Unknown", fileType:p.fileType };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
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
                
                // ★ 1. 仅替换进度条 (不追加) ★
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                
                // ★ 2. 仅存库，不触发通知 (防止重复) ★
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); 
                saveDB();
                
                // 后台通知
                if(activeChatId !== fid && friend) {
                    friend.unread = true; saveDB(); renderFriends();
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
                
                delete activeDownloads[p.fileId];
                document.getElementById('success-sound').play().catch(()=>{});
            }
        }
    }

    // --- 4. 发送逻辑 ---
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; const file = uploadQueue.shift(); sendFileChunked(file); }

    function sendFileChunked(file) {
        if(!activeChatId || !socket.connected) { alert("Net Error"); return; }
        isSending = true;
        
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        const total = file.size;
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset=0, lastTime=Date.now(), lastBytes=0;
        const readNext = () => {
            if (cancelFlag[fileId] || !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }
            if (offset >= total) {
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify({ subType: 'end', fileId }) });
                
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                
                const m = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true, ts: Date.now() };
                replaceProgressWithContent(fileId, m); // 替换进度条
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(m); saveDB(); // 仅存库
                
                isSending = false; setTimeout(processQueue, 300); return;
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

    function traverseFileTree(item) {
        if (item.isFile) { item.file(file => addToQueue(file)); }
        else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(entries => { for (let i=0; i<entries.length; i++) traverseFileTree(entries[i]); });
        }
    }

    // --- 5. 界面交互 ---
    function openChat(id) {
        try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";
        
        window.history.pushState({ chat: true }, "");
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    window.goBack = () => {
        if(history.state && history.state.chat) history.back();
        else {
            document.getElementById('view-chat').classList.remove('active');
            setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
            activeChatId = null; renderFriends();
        }
    };
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null; renderFriends();
    });

    // ★ 渲染逻辑 (修复卡片样式) ★
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        
        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div class="bubble clean"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type === 'voice') {
            html = `<div class="bubble audio-player"><span>🎤</span><button class="audio-btn" onclick="handleAudio('play','${msg.content}')">▶</button><button class="audio-btn" onclick="handleAudio('pause')">⏸</button><button class="audio-btn" onclick="handleAudio('stop')">⏹</button></div>`;
        } 
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:24px;">▶</div></div></div>`;
        else if(msg.type === 'file') {
            let icon = '📄';
            if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
            else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
            else if(msg.fileName.match(/\.(ppt|pptx)$/i)) icon='📉';
            // 使用 clean bubble 防止背景溢出
            html = `<div class="bubble clean"><a class="doc-card" href="${msg.content}" download="${msg.fileName}"><div class="doc-icon">${icon}</div><div class="doc-info"><div class="doc-name">${msg.fileName}</div><div class="doc-type">CLICK TO SAVE</div></div></a></div>`;
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        // 使用 clean bubble 避免样式冲突
        div.innerHTML = `<div class="bubble clean"><div class="progress-wrapper"><div style="font-weight:bold;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;">${fileName || 'Sending...'}</div><div class="progress-track"><div id="bar-${fileId}" class="progress-fill"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;"><span id="spd-${fileId}">0K/s</span><span id="pct-${fileId}">0%</span></div><div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div></div></div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function updateProgressUI(id, cur, total, spd) {
        const bar = document.getElementById(`bar-${id}`);
        if(bar) {
            const p = Math.floor((cur/total)*100);
            bar.style.width = `${p}%`;
            document.getElementById(`pct-${id}`).innerText = `${p}%`;
            document.getElementById(`spd-${id}`).innerText = `${spd.toFixed(1)} KB/s`;
        }
    }
    
    // 替换函数 (直接 replaceChild 避免追加)
    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) {
            const newDiv = document.createElement('div');
            newDiv.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
            let html = '';
            if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
            else if(msg.type === 'file') {
                 let icon = '📄';
                 if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
                 html = `<div class="bubble clean"><a class="doc-card" href="${msg.content}" download="${msg.fileName}"><div class="doc-icon">${icon}</div><div class="doc-info"><div class="doc-name">${msg.fileName}</div><div class="doc-type">CLICK TO SAVE</div></div></a></div>`;
            }
            newDiv.innerHTML = html;
            row.replaceWith(newDiv);
        } else {
            appendMsgDOM(msg); // 兜底
        }
    }

    // --- 6. 杂项 ---
    const handleSend = () => { const t=document.getElementById('chat-input'); if(t.value.trim()){ sendData('text', t.value); t.value=''; }};
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', e=>{if(e.key==='Enter') handleSend();});
    document.getElementById('chat-back-btn').onclick = window.goBack;

    document.getElementById('mode-switch-btn').onclick = () => {
        const t = document.getElementById('text-input-wrapper'); const v = document.getElementById('voice-record-btn'); const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); v.classList.remove('active'); b.innerText="🎤"; } 
        else { t.classList.add('hidden'); v.classList.add('active'); b.innerText="⌨️"; }
    };

    const fIn = document.getElementById('chat-file-input'); fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); };
    
    // 拨号盘握手修复
    let dialInput = "";
    const setupDialpad = () => {
        document.querySelector('#add-overlay .modal-body').innerHTML = `<div class="numpad-container"><div id="dial-display" class="id-display-screen">____</div><div class="numpad-grid"><div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div><div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div><div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div><div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div><div class="num-btn connect" onclick="dial('OK')">🤝</div></div></div>`;
    };
    window.dial = k => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { 
            if(dialInput.length===4 && dialInput!==MY_ID) { 
                const target = dialInput;
                window.closeAllModals();
                if(!db.friends.find(f=>f.id===target)) { db.friends.push({id:target, addedAt:Date.now(), alias:`User ${target}`}); saveDB(); renderFriends(); }
                openChat(target);
                dialInput=""; d.innerText="____";
            } else alert("Invalid"); return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };

    // 其他
    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        // 使用本地或稳定CDN
        const gifs = ["https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif", "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif", "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif", "https://media.tenor.com/9y_9y_9yAAAAi/pepe-happy.gif"];
        gifs.forEach(s=>{
            const i=document.createElement('img'); i.src=s; i.className='sticker-item'; i.style.cssText="width:60px;height:60px;object-fit:contain;cursor:pointer;";
            i.onclick=()=>{ if(activeChatId){ sendData('sticker', s); document.getElementById('sticker-panel').classList.add('hidden'); }};
            g.appendChild(i);
        });
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{ if(window.Html5Qrcode) { const s=new Html5Qrcode("qr-reader"); window.scanner=s; s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) { if(!db.friends.find(f=>f.id===t)) { db.friends.push({id:t, addedAt:Date.now(), alias:`User ${t}`}); saveDB(); renderFriends(); } openChat(t); } }); }); } }, 300);
    };
    
    // Drag
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId) {
            if(e.dataTransfer.items) for(let i=0; i<e.dataTransfer.items.length; i++) traverseFileTree(e.dataTransfer.items[i].webkitGetAsEntry());
            else if(e.dataTransfer.files.length) Array.from(e.target.files).forEach(addToQueue);
        }
    });
    
    // Voice
    const vBtn = document.getElementById('voice-record-btn'); let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}}; document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{ e.preventDefault(); try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f); s.getTracks().forEach(t=>t.stop()); }; rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording'); } catch(e){alert("Mic Error");} };
    const stopR = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; } };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR); vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble clean" style="color:red;font-size:12px">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => { const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML=''; const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; } c.innerHTML = t==='image' ? `<img src="${u}" style="max-width:100%;max-height:100vh;">` : `<video src="${u}" controls autoplay style="max-width:100%;"></video>`; m.classList.remove('hidden'); m.style.display='flex'; };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.playVoice = (u,id) => { const a = new Audio(u); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    window.handleAudio = (act, u) => { if(!globalAudio) globalAudio=new Audio(); if(act==='play') { globalAudio.src=u; globalAudio.play(); } else if(act==='pause') globalAudio.pause(); else { globalAudio.pause(); globalAudio.currentTime=0; } };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }
    function renderFriends() { const list = document.getElementById('friends-list-container'); list.innerHTML=''; db.friends.forEach(f => { const div = document.createElement('div'); div.className=`k-list-item ${f.unread?'shake-active':''}`; const statusHtml = f.unread ? `<div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div>` : `<div style="font-size:12px;color:#999;">Tap to chat</div>`; div.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px;border-radius:10px;"><div style="flex:1;"><div style="font-weight:800;">${f.alias||f.id}</div>${statusHtml}</div><div class="list-edit-btn" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div></div>`; div.onclick = () => openChat(f.id); list.appendChild(div); }); }

    initUI();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
