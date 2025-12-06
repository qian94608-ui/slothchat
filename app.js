document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 样式定义 (UI 规范实现) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: sans-serif; -webkit-tap-highlight-color: transparent; }
        
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 50px !important; }

        /* 布局框架 */
        .chat-footer { 
            position: absolute; bottom: 0; left: 0; right: 0; height: 60px; 
            background: #fff; display: flex; align-items: center; padding: 0 10px; 
            border-top: 1px solid #eee; z-index: 200; 
        }
        .footer-tool, #mode-switch-btn, #sticker-btn, #file-btn { 
            width: 40px; height: 40px; border-radius: 50%; background: #f0f0f0; 
            border: none; font-size: 20px; flex-shrink: 0; margin: 0 3px;
            display: flex; justify-content: center; align-items: center;
        }
        .input-zone { flex: 1; position: relative; height: 40px; margin: 0 5px; }
        .text-wrapper { width: 100%; height: 100%; display: flex; align-items: center; position: absolute; top: 0; left: 0; z-index: 20; background: #fff; }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { flex: 1; height: 100%; border-radius: 20px; background: #f9f9f9; border: 1px solid #ddd; padding: 0 15px; outline: none; }
        .send-arrow { width: 40px; height: 40px; border-radius: 50%; background: var(--pepe-green); color: #fff; border: none; font-weight: bold; margin-left: 5px; }
        
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 20px; background: var(--danger); 
            color: #fff; font-weight: bold; border: none; position: absolute; top: 0; left: 0; z-index: 10; display: none; 
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }

        /* 消息气泡基础 */
        .k-list-item { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
        .bubble { padding: 10px 14px; border-radius: 18px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        
        /* ★ 图片预览样式 (去除黑边) ★ */
        .thumb-box { 
            position: relative; display: inline-block; 
            border-radius: 8px; overflow: hidden; 
            line-height: 0; /* 消除底部间隙 */
        }
        .thumb-img { 
            max-width: 180px; max-height: 240px; 
            width: auto; height: auto; 
            display: block; object-fit: cover;
        }
        
        /* ★ 视频预览样式 (加播放标) ★ */
        .video-thumb-container {
            position: relative; display: inline-block;
        }
        .play-overlay {
            position: absolute; top: 50%; left: 50%; 
            transform: translate(-50%, -50%);
            color: rgba(255,255,255,0.9); font-size: 32px; 
            text-shadow: 0 2px 4px rgba(0,0,0,0.5); pointer-events: none;
        }

        /* ★ 音频播放器样式 (三键控制) ★ */
        .audio-player { display: flex; align-items: center; gap: 6px; min-width: 160px; }
        .audio-btn { 
            width: 30px; height: 30px; border-radius: 50%; 
            background: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.4); 
            color: inherit; display: flex; justify-content: center; align-items: center; 
            font-size: 12px; cursor: pointer; padding: 0;
        }
        .msg-row.other .audio-btn { background: #eee; border: 1px solid #ddd; color: #333; }
        .audio-playing { animation: pulse 1s infinite; }

        /* ★ 办公文档卡片样式 ★ */
        .doc-card { 
            display: flex; align-items: center; gap: 10px; 
            background: rgba(255,255,255,0.95); padding: 10px; 
            border-radius: 8px; text-decoration: none; color: #333; 
            min-width: 200px; border: 1px solid #eee; 
        }
        .msg-row.self .doc-card { color: #000; } /* 发送方也是黑色字 */
        .doc-icon { font-size: 28px; flex-shrink: 0; }
        .doc-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
        .doc-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-type { font-size: 10px; color: #666; margin-top: 2px; font-weight: 900; text-transform: uppercase; }

        /* 表情 */
        .sticker-img { width: 100px !important; height: 100px !important; object-fit: contain; display: block; }

        /* 弹窗 */
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.8); }
        .numpad-container { padding: 10px; text-align: center; }
        .id-display-screen { font-size: 36px; color: var(--pepe-green); border-bottom: 2px solid #eee; margin-bottom: 20px; font-weight: 900; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 60px; height: 60px; border-radius: 12px; background: #fff; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; box-shadow: 0 3px 0 #eee; border: 1px solid #ddd;}
        .num-btn.connect { background: var(--pepe-green); color: #fff; }
        
        /* 拖拽与进度 */
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; background: var(--danger); color: #fff; border-radius: 50%; font-size: 12px; display: flex; justify-content: center; align-items: center; }
        .list-edit-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #ccc; padding: 10px; font-size: 18px; z-index: 10; }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.05);} }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据与状态 ---
    const DB_KEY = 'pepe_v49_logic_strict';
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

    // --- 2. 核心渲染逻辑 (严格对应您的需求) ---
    
    // ★ 消息渲染器 (核心) ★
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);

        if(msg.type === 'text') {
            html = `<div class="bubble">${msg.content}</div>`;
        } 
        else if(msg.type === 'sticker') {
            // 表情：无气泡背景，直接显示
            html = `<div style="padding:5px;"><img src="${msg.content}" class="sticker-img"></div>`;
        }
        else if(msg.type === 'voice') {
            // 音频：三键控制
            html = `
                <div class="bubble audio-player" id="player-${uid}">
                    <button class="audio-btn" onclick="handleAudio('play', '${msg.content}', 'player-${uid}')">▶</button>
                    <button class="audio-btn" onclick="handleAudio('pause', '${msg.content}', 'player-${uid}')">⏸</button>
                    <button class="audio-btn" onclick="handleAudio('stop', '${msg.content}', 'player-${uid}')">⏹</button>
                    <div style="font-size:10px; opacity:0.7;">Voice</div>
                </div>`;
        }
        else if(msg.type === 'image') {
            // 图片：点击全屏
            html = `
                <div class="bubble" style="padding:4px; background:transparent; box-shadow:none;">
                    <div class="thumb-box" onclick="previewMedia('${msg.content}','image')">
                        <img src="${msg.content}" class="thumb-img">
                    </div>
                </div>`;
        }
        else if(msg.type === 'video') {
            // 视频：显示首帧缩略图 + 播放图标
            html = `
                <div class="bubble" style="padding:4px; background:transparent; box-shadow:none;">
                    <div class="thumb-box video-thumb-container" onclick="previewMedia('${msg.content}','video')">
                        <video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video>
                        <div class="play-overlay">▶</div>
                    </div>
                </div>`;
        }
        else if(msg.type === 'file') {
            // 文档：卡片式设计
            let icon = '📄';
            let typeLabel = 'FILE';
            const lower = msg.fileName.toLowerCase();
            if(lower.match(/\.(doc|docx)$/)) { icon='📝'; typeLabel='WORD'; }
            else if(lower.match(/\.(xls|xlsx|csv)$/)) { icon='📊'; typeLabel='EXCEL'; }
            else if(lower.match(/\.(ppt|pptx)$/)) { icon='📉'; typeLabel='PPT'; }
            else if(lower.match(/\.pdf$/)) { icon='📕'; typeLabel='PDF'; }
            else if(lower.match(/\.zip|rar|7z$/)) { icon='📦'; typeLabel='ARCHIVE'; }

            html = `
                <div class="bubble" style="padding:5px; background:transparent; box-shadow:none;">
                    <a class="doc-card" href="${msg.content}" download="${msg.fileName}">
                        <div class="doc-icon">${icon}</div>
                        <div class="doc-info">
                            <div class="doc-name">${msg.fileName}</div>
                            <div class="doc-type">${typeLabel} · CLICK TO SAVE</div>
                        </div>
                    </a>
                </div>`;
        }
        
        div.innerHTML = html;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    // --- 3. 网络与隧道 ---
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
            if(!db.friends.find(f=>f.id===fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false });
            }
            const friend = db.friends.find(f=>f.id===fid);

            // 隧道文件
            if(msg.type === 'tunnel_file_packet') {
                try { const p = JSON.parse(msg.content); handleTunnelPacket(p, fid, friend); } catch(e){} return;
            }

            // 普通消息
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

    function handleTunnelPacket(p, fid, friend) {
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:p.fileName, fileType:p.fileType };
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
        } 
        else if(p.subType === 'end') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                
                // 类型判定
                let type = 'file';
                if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'voice';

                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                saveAndNotify(fid, finalMsg, friend);
                delete activeDownloads[p.fileId];
            }
        }
    }

    // --- 4. 发送逻辑 (队列) ---
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
            dirReader.readEntries(entries => {
                for (let i=0; i<entries.length; i++) traverseFileTree(entries[i]);
            });
        }
    }

    // --- UI 辅助 ---
    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble" style="min-width:160px;"><div>${isSelf?'⬆':'⬇'} ${fileName}</div><div style="background:#eee;height:5px;margin:4px 0;"><div id="bar-${fileId}" style="width:0%;height:100%;background:#59BC10;"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;"><span id="spd-${fileId}">0K/s</span><span id="pct-${fileId}">0%</span></div><div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div></div>`;
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
    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg); }
    }
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // --- 交互 ---
    window.handleAudio = (act, u, elId) => {
        if (!globalAudio) globalAudio = new Audio();
        // 可视化反馈
        const bubble = document.getElementById(elId);
        
        if (act === 'play') {
            if (globalAudio.src !== u) globalAudio.src = u;
            globalAudio.play().catch(e=>alert(e));
            if(bubble) bubble.classList.add('playing');
            globalAudio.onended = () => { if(bubble) bubble.classList.remove('playing'); };
        } else if (act === 'pause') {
            globalAudio.pause();
            if(bubble) bubble.classList.remove('playing');
        } else if (act === 'stop') {
            globalAudio.pause(); globalAudio.currentTime = 0;
            if(bubble) bubble.classList.remove('playing');
        }
    };

    // 录音
    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{
        e.preventDefault(); try {
            const s = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm';
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[];
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f); s.getTracks().forEach(t=>t.stop()); };
            rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){alert("Mic Error");}
    };
    const stopR = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; } };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 发送
    const handleSend = () => { const t=document.getElementById('chat-input'); if(t.value.trim()){ sendData('text', t.value); t.value=''; }};
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', e=>{if(e.key==='Enter') handleSend();});

    // 返回
    window.goBack = () => {
        if(history.state && history.state.chat) history.back();
        else {
            document.getElementById('view-chat').classList.remove('active');
            setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
            activeChatId = null; renderFriends();
        }
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null; renderFriends();
    });

    // 其他
    const fIn = document.getElementById('chat-file-input');
    fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); };
    
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    document.getElementById('mode-switch-btn').onclick = () => {
        const t = document.getElementById('text-input-wrapper'); const v = document.getElementById('voice-record-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); v.classList.remove('active'); } else { t.classList.add('hidden'); v.classList.add('active'); }
    };

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

    // Dialpad
    let dialInput = "";
    const setupDialpad = () => {
        document.querySelector('#add-overlay .modal-body').innerHTML = `<div class="numpad-container"><div id="dial-display" class="id-display-screen">____</div><div class="numpad-grid"><div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div><div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div><div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div><div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div><div class="num-btn connect" onclick="dial('OK')">🤝</div></div></div>`;
    };
    window.dial = k => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { 
            if(dialInput.length===4 && dialInput!==MY_ID) { 
                window.closeAllModals();
                if(!db.friends.find(f=>f.id===dialInput)) { db.friends.push({id:dialInput, addedAt:Date.now(), alias:`User ${dialInput}`}); saveDB(); renderFriends(); }
                openChat(dialInput);
            } else alert("Invalid"); return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{ if(window.Html5Qrcode) { const s=new Html5Qrcode("qr-reader"); window.scanner=s; s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) { if(!db.friends.find(f=>f.id===t)) { db.friends.push({id:t, addedAt:Date.now(), alias:`User ${t}`}); saveDB(); renderFriends(); } openChat(t); } }); }); } }, 300);
    };

    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; }
        c.innerHTML = t==='image' ? `<img src="${u}" style="max-width:100%;max-height:100vh;">` : `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        m.classList.remove('hidden'); m.style.display='flex';
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;
    window.editFriendName = () => { 
        if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } 
    };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };

    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        setTimeout(() => { const q = document.getElementById("qrcode"); if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); } }, 500);
    };
    
    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML='';
        db.friends.forEach(f => {
            const div = document.createElement('div'); div.className='k-list-item';
            div.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-weight:bold">${f.alias||f.id}</div><div class="list-edit-btn" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div></div>`;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        const gifs = ["https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif", "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif", "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif", "https://media.tenor.com/9y_9y_9yAAAAi/pepe-happy.gif"];
        gifs.forEach(s => {
            const i = document.createElement('img'); i.src = s; i.className = 'sticker-item';
            i.style.cssText = "width:60px;height:60px;object-fit:contain;cursor:pointer;";
            i.onclick = () => { if(activeChatId) { sendData('sticker', s); document.getElementById('sticker-panel').classList.add('hidden'); } };
            g.appendChild(i);
        });
    }

    renderProfile(); renderFriends(); setupDialpad(); setupStickers();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
