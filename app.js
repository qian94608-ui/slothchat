document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (Pepe 风格 + 动画 + 布局) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 30px !important; }
        
        /* ★ 1. 列表动画 (找回) ★ */
        .k-list-item { background: #fff; border-radius: 14px; padding: 12px; margin-bottom: 10px; position: relative; transition: all 0.1s; border: 2px solid transparent; }
        .k-list-item:active { transform: scale(0.98); background: #f0f0f0; }
        
        /* 抖动动画 */
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-4px) rotate(-1deg);} 75%{transform:translateX(4px) rotate(1deg);} }
        .shake-active { animation: shake 0.4s infinite; border-color: var(--danger); background: #fff0f0; }
        
        /* 跑马灯 */
        .marquee-box { overflow: hidden; max-width: 140px; white-space: nowrap; display: inline-block; vertical-align: middle; }
        .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 3s linear infinite; color: var(--danger); font-weight: 900; font-size: 10px; }
        @keyframes scroll { 100% { transform: translateX(-100%); } }

        /* ★ 2. 列表编辑按钮 (找回) ★ */
        .list-edit-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); padding: 10px; color: #ccc; font-size: 18px; z-index: 10; }

        /* 聊天底部 */
        .chat-footer { position: absolute; bottom: 0; width: 100%; height: 60px; background: #fff; display: flex; align-items: center; padding: 0 10px; border-top: 1px solid #eee; z-index: 200; box-sizing: border-box; }
        .footer-tool { width: 40px; height: 40px; border-radius: 50%; background: #f0f0f0; border: none; font-size: 20px; flex-shrink: 0; margin-right: 5px; display: flex; justify-content: center; align-items: center; }
        .input-zone { flex: 1; position: relative; height: 40px; margin: 0 5px; display: flex; }
        
        /* 输入框与语音互斥 */
        .text-wrapper { width: 100%; height: 100%; display: flex; align-items: center; gap: 5px; background: #fff; z-index: 20; }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { flex: 1; height: 100%; border-radius: 20px; background: #f9f9f9; border: 1px solid #ddd; padding: 0 15px; outline: none; }
        .send-arrow { width: 40px; height: 40px; border-radius: 50%; background: var(--pepe-green); color: #fff; border: none; font-weight: bold; flex-shrink: 0; }
        
        .voice-btn-long { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 20px; background: var(--danger); color: #fff; font-weight: bold; border: none; z-index: 10; display: none; }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0%{transform:scale(1);} 50%{transform:scale(1.02);} }

        /* 气泡 */
        .bubble { padding: 10px 14px; border-radius: 18px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        
        /* ★ 3. 媒体与文档 (找回) ★ */
        .thumb-box { max-width: 180px; border-radius: 8px; overflow: hidden; background: #000; }
        .thumb-img { max-width: 100%; height: auto; display: block; }
        .sticker-img { width: 90px; height: 90px; object-fit: contain; }
        
        .doc-card { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; text-decoration: none; color: #333; min-width: 180px; }
        .doc-info { flex: 1; overflow: hidden; }
        .doc-name { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-type { font-size: 10px; color: #666; font-weight: 900; }

        /* ★ 4. 音频播放器 (找回) ★ */
        .audio-player { display: flex; align-items: center; gap: 8px; }
        .audio-btn { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.3); border: none; color: inherit; font-size: 12px; display: flex; justify-content: center; align-items: center; }
        .msg-row.other .audio-btn { background: #eee; color: #333; }

        /* 模态框 */
        .modal-overlay { z-index: 100000; background: rgba(0,0,0,0.8); }
        .numpad-container { padding: 10px; text-align: center; }
        .id-display-screen { font-size: 36px; color: var(--pepe-green); border-bottom: 2px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 4px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 60px; height: 60px; border-radius: 12px; background: #fff; box-shadow: 0 3px 0 #eee; border: 1px solid #ddd; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border: none; }
        .cancel-btn { position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; background: var(--danger); color: #fff; border-radius: 50%; font-size: 12px; text-align: center; line-height: 20px; cursor: pointer; }
    `;
    document.head.appendChild(styleSheet);

    // 预览HTML
    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v50_redemption';
    const CHUNK_SIZE = 12 * 1024;
    let db, socket, activeChatId, activeDownloads={}, isSending=false, cancelFlag={}, uploadQueue=[], globalAudio=null;

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
        setupStickers(); // ★ 找回：初始化表情 ★
        
        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#000", colorLight:"#fff"}); }
        }, 500);
    };

    // --- 3. 网络核心 (★ 找回：隧道接收 & 后台存储 ★) ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { 
            document.getElementById('conn-status').className = "status-dot green"; 
            socket.emit('register', MY_ID); 
            isSending = false;
        });
        
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            if(!db.friends.find(f=>f.id===fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false });
            }
            const friend = db.friends.find(f=>f.id===fid);

            // 1. 处理隧道文件 (核心逻辑)
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    handleTunnelPacket(p, fid, friend);
                } catch(e) { console.error(e); }
                return; // 拦截，不由普通逻辑处理
            }

            // 2. 处理普通消息
            const m = { type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName };
            saveAndNotify(fid, m, friend);
        });
    }

    // ★ 核心：保存消息并通知 (找回：Shake & Marquee) ★
    function saveAndNotify(fid, msg, friend) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        saveDB();

        if(activeChatId === fid) {
            appendMsgDOM(msg); // 当前正在聊，直接显示
        } else {
            // 后台接收：标记未读，刷新列表显示抖动
            friend.unread = true;
            saveDB();
            renderFriends();
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
            if('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance("Message coming");
                window.speechSynthesis.speak(u);
            } else document.getElementById('msg-sound').play().catch(()=>{});
        }
    }

    // ★ 核心：隧道文件处理 (找回：后台接收保存) ★
    function handleTunnelPacket(p, fid, friend) {
        if(p.subType === 'chunk') {
            if(activeDownloads[p.fileId] === 'cancelled') return;
            if(!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:p.fileName, fileType:p.fileType };
                // 只有当前聊天才显示进度条
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
                
                let type = 'file';
                if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'voice';

                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                // 1. 如果在当前聊天，替换进度条
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                
                // 2. ★ 无论是否在聊天，都保存到数据库并通知 ★
                // (之前这里没调 saveAndNotify 导致后台接收只显示文本)
                saveAndNotify(fid, finalMsg, friend);
                
                delete activeDownloads[p.fileId];
            }
        }
    }

    // --- 4. UI 渲染函数 ---
    
    // 好友列表 (★ 找回：Shake, Marquee, Edit Icon ★)
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            // 抖动类
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            
            let statusHtml = '';
            if(f.unread) {
                // 跑马灯
                statusHtml = `<div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING... 📢 MESSAGE COMING...</div></div>`;
            } else {
                statusHtml = `<div style="font-size:12px; color:#888;">Tap to chat</div>`;
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; border-radius:50%; border:2px solid #eee;">
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:bold; font-size:16px;">${f.alias||f.id}</div>
                        ${statusHtml}
                    </div>
                    <div class="list-edit-btn" onclick="event.stopPropagation(); window.editContactAlias('${f.id}')">✎</div>
                </div>`;
            div.onclick = () => { f.unread=false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }
    
    // 列表编辑昵称
    window.editContactAlias = (fid) => {
        const f = db.friends.find(x=>x.id===fid);
        const n = prompt("Alias:", f.alias||fid);
        if(n) { f.alias=n; saveDB(); renderFriends(); }
    };

    // 渲染消息 (★ 找回：多媒体预览、音频控制、文档卡片 ★)
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        
        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        // 找回：表情可点击逻辑已修复在 setupStickers
        else if(msg.type === 'sticker') html = `<div style="padding:5px;"><img src="${msg.content}" class="sticker-img"></div>`;
        // 找回：音频控制
        else if(msg.type === 'voice') {
            html = `<div class="bubble audio-player">
                <span>🎤</span>
                <button class="audio-btn" onclick="handleAudio('play', '${msg.content}')">▶</button>
                <button class="audio-btn" onclick="handleAudio('pause')">⏸</button>
                <button class="audio-btn" onclick="handleAudio('stop')">⏹</button>
            </div>`;
        }
        // 找回：全屏预览
        else if(msg.type === 'image') html = `<div class="bubble" style="padding:4px;background:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble" style="padding:4px;background:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img"></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:24px;">▶</div></div></div>`;
        // 找回：文档卡片
        else if(msg.type === 'file') {
            let icon = '📄';
            if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
            else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
            else if(msg.fileName.match(/\.(ppt|pptx)$/i)) icon='📉';
            html = `<div class="bubble" style="padding:5px;"><a class="doc-card" href="${msg.content}" download="${msg.fileName}"><div style="font-size:24px;">${icon}</div><div class="doc-info"><div class="doc-name">${msg.fileName}</div><div class="doc-type">CLICK SAVE</div></div></a></div>`;
        }
        
        div.innerHTML = html;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    // --- 5. 发送逻辑 (队列+分片) ---
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; sendFileChunked(uploadQueue.shift()); }

    function sendFileChunked(file) {
        if(!activeChatId || !socket.connected) { alert("Net Error"); return; }
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset=0, lastTime=Date.now(), lastBytes=0;
        const readNext = () => {
            if (cancelFlag[fileId]) { isSending = false; setTimeout(processQueue, 500); return; }
            if (offset >= file.size) {
                socket.emit('send_private', { targetId: activeChatId, type: 'tunnel_file_packet', content: JSON.stringify({ subType: 'end', fileId }) });
                
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                
                const m = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true, ts: Date.now() };
                replaceProgressWithContent(fileId, m);
                saveAndNotify(activeChatId, m, null); // Save self history
                
                isSending = false; setTimeout(processQueue, 300);
                return;
            }
            
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({ subType: 'chunk', fileId, data: b64, fileName: sendName, fileType: sendType, totalSize: file.size })
                });
                offset += chunk.size;
                
                const now = Date.now();
                if(now - lastTime > 200) {
                    const spd = ((offset - lastBytes)/1024)/((now - lastTime)/1000);
                    updateProgressUI(fileId, offset, file.size, spd);
                    lastTime = now; lastBytes = offset;
                }
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- 6. 交互逻辑 ---
    
    // 打开聊天
    function openChat(id) {
        try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        // 强制重置底部 (修复输入框消失)
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        // 历史记录逻辑 (修复手势返回)
        window.history.pushState({ chat: true }, "");
        
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    // 返回键
    window.goBack = () => {
        if(history.state && history.state.chat) history.back();
        else {
            // 兜底关闭
            document.getElementById('view-chat').classList.remove('active');
            setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
            activeChatId = null; renderFriends();
        }
    };
    window.addEventListener('popstate', () => {
        if(document.getElementById('media-preview-modal').style.display==='flex') {
            window.closePreview(); return;
        }
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null; renderFriends();
    });

    // 录音 (★ 找回 ★)
    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const startR = async(e) => {
        e.preventDefault();
        try {
            const s = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[];
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            rec.onstop = () => {
                const b = new Blob(chunks, {type:mime});
                const f = new File([b], "voice.wav", {type:mime});
                addToQueue(f); s.getTracks().forEach(t=>t.stop());
            };
            rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){ alert("Mic Error"); }
    };
    const stopR = (e) => {
        e.preventDefault();
        if(rec && rec.state!=='inactive') { rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; }
    };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 表情初始化 (★ 找回：点击事件 ★)
    function setupStickers() {
        const g = document.getElementById('sticker-grid'); g.innerHTML = '';
        const gifs = ["https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif", "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif", "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif"];
        gifs.forEach(s => {
            const i = document.createElement('img'); i.src = s; i.className = 'sticker-item';
            i.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
            i.onclick = () => { if(activeChatId) { sendData('sticker', s); document.getElementById('sticker-panel').classList.add('hidden'); } };
            g.appendChild(i);
        });
    }

    // 按钮绑定
    document.getElementById('chat-send-btn').onclick = () => {
        const t = document.getElementById('chat-input'); if(t.value.trim()) { sendData('text', t.value); t.value=''; }
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    
    document.getElementById('mode-switch-btn').onclick = () => {
        const t = document.getElementById('text-input-wrapper');
        const v = document.getElementById('voice-record-btn');
        const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); v.classList.remove('active'); b.innerText="🎤"; }
        else { t.classList.add('hidden'); v.classList.add('active'); b.innerText="⌨️"; }
    };
    
    const fIn = document.getElementById('chat-file-input');
    fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); };
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 拨号盘
    let dialInput = "";
    const setupDialpad = () => {
        const b = document.querySelector('#add-overlay .modal-body');
        b.innerHTML = `<div class="numpad-container"><div id="dial-display" class="id-display-screen">____</div><div class="numpad-grid"><div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div><div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div><div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div><div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div><div class="num-btn connect" onclick="dial('OK')">🤝</div></div></div>`;
    };
    window.dial = k => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { 
            if(dialInput.length===4 && dialInput!==MY_ID) { 
                window.closeAllModals();
                if(!db.friends.find(f=>f.id===dialInput)) { db.friends.push({id:dialInput, addedAt:Date.now(), alias:`User ${dialInput}`}); saveDB(); renderFriends(); }
                openChat(dialInput);
            } else alert("Invalid ID"); return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{ if(window.Html5Qrcode) { const s=new Html5Qrcode("qr-reader"); window.scanner=s; s.start({facingMode:"environment"}, {fps:10}, t=>{ s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) { if(!db.friends.find(f=>f.id===t)) { db.friends.push({id:t, addedAt:Date.now(), alias:`User ${t}`}); saveDB(); renderFriends(); } openChat(t); } }); }); } }, 300);
    };

    // Utils
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal');
        const c = document.getElementById('preview-container'); c.innerHTML='';
        const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; }
        c.innerHTML = t==='image' ? `<img src="${u}" style="max-width:100%;max-height:100vh;">` : `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        m.classList.remove('hidden'); m.style.display='flex';
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.playVoice = (u,id) => { 
        if(globalAudio) globalAudio.pause(); globalAudio = new Audio(u); 
        const b = document.getElementById(id); b.classList.add('playing'); 
        globalAudio.onended=()=>b.classList.remove('playing'); globalAudio.play(); 
    };
    window.handleAudio = (act, u) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        if(act==='play') { globalAudio.src=u; globalAudio.play(); } 
        else if(act==='pause') globalAudio.pause(); 
        else { globalAudio.pause(); globalAudio.currentTime=0; } 
    };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;

    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }

    // 拖拽
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

    // Init
    initUI();
});
