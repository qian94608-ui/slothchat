document.addEventListener('DOMContentLoaded', () => {

    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 样式重写 (针对性修复：发送键层级、语音UI美化、返回逻辑) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --bg: #F2F2F7; --danger: #FF3B30; --dark-text: #333; }
        body { background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
        
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 90px !important; }

        /* 头部 */
        .defi-header { 
            position: fixed; top: 0; left: 0; width: 100%; height: 60px; 
            background: #fff; z-index: 100; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center; padding: 0 15px; box-sizing: border-box;
        }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 5px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #ddd; font-weight: 600; font-size: 14px; }
        .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: #fff; object-fit: contain; border: 1px solid #eee; }

        /* ★ 底部输入栏 (物理防遮挡 + 层级修复) ★ */
        .chat-footer { 
            position: fixed; bottom: 0; left: 0; width: 100%; height: 70px; 
            background: #fff; display: flex; align-items: center; padding: 0 10px; 
            border-top: 1px solid #eee; z-index: 999; box-sizing: border-box; gap: 8px;
        }
        
        /* 功能按钮 */
        .footer-tool, #sticker-btn, #file-btn, #mode-switch-btn { 
            width: 40px; height: 40px; border-radius: 50%; background: #f2f2f2; 
            border: 1px solid #ddd; font-size: 20px; flex-shrink: 0; 
            display: flex; justify-content: center; align-items: center; cursor: pointer;
            color: #555;
        }

        /* 输入区域 */
        .input-zone { flex: 1; position: relative; height: 40px; display: flex; align-items: center; min-width: 0; }
        
        /* 文本框 */
        #chat-input { 
            width: 100%; height: 100%; border-radius: 20px; background: #f9f9f9; 
            border: 1px solid #ddd; padding: 0 15px; outline: none; font-size: 16px; color: #000;
        }
        
        /* 发送按钮 (强制最高层级) */
        #chat-send-btn { 
            width: 44px; height: 40px; border-radius: 20px; background: var(--pepe-green); 
            color: #fff; border: none; font-weight: bold; flex-shrink: 0; cursor: pointer;
            font-size: 14px; display: flex; justify-content: center; align-items: center;
            z-index: 1000; box-shadow: 0 2px 5px rgba(89, 188, 16, 0.3);
        }
        #chat-send-btn:active { transform: scale(0.95); }

        /* 语音长按按钮 */
        #voice-bar {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            border-radius: 20px; background: var(--danger); color: #fff; 
            font-weight: bold; font-size: 14px; display: none; /* 默认隐藏 */
            justify-content: center; align-items: center; z-index: 10; cursor: pointer;
        }
        #voice-bar.active { display: flex !important; }
        #voice-bar.recording { animation: pulse 1s infinite; background: #cc0000; }

        /* 辅助类 */
        .hidden { display: none !important; }

        /* 消息容器 */
        #messages-container {
            position: fixed; top: 60px; bottom: 70px; left: 0; right: 0;
            overflow-y: auto; -webkit-overflow-scrolling: touch;
            padding: 15px; padding-bottom: 30px; 
            background: #F2F2F7; display: flex; flex-direction: column; gap: 12px;
        }

        /* 气泡通用 */
        .msg-row { display: flex; width: 100%; }
        .msg-row.self { justify-content: flex-end; } 
        .msg-row.other { justify-content: flex-start; }
        
        .bubble { 
            padding: 10px 14px; border-radius: 16px; max-width: 75%; 
            position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: 15px; line-height: 1.4;
        }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; border-bottom-right-radius: 4px; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; border-bottom-left-radius: 4px; }
        .bubble.clean { background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; }

        /* ★ 语音消息美化 (Telegram 风格) ★ */
        .voice-bubble {
            display: flex; align-items: center; gap: 10px; min-width: 160px; padding: 5px 0;
        }
        .voice-play-btn {
            width: 32px; height: 32px; border-radius: 50%; 
            background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
            display: flex; justify-content: center; align-items: center; cursor: pointer; color: inherit;
        }
        .msg-row.other .voice-play-btn { background: #f0f0f0; border-color: #ddd; color: var(--pepe-green); }
        
        .voice-track { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; position: relative; }
        .msg-row.other .voice-track { background: #eee; }
        
        /* 假进度条动画 */
        .voice-progress { height: 100%; width: 0%; background: #fff; transition: width 0.2s; }
        .msg-row.other .voice-progress { background: var(--pepe-green); }
        
        .voice-meta { font-size: 10px; opacity: 0.8; margin-top: 4px; display: flex; justify-content: space-between; }

        /* 文档/音频卡片 */
        .file-card { 
            display: flex; align-items: center; gap: 12px; 
            background: #fff; padding: 12px; border-radius: 12px; 
            text-decoration: none; color: #333 !important; 
            border: 1px solid #eee; width: 220px; box-sizing: border-box; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .file-icon { font-size: 24px; flex-shrink: 0; }
        .file-info { flex: 1; overflow: hidden; }
        .file-name { font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; }
        .file-type { font-size: 10px; color: #999; font-weight: 700; margin-top: 2px; }

        /* 媒体 */
        .thumb-img { max-width: 200px; border-radius: 12px; display: block; }
        .sticker-img { width: 100px; height: 100px; object-fit: contain; cursor: pointer; }

        /* 动画 */
        @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.02);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
        
        /* 模态框与列表 */
        .modal-overlay { z-index: 10000; background: rgba(0,0,0,0.85); }
        .numpad-container { padding: 20px; text-align: center; }
        .num-btn { width: 60px; height: 60px; border-radius: 12px; background: #fff; border: 1px solid #eee; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 2px 0 #eee; }
        .num-btn:active { transform: translateY(2px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: #46960C; }
        
        .list-edit-btn { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); padding: 10px; font-size: 18px; color: #ccc; z-index: 10; }
        .drag-overlay { display: none; z-index: 99999; } .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:10001;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v63_redemption';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId;
    let activeDownloads = {}, isSending = false, cancelFlag = {}, uploadQueue = [], globalAudio = null;
    let isVoiceMode = false; // 状态标记

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

        renderFriends();
        setupDialpad();
        setupStickers();
        
        // 初始渲染底部 (文本模式)
        renderInputZone();

        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
        }, 500);
    };

    // ★ 核心修复：手动控制输入区 DOM，杜绝遮挡 ★
    function renderInputZone() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const voiceBar = document.getElementById('voice-bar');
        const modeBtn = document.getElementById('mode-switch-btn');

        if (isVoiceMode) {
            // 语音模式
            input.style.display = 'none';
            sendBtn.style.display = 'none';
            voiceBar.classList.add('active'); // 显示长条按钮
            modeBtn.innerText = '⌨️';
        } else {
            // 文本模式
            input.style.display = 'block';
            sendBtn.style.display = 'flex';
            voiceBar.classList.remove('active');
            modeBtn.innerText = '🎤';
            
            // 自动聚焦
            if(activeChatId && !isMobile()) setTimeout(() => input.focus(), 100);
        }
    }
    function isMobile() { return /Android|iPhone|iPad/i.test(navigator.userAgent); }

    // --- 3. 网络 ---
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

    function handleTunnelPacket(p, fid, friend) {
        const safeName = p.fileName || "File";
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:safeName, fileType:p.fileType, isVoice: p.isVoice };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, safeName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data);
            dl.receivedSize += Math.floor(p.data.length * 0.75);
            
            // 更新进度
            const now = Date.now();
            if(now - dl.lastTime > 500 && activeChatId === fid) {
                // ... update UI logic
                const bar = document.getElementById(`bar-${p.fileId}`);
                if(bar) bar.style.width = `${Math.floor((dl.receivedSize/dl.totalSize)*100)}%`;
                dl.lastTime = now; 
            }
        } 
        else if(p.subType === 'end') {
            const dl = activeDownloads[p.fileId];
            if(dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                
                let type = 'file';
                // ★ 区分 Hold to Speak 和 Audio File ★
                if (dl.isVoice || dl.fileName === 'voice.wav') type = 'voice';
                else if (dl.fileType.startsWith('image')) type = 'image';
                else if (dl.fileType.startsWith('video')) type = 'video';
                else if (dl.fileType.startsWith('audio')) type = 'file'; // 音乐文件

                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); saveDB();
                
                if(activeChatId !== fid && friend) { friend.unread = true; saveDB(); renderFriends(); }
                delete activeDownloads[p.fileId];
            }
        }
    }

    // --- 4. 发送逻辑 ---
    function addToQueue(file, isVoice = false) { uploadQueue.push({file, isVoice}); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; const item = uploadQueue.shift(); sendFileChunked(item.file, item.isVoice); }

    function sendFileChunked(file, isVoice) {
        if(!activeChatId || !socket.connected) { alert("Net Error"); return; }
        isSending = true;
        
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const total = file.size;
        
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset=0;
        const readNext = () => {
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
                    content: JSON.stringify({
                        subType: 'chunk', fileId, data: b64,
                        fileName: sendName, fileType: file.type, totalSize: total,
                        isVoice: isVoice
                    })
                });
                offset += chunk.size;
                // Update bar
                const bar = document.getElementById(`bar-${fileId}`);
                if(bar) bar.style.width = `${Math.floor((offset/total)*100)}%`;
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- 5. 交互 ---
    
    // ★ 修复：发送文本 (明确绑定) ★
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t && t.value.trim()){ 
            sendData('text', t.value); 
            t.value = ''; 
            t.focus();
        }
    };
    // 强制绑定点击事件
    document.getElementById('chat-send-btn').onclick = handleSend;
    
    // 回车发送 (keydown最稳)
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            handleSend(); 
        }
    });

    // ★ 修复：返回逻辑 (双重保险) ★
    window.goBack = () => {
        if(history.state && history.state.chat) {
            history.back(); // 尝试利用浏览器历史
        } else {
            closeChatUI(); // 历史栈空了？强制关！
        }
    };
    function closeChatUI() {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        setTimeout(() => view.classList.add('right-sheet'), 300);
        activeChatId = null;
        renderFriends();
    }
    // 监听手势
    window.addEventListener('popstate', () => {
        const prev = document.getElementById('media-preview-modal');
        if(!prev.classList.contains('hidden')) { window.closePreview(); return; }
        if(document.getElementById('view-chat').classList.contains('active')) {
            closeChatUI();
        }
    });

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        isVoiceMode = false; renderInputZone(); // 重置为文本
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        window.history.pushState({ chat: true }, "");
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    // ★ 消息渲染 (修复 Hold to Speak UI) ★
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        const uid = Date.now() + Math.random().toString().substr(2,5);

        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div class="bubble clean"><img src="${msg.content}" class="sticker-img"></div>`;
        
        // Voice Note (Hold to Speak)
        else if(msg.type === 'voice') {
            html = `<div class="bubble">
                        <div class="voice-bubble">
                            <div class="voice-play-btn" onclick="handleAudio('toggle', '${msg.content}', 'icon-${uid}')">
                                <span id="icon-${uid}">▶</span>
                            </div>
                            <div class="voice-track"><div class="voice-progress"></div></div>
                            <a href="${msg.content}" download="voice.wav" style="text-decoration:none;color:inherit;font-size:12px;">⬇</a>
                        </div>
                    </div>`;
        } 
        
        // Image/Video
        else if(msg.type === 'image') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble clean"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:24px;">▶</div></div></div>`;
        
        // File Card
        else if(msg.type === 'file') {
            // Audio File -> Card
            if (msg.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)) {
                 html = `<div class="bubble clean">
                            <div class="file-card" onclick="previewMedia('${msg.content}', 'audio')">
                                <div class="file-icon">🎵</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK TO PLAY</div></div>
                            </div>
                        </div>`;
            } else {
                // Doc
                let icon = '📄';
                if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
                else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
                html = `<div class="bubble clean">
                            <a class="file-card" href="${msg.content}" download="${msg.fileName}">
                                <div class="file-icon">${icon}</div>
                                <div class="file-info"><div class="file-name">${msg.fileName}</div><div class="file-type">CLICK SAVE</div></div>
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
        div.innerHTML = `<div class="bubble clean"><div class="progress-wrapper"><div style="font-weight:bold;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;">${fileName}</div><div class="progress-track"><div id="bar-${fileId}" class="progress-fill"></div></div><div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div></div></div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg); }
    }
    function sendData(type, content) {
        if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content, type });
        const m = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(m); saveDB(); appendMsgDOM(m);
    }
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // --- 6. 事件绑定 ---
    document.getElementById('chat-back-btn').onclick = window.goBack;

    document.getElementById('mode-switch-btn').onclick = () => {
        isVoiceMode = !isVoiceMode; renderInputZone();
    };

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
        if(activeChatId) {
            if(e.dataTransfer.items) for(let i=0; i<e.dataTransfer.items.length; i++) traverseFileTree(e.dataTransfer.items[i].webkitGetAsEntry());
            else if(e.dataTransfer.files.length) Array.from(e.target.files).forEach(f => addToQueue(f, false));
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
            img.className='sticker-item'; img.style.width='60px';
            img.onclick=()=>{ if(activeChatId){ sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); }};
            g.appendChild(i);
        }
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    const vBtn = document.getElementById('voice-bar'); // 注意这里
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    const startR = async(e)=>{ e.preventDefault(); try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm'; rec = new MediaRecorder(s, {mimeType:mime}); chunks=[]; rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f, true); s.getTracks().forEach(t=>t.stop()); }; rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording'); } catch(e){alert("Mic Error");} };
    const stopR = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; } };
    
    // 动态创建的 voice-bar 需要在 renderInputZone 绑定，这里是兜底
    
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
    
    // 简单播放器
    window.handleAudio = (act, u, id) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        const icon = document.getElementById(id);
        
        if(act==='toggle') {
            if(globalAudio.src !== u) { globalAudio.src = u; globalAudio.play(); icon.innerText='⏸'; }
            else {
                if(globalAudio.paused) { globalAudio.play(); icon.innerText='⏸'; }
                else { globalAudio.pause(); icon.innerText='▶'; }
            }
            globalAudio.onended = () => icon.innerText='▶';
        }
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    function traverseFileTree(item) {
        if (item.isFile) { item.file(file => addToQueue(file)); } 
        else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(entries => { for (let i=0; i<entries.length; i++) traverseFileTree(entries[i]); });
        }
    }

    initUI();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
