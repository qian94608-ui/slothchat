document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 样式定义 (针对性修复点击与布局) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --pepe-dark: #46960C; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        /* ★ 核心修复：给底部留出巨大空间，防止无法上拉 ★ */
        .scroll-content { padding-bottom: 100px !important; }

        /* 头部 */
        .defi-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; z-index: 100; position: relative; border-bottom: 1px solid #eee; }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 20px; cursor: pointer; border: 1px solid #ddd; }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ddd; object-fit: cover; }

        /* ★ 底部输入栏 (物理防遮挡) ★ */
        .chat-footer { 
            position: fixed; bottom: 0; left: 0; width: 100%; height: 70px; 
            background: #fff; display: flex; align-items: center; padding: 0 8px; 
            border-top: 1px solid #eee; z-index: 500; box-sizing: border-box;
        }
        .footer-tool, #sticker-btn, #file-btn { width: 40px; height: 40px; border-radius: 50%; background: #f2f2f2; border: 1px solid #ddd; font-size: 20px; flex-shrink: 0; margin: 0 3px; display: flex; justify-content: center; align-items: center; cursor: pointer; }

        .input-zone { flex: 1; position: relative; height: 44px; margin: 0 5px; display: flex; min-width: 0; }
        
        /* 文本模式 */
        .text-wrapper { 
            width: 100%; height: 100%; display: flex; align-items: center; gap: 5px;
            position: absolute; top: 0; left: 0; z-index: 20; background: #fff; 
        }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { flex: 1; height: 100%; border-radius: 22px; background: #f9f9f9; border: 1px solid #ddd; padding: 0 15px; outline: none; font-size: 16px; color: #000; min-width: 0; }
        
        /* ★ 修复：发送按钮层级 ★ */
        .send-arrow { 
            width: 44px; height: 44px; border-radius: 50%; background: var(--pepe-green); 
            color: #fff; border: none; font-weight: bold; flex-shrink: 0; margin-left: 5px; 
            cursor: pointer; z-index: 1000; pointer-events: auto; /* 确保可点 */
            display: flex; justify-content: center; align-items: center; font-size: 18px;
        }
        .send-arrow:active { transform: scale(0.95); background: var(--pepe-dark); }
        
        /* 语音按钮 */
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 22px; background: var(--danger); 
            color: #fff; font-weight: bold; border: none; font-size: 14px;
            position: absolute; top: 0; left: 0; z-index: 10; 
            display: none; cursor: pointer;
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }

        /* 消息容器 */
        #messages-container {
            position: fixed; top: 60px; bottom: 70px; left: 0; right: 0;
            overflow-y: auto; -webkit-overflow-scrolling: touch;
            padding: 15px; 
            padding-bottom: 150px !important; /* ★ 关键：超大底部留白 ★ */
            background: #F2F2F7; display: flex; flex-direction: column; gap: 10px;
        }

        /* 列表项 */
        .k-list-item { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative; }
        .list-edit-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #ccc; font-size: 18px; padding: 10px; z-index: 10; }

        /* 气泡 */
        .bubble { padding: 10px 14px; border-radius: 16px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        .bubble.clean { background: none !important; padding: 0 !important; box-shadow: none !important; border: none !important; }

        /* 媒体与卡片 */
        .thumb-box { border-radius: 12px; overflow: hidden; background: #000; max-width: 200px; display: block; }
        .thumb-img { width: 100%; height: auto; display: block; object-fit: contain; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; display: block; }
        
        .doc-card { display: flex; align-items: center; gap: 10px; background: #fff; padding: 10px; border-radius: 10px; text-decoration: none; color: #333 !important; border: 1px solid #eee; min-width: 200px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .doc-icon { font-size: 24px; flex-shrink:0; }
        .doc-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; color: #333; }
        
        .audio-card { display: flex; align-items: center; gap: 10px; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #eee; min-width: 200px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; }
        .audio-card-icon { width: 40px; height: 40px; background: #f0f0f0; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 20px; flex-shrink:0; }
        .audio-card-title { font-weight: bold; font-size: 13px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* 音频播放器 (Hold to Speak) */
        .audio-player { display: flex; align-items: center; gap: 8px; min-width: 140px; }
        .audio-btn { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.5); color: inherit; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .msg-row.other .audio-btn { background: #f0f0f0; border-color: #ddd; color: #333; }

        /* 进度条 */
        .progress-wrapper { background: #fff; padding: 10px; border-radius: 10px; border: 2px solid var(--pepe-green); min-width: 180px; color: #333; }
        .msg-row.self .progress-wrapper { background: var(--pepe-dark); color: #fff; border-color: #fff; }
        .progress-track { height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin: 8px 0; overflow: hidden; }
        .msg-row.self .progress-track { background: rgba(255,255,255,0.3); }
        .progress-fill { height: 100%; width: 0%; transition: width 0.1s; }
        .msg-row.self .progress-fill { background: #fff; }
        .msg-row.other .progress-fill { background: var(--pepe-green); }

        /* 模态框 */
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.8); }
        .numpad-container { padding: 15px; text-align: center; }
        .id-display-screen { font-size: 36px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 4px; height: 50px; line-height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 60px; height: 60px; border-radius: 12px; background: #fff; box-shadow: 0 4px 0 #ddd; border: 2px solid #eee; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); }
        
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); }
        .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 4s linear infinite; color: var(--danger); font-size: 10px; font-weight: 900; }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
        @keyframes scroll { 100% { transform: translateX(-100%); } }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.05);} }
        
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--danger); color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 5; border: 2px solid #fff; }
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v60_final';
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
        const avatar = document.getElementById('my-avatar');
        avatar.src = './icon.png';
        avatar.onerror = () => { avatar.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`; };

        renderFriends();
        setupDialpad();
        setupStickers();
        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
        }, 500);
    };

    // --- 3. 网络 (Tunnel V59) ---
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
            if(navigator.vibrate) navigator.vibrate([100,50,100]);
            document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

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
            if(activeDownloads[p.fileId] === 'cancelled') return;
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                
                let type = 'file';
                // 优先检查 isVoice 标记
                if (dl.isVoice || dl.fileName === 'voice.wav') {
                    type = 'voice';
                } else if (dl.fileType.startsWith('image')) {
                    type = 'image';
                } else if (dl.fileType.startsWith('video')) {
                    type = 'video';
                }
                
                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); saveDB();
                
                if(activeChatId !== fid && friend) {
                    friend.unread = true; saveDB(); renderFriends();
                }
                delete activeDownloads[p.fileId];
                document.getElementById('success-sound').play().catch(()=>{});
            }
        }
    }

    // --- 4. 发送队列 ---
    function addToQueue(file, isVoiceNote = false) { 
        uploadQueue.push({ file, isVoiceNote }); 
        processQueue(); 
    }
    function processQueue() { 
        if(isSending || uploadQueue.length === 0) return; 
        const item = uploadQueue.shift(); 
        sendFileChunked(item.file, item.isVoiceNote); 
    }

    function sendFileChunked(file, isVoiceNote = false) {
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
                if(isVoiceNote) type = 'voice';
                else if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                
                const m = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true, ts: Date.now() };
                replaceProgressWithContent(fileId, m);
                
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(m); saveDB();
                
                isSending = false; 
                setTimeout(processQueue, 300); 
                return;
            }
            
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({
                        subType: 'chunk', fileId, data: b64,
                        fileName: sendName, fileType: sendType, totalSize: total,
                        isVoice: isVoiceNote
                    })
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
    
    // ★ 修复：完全关闭聊天 (UI优先) ★
    function closeChatUI() {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        setTimeout(() => view.classList.add('right-sheet'), 300);
        activeChatId = null; 
        renderFriends();
    }

    // ★ 修复：返回键点击逻辑 (优先回退历史) ★
    window.goBack = () => {
        if(history.state && history.state.chat) {
            history.back(); // 尝试利用浏览器历史关闭
        } else {
            closeChatUI(); // 兜底强制关闭
        }
    };
    
    // 监听手势/历史变化
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display!=='none') { window.closePreview(); return; }
        if (document.getElementById('view-chat').classList.contains('active')) {
            closeChatUI();
        }
    });

    function openChat(id) {
        try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        // UI 重置
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        // 注入历史
        window.history.pushState({ chat: true }, "");
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);

        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div class="bubble clean"><img src="${msg.content}" class="sticker-img"></div>`;
        
        // ★ 修复：语音消息 (Hold to Speak) ★
        else if(msg.type === 'voice') {
            html = `<div class="bubble audio-player" id="voice-${uid}">
                <button class="audio-btn" onclick="handleAudio('play', '${msg.content}', 'voice-${uid}')">▶</button>
                <button class="audio-btn" onclick="handleAudio('pause', '${msg.content}', 'voice-${uid}')">⏸</button>
                <button class="audio-btn" onclick="handleAudio('stop', '${msg.content}', 'voice-${uid}')">⏹</button>
                <div style="font-size:10px;margin-left:5px;">Voice</div>
            </div>`;
        } 
        
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:30px;">▶</div></div></div>`;
        
        // ★ 修复：文件与音频文件 (卡片样式) ★
        else if(msg.type === 'file') {
            // 音频文件 -> 音乐卡片
            if (msg.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)) {
                 html = `<div class="bubble clean">
                            <div class="audio-card" onclick="previewMedia('${msg.content}', 'audio')">
                                <div class="audio-card-icon">🎵</div>
                                <div class="audio-card-info">
                                    <div class="audio-card-title">${msg.fileName}</div>
                                    <div class="audio-card-sub">CLICK TO PLAY</div>
                                </div>
                            </div>
                        </div>`;
            } else {
                // 普通文件 -> 下载卡片
                let icon = '📄';
                if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
                else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
                else if(msg.fileName.match(/\.(ppt|pptx)$/i)) icon='📉';
                
                html = `<div class="bubble clean">
                            <a class="doc-card" href="${msg.content}" download="${msg.fileName}">
                                <div class="doc-icon">${icon}</div>
                                <div class="doc-info">
                                    <div class="doc-name">${msg.fileName}</div>
                                    <div class="doc-type">CLICK SAVE</div>
                                </div>
                            </a>
                        </div>`;
            }
        }
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble clean"><div class="progress-wrapper"><div style="font-weight:bold;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;">${fileName}</div><div class="progress-track"><div id="bar-${fileId}" class="progress-fill"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;"><span id="spd-${fileId}">0K/s</span><span id="pct-${fileId}">0%</span></div><div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div></div></div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
    function updateProgressUI(id, cur, total, spd) {
        const bar = document.getElementById(`bar-${id}`);
        if(bar) { const p = Math.floor((cur/total)*100); bar.style.width = `${p}%`; document.getElementById(`pct-${id}`).innerText = `${p}%`; document.getElementById(`spd-${id}`).innerText = `${spd.toFixed(1)} KB/s`; }
    }
    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg); }
    }
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // --- 6. 事件绑定 (★ 修复：发送文本逻辑 ★) ---
    const handleSend = (e) => {
        if(e) e.preventDefault();
        const t = document.getElementById('chat-input');
        if(t.value.trim()){ sendData('text', t.value); t.value=''; }
    };
    // 只绑定 click，避免 touchstart 冲突
    document.getElementById('chat-send-btn').onclick = handleSend;
    
    // 绑定回车 (keydown 更稳定)
    document.getElementById('chat-input').addEventListener('keydown', e=>{
        if(e.key==='Enter') {
            e.preventDefault();
            handleSend();
        }
    });

    document.getElementById('chat-back-btn').onclick = window.goBack;

    document.getElementById('mode-switch-btn').onclick = () => {
        const t = document.getElementById('text-input-wrapper'); const v = document.getElementById('voice-record-btn'); const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); v.classList.remove('active'); b.innerText="🎤"; setTimeout(()=>document.getElementById('chat-input').focus(), 50); } 
        else { t.classList.add('hidden'); v.classList.add('active'); b.innerText="⌨️"; }
    };

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

    // 拨号盘
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
                setTimeout(() => openChat(target), 50);
                dialInput=""; d.innerText="____";
            } else alert("Invalid"); return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{ if(window.Html5Qrcode) { const s=new Html5Qrcode("qr-reader"); window.scanner=s; s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); handleAddFriend(t); }); }); } }, 300);
    };

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

    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{ e.preventDefault(); try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f, true); s.getTracks().forEach(t=>t.stop()); }; rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording'); } catch(e){alert("Mic Error");} };
    const stopR = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; } };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

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
    window.playVoice = (u,id) => { const a = new Audio(u); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    window.handleAudio = (act, u, id) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        const b = document.getElementById(id);
        if(act==='play') { globalAudio.src=u; globalAudio.play(); if(b) b.classList.add('playing'); } 
        else if(act==='pause') { globalAudio.pause(); if(b) b.classList.remove('playing'); }
        else { globalAudio.pause(); globalAudio.currentTime=0; if(b) b.classList.remove('playing'); }
        globalAudio.onended = () => { if(b) b.classList.remove('playing'); };
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML='';
        db.friends.forEach(f => {
            const div = document.createElement('div'); div.className=`k-list-item ${f.unread?'shake-active':''}`;
            const statusHtml = f.unread ? `<div class="marquee-text">📢 MESSAGE COMING...</div>` : `<div style="font-size:12px;color:#999;">Tap to chat</div>`;
            div.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px;border-radius:10px;"><div style="flex:1;"><div style="font-weight:800;">${f.alias||f.id}</div>${statusHtml}</div><div class="list-edit-btn" onclick="event.stopPropagation();window.editContactAlias('${f.id}')">✎</div></div>`;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    initUI();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
