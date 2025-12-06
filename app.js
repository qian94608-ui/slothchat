document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 1. 配置与全局变量 (最优先定义) ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';
    const DB_KEY = 'pepe_v50_architect';
    const CHUNK_SIZE = 12 * 1024; // 12KB 分片 (保守值，确保稳定)

    // 全局状态机
    let db = null;
    let socket = null;
    let activeChatId = null;     // 当前打开的聊天对象ID
    let isSending = false;       // 发送锁
    let uploadQueue = [];        // 发送队列
    let activeDownloads = {};    // 接收任务
    let cancelFlag = {};         // 取消标志
    let globalAudio = null;      // 全局音频对象

    // --- 0. 样式注入 (Pepe 风格 + 布局防崩坏) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --pepe-dark: #46960C; --bg: #F2F2F7; --danger: #FF3B30; }
        body { background: var(--bg); font-family: sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
        
        /* 布局修正 */
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 80px !important; } /* 给底部留空间 */

        /* 头部 */
        .defi-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; z-index: 100; border-bottom: 2px solid #eee; }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f0f0f0; padding: 5px 12px; border-radius: 20px; font-weight: bold; cursor: pointer; border: 1px solid #ccc; }
        .header-avatar { width: 30px; height: 30px; border-radius: 50%; background: #ddd; }

        /* ★ 底部输入栏 (绝对定位防挤压) ★ */
        .chat-footer { 
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; 
            background: #fff; display: flex; align-items: center; padding: 0 10px; 
            border-top: 2px solid #eee; z-index: 500; box-sizing: border-box;
        }
        /* 工具按钮固定宽 */
        .footer-tool { width: 40px; height: 40px; border-radius: 50%; background: #f0f0f0; border: 2px solid #ddd; font-size: 20px; flex-shrink: 0; margin: 0 4px; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        
        /* 输入区容器 */
        .input-zone { flex: 1; position: relative; height: 40px; margin: 0 5px; }
        
        /* 文本模式 (默认显示) */
        .text-wrapper { 
            width: 100%; height: 100%; display: flex; align-items: center; gap: 5px; 
            position: absolute; top: 0; left: 0; z-index: 20; background: #fff; 
        }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { flex: 1; height: 100%; border-radius: 20px; background: #f9f9f9; border: 2px solid #ddd; padding: 0 15px; outline: none; font-size: 16px; }
        .send-arrow { width: 40px; height: 40px; border-radius: 50%; background: var(--pepe-green); color: #fff; border: 2px solid var(--pepe-dark); font-weight: bold; flex-shrink: 0; cursor: pointer; }

        /* 语音按钮 (默认隐藏) */
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 20px; background: var(--danger); 
            color: #fff; font-weight: 900; border: 2px solid #b91c1c; font-size: 14px; letter-spacing: 1px;
            position: absolute; top: 0; left: 0; z-index: 10; 
            display: none; cursor: pointer;
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.02);} }

        /* 列表项 */
        .k-list-item { background: #fff; border: 2px solid #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; transition: all 0.1s; }
        .k-list-item:active { transform: translateY(2px); border-color: var(--pepe-green); }
        
        /* 动画效果 */
        .shake-active { animation: shake 0.5s infinite; border-color: var(--danger); background: #fff5f5; }
        @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
        
        .marquee-box { overflow: hidden; max-width: 120px; white-space: nowrap; display: inline-block; vertical-align: middle; }
        .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 4s linear infinite; color: var(--danger); font-weight: 900; font-size: 10px; }
        @keyframes scroll { 100% { transform: translateX(-100%); } }
        
        .list-edit-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #ccc; padding: 10px; font-size: 18px; z-index: 10; }

        /* 聊天气泡 */
        .bubble { padding: 10px 14px; border-radius: 12px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); font-size: 15px; position: relative; }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; border: 1px solid var(--pepe-dark); }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #ddd; }

        /* 多媒体样式 */
        .thumb-box { position: relative; display: inline-block; max-width: 180px; border-radius: 8px; overflow: hidden; background: #000; }
        .thumb-img { max-width: 100%; height: auto; display: block; }
        .sticker-img { width: 100px !important; height: 100px !important; object-fit: contain !important; display: block; }
        
        .doc-card { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.9); padding: 8px; border-radius: 6px; text-decoration: none; color: #333; min-width: 180px; border: 1px solid #ccc; }
        .doc-name { font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

        /* 音频播放器 */
        .audio-player { display: flex; align-items: center; gap: 8px; }
        .audio-btn { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.3); border: 1px solid rgba(0,0,0,0.1); color: inherit; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 12px; }
        .msg-row.other .audio-btn { background: #eee; color: #333; }

        /* 拨号盘 */
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.8); }
        .numpad-container { padding: 15px; text-align: center; }
        .id-display-screen { font-size: 40px; color: var(--pepe-green); border-bottom: 3px solid #eee; margin-bottom: 20px; font-weight: 900; letter-spacing: 6px; height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .num-btn { width: 65px; height: 65px; border-radius: 12px; background: #fff; box-shadow: 0 4px 0 #ddd; border: 2px solid #eee; font-size: 24px; font-weight: bold; color: #333; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .num-btn:active { transform: translateY(4px); box-shadow: none; }
        .num-btn.connect { background: var(--pepe-green); color: #fff; border-color: var(--pepe-dark); box-shadow: 0 4px 0 var(--pepe-dark); }
        .num-btn.connect:active { transform: translateY(4px); box-shadow: none; }

        /* 拖拽层 */
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
        .cancel-btn { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; background: var(--danger); color: #fff; border-radius: 50%; font-size: 12px; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 5; border: 2px solid #fff; }
        
        .edit-pen { margin-left: 5px; font-size: 14px; color: #fff; opacity: 0.8; cursor: pointer; }
    `;
    document.head.appendChild(styleSheet);

    // 预览HTML
    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:30px;background:none;border:none;">✕</button><a id="preview-dl" href="#" download style="position:absolute;top:40px;right:70px;font-size:30px;text-decoration:none;">⬇️</a><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 2. 数据初始化 ---
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 3. 核心函数定义 (必须在事件绑定前) ---

    // UI 渲染
    function renderProfile() {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        // 二维码延时渲染防卡
        setTimeout(() => {
            const q = document.getElementById("qrcode");
            if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#59BC10", colorLight:"#FFFFFF"}); }
        }, 500);
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            
            let statusHtml = `<div style="font-size:12px; color:#999;">Tap to chat</div>`;
            if(f.unread) statusHtml = `<div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div>`;
            
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; border-radius:10px; border:1px solid #ccc;">
                    <div style="flex:1;">
                        <div style="font-weight:800; font-size:16px; color:#333;">${f.alias || f.id}</div>
                        ${statusHtml}
                    </div>
                    <div class="list-edit-btn" onclick="event.stopPropagation(); window.editContactAlias('${f.id}')">✎</div>
                </div>`;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }

    // ★ 修复：握手与跳转 ★
    function handleAddFriend(id) {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB(); renderFriends();
        }
        openChat(id);
    }

    // ★ 修复：强制返回逻辑 ★
    function closeChatUI() {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        setTimeout(() => view.classList.add('right-sheet'), 50);
        activeChatId = null;
        renderFriends(); // 刷新列表状态
    }

    function openChat(id) {
        if(window.speechSynthesis) window.speechSynthesis.cancel();
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        
        // 设置标题 + 编辑按钮
        document.getElementById('chat-partner-name').innerHTML = `${f.alias || f.id} <span class="edit-pen" onclick="event.stopPropagation(); window.editFriendName()">✎</span>`;
        document.getElementById('chat-online-dot').className = "status-dot red"; // 默认红
        
        // 强制重置底部状态
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";
        
        // 打开视图
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        // 注入历史记录 (适配安卓手势)
        window.history.pushState({ chat: true, id: id }, "");
        
        // 渲染历史消息
        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    // 消息渲染
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        
        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div style="padding:0;"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type === 'voice') {
            html = `<div class="bubble audio-player"><span>🎤</span><button class="audio-btn" onclick="handleAudio('play','${msg.content}')">▶</button><button class="audio-btn" onclick="handleAudio('pause')">⏸</button><button class="audio-btn" onclick="handleAudio('stop')">⏹</button></div>`;
        } 
        else if(msg.type === 'image') html = `<div class="bubble" style="padding:4px;background:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'video') html = `<div class="bubble" style="padding:4px;background:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','video')"><video src="${msg.content}#t=0.1" class="thumb-img" preload="metadata" muted></video><div style="position:absolute;top:40%;left:45%;color:#fff;font-size:24px;">▶</div></div></div>`;
        else if(msg.type === 'file') {
            let icon = '📄';
            if(msg.fileName.match(/\.(doc|docx)$/i)) icon='📝';
            else if(msg.fileName.match(/\.(xls|xlsx)$/i)) icon='📊';
            else if(msg.fileName.match(/\.(ppt|pptx)$/i)) icon='📉';
            html = `<div class="bubble" style="padding:5px;"><a class="doc-card" href="${msg.content}" download="${msg.fileName}"><div style="font-size:24px;">${icon}</div><div class="doc-info"><div class="doc-name">${msg.fileName}</div><div style="font-size:10px;color:#666;">CLICK SAVE</div></div></a></div>`;
        }
        
        div.innerHTML = html;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    // --- 4. 网络与文件传输 (★ 隧道队列模式 - V46内核 ★) ---
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

            // 1. 隧道文件
            if(msg.type === 'tunnel_file_packet') {
                try { const p = JSON.parse(msg.content); handleTunnelPacket(p, fid, friend); } catch(e){} return;
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
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                saveAndNotify(fid, finalMsg, friend); // 保存并通知
                delete activeDownloads[p.fileId];
            }
        }
    }

    // --- 发送队列 ---
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() { if(isSending || uploadQueue.length === 0) return; sendFileChunked(uploadQueue.shift()); }

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
            if (cancelFlag[fileId]) { isSending = false; setTimeout(processQueue, 500); return; }
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

    function sendData(type, content) {
        if(!activeChatId) return;
        if(socket && socket.connected) socket.emit('send_private', { targetId: activeChatId, content, type });
        const m = { type, content, isSelf: true, ts: Date.now() };
        if(!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(m); saveDB(); appendMsgDOM(m);
    }

    // --- UI 辅助 ---
    function appendProgressBubble(chatId, fileId, fileName, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; max-width:140px; overflow:hidden;">${isSelf?'⬆':'⬇'} ${fileName}</div>
                <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden;"><div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#007AFF':'#34C759'}; transition:width 0.1s;"></div></div>
                <div style="display:flex; justify-content:space-between; margin-top:2px; opacity:0.6;"><span id="spd-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span></div>
            </div>`;
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

    // --- 事件绑定 ---
    document.getElementById('chat-back-btn').onclick = () => {
        if (window.history.state && window.history.state.chat) window.history.back();
        else closeChatUI();
    };
    window.addEventListener('popstate', () => {
        const prev = document.getElementById('media-preview-modal');
        if(!prev.classList.contains('hidden')) { window.closePreview(); return; }
        if (document.getElementById('view-chat').classList.contains('active')) closeChatUI();
    });

    document.getElementById('chat-send-btn').onclick = () => { const t=document.getElementById('chat-input'); if(t.value.trim()){ sendData('text', t.value); t.value=''; }};
    document.getElementById('chat-input').addEventListener('keypress', e=>{if(e.key==='Enter') document.getElementById('chat-send-btn').click();});
    
    document.getElementById('mode-switch-btn').onclick = () => {
        const t = document.getElementById('text-input-wrapper');
        const v = document.getElementById('voice-record-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); v.classList.remove('active'); }
        else { t.classList.add('hidden'); v.classList.add('active'); }
    };

    // 录音
    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){}};
    document.body.addEventListener('click', reqPerms, {once:true});
    
    const startR = async(e)=>{
        e.preventDefault();
        try {
            const s = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm';
            rec = new MediaRecorder(s, {mimeType:mime}); chunks=[];
            rec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            rec.onstop = () => { const b = new Blob(chunks, {type:mime}); const f = new File([b], "voice.wav", {type:mime}); addToQueue(f); s.getTracks().forEach(t=>t.stop()); };
            rec.start(); vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){alert("Mic Required!");}
    };
    const stopR = (e)=>{ e.preventDefault(); if(rec&&rec.state!=='inactive'){ rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; } };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 文件
    const fIn = document.getElementById('chat-file-input');
    fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); };
    
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

    // 拨号盘
    let dialInput = "";
    const setupDialpad = () => {
        document.querySelector('#add-overlay .modal-body').innerHTML = `<div class="numpad-container"><div id="dial-display" class="id-display-screen">____</div><div class="numpad-grid"><div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div><div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div><div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div><div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div><div class="num-btn connect" onclick="dial('OK')">🤝</div></div></div>`;
    };
    window.dial = k => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { if(dialInput.length===4 && dialInput!==MY_ID) { window.closeAllModals(); handleAddFriend(dialInput); dialInput=""; d.innerText="____"; } else alert("Invalid"); return; }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };

    // 表情
    const sGrid = document.getElementById('sticker-grid'); sGrid.innerHTML='';
    const gifs = ["https://media.tenor.com/2nZ2_2s_2zAAAAAi/pepe-frog.gif", "https://media.tenor.com/Xk_Xk_XkAAAAi/pepe-dance.gif", "https://media.tenor.com/8x_8x_8xAAAAi/pepe-sad.gif", "https://media.tenor.com/9y_9y_9yAAAAi/pepe-happy.gif"];
    gifs.forEach(s=>{
        const i=document.createElement('img'); i.src=s; i.className='sticker-img'; i.style.cssText="width:60px;height:60px;object-fit:contain;cursor:pointer;";
        i.onclick=()=>{ if(activeChatId){ sendData('sticker', s); document.getElementById('sticker-panel').classList.add('hidden'); }};
        sGrid.appendChild(i);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Global Utils
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.cancelTransfer = (id, self) => { if(self) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>'; };
    window.previewMedia = (u,t) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dl = document.getElementById('preview-download-btn'); if(dl) { dl.href=u; dl.download=`f_${Date.now()}`; }
        c.innerHTML = t==='image' ? `<img src="${u}" style="max-width:100%;max-height:100vh;">` : `<video src="${u}" controls autoplay style="max-width:100%;"></video>`;
        m.classList.remove('hidden'); m.style.display='flex';
    };
    window.closePreview = () => document.getElementById('media-preview-modal').classList.add('hidden');
    window.playVoice = (u,id) => { const a = new Audio(u); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    window.handleAudio = (act, u) => { 
        if(!globalAudio) globalAudio=new Audio(); 
        if(act==='play') { globalAudio.src=u; globalAudio.play(); } 
        else if(act==='pause') globalAudio.pause(); 
        else { globalAudio.pause(); globalAudio.currentTime=0; } 
    };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    window.editContactAlias = (fid) => { const f=db.friends.find(x=>x.id===fid); if(f) { const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); renderFriends(); } } };
    window.editMyName = () => { const n=prompt("Name", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); initUI(); } };
    document.querySelector('.user-pill').onclick = window.editMyName;
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    renderProfile(); renderFriends(); setupDialpad();
    document.body.addEventListener('click', () => document.getElementById('msg-sound').load(), {once:true});
});
