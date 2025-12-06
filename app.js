document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (V47的UI修复版) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --pepe-green: #59BC10; --bg: #F2F2F7; --danger: #FF3B30; --primary: #59BC10; }
        body { background: var(--bg); font-family: sans-serif; overscroll-behavior-y: none; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 60px !important; }

        /* 头部 */
        .defi-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; z-index: 100; position: relative; }
        .user-pill { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 20px; cursor: pointer; }

        /* ★ 底部输入栏 (V47 修复版 - 解决消失问题) ★ */
        .chat-footer { 
            position: absolute; bottom: 0; left: 0; right: 0;
            height: 60px; background: #fff; display: flex; align-items: center; 
            padding: 0 10px; gap: 8px; border-top: 1px solid #eee; z-index: 200;
        }
        .footer-tool { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: #f0f0f0; border: none; font-size: 20px; cursor: pointer; display:flex; justify-content:center; align-items:center;}
        
        .input-zone { flex: 1; position: relative; height: 40px; display: flex; }
        
        /* 文本与语音互斥显示 */
        .text-wrapper { 
            width: 100%; height: 100%; display: flex; gap: 5px; 
            position: absolute; top: 0; left: 0; z-index: 20; background: #fff; 
        }
        .text-wrapper.hidden { display: none !important; }
        #chat-input { flex: 1; height: 100%; background: #f5f5f5; border: 1px solid #ddd; border-radius: 20px; padding: 0 15px; outline: none; font-size: 16px; }
        
        .voice-btn-long { 
            width: 100%; height: 100%; border-radius: 20px; border: none;
            background: #FF4444; color: white; font-weight: bold;
            position: absolute; top: 0; left: 0; z-index: 10;
            display: none; 
        }
        .voice-btn-long.active { display: block !important; }
        .voice-btn-long.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0% {transform: scale(1);} 50% {transform: scale(1.05);} }

        /* 列表与气泡 */
        .k-list-item { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .bubble { padding: 10px 15px; border-radius: 18px; max-width: 80%; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .msg-row.self .bubble { background: var(--pepe-green); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; border: 1px solid #eee; }
        
        /* 进度条 (V46恢复) */
        .progress-bar { height: 4px; background: #eee; margin-top: 5px; border-radius: 2px; overflow: hidden; }
        .progress-fill { height: 100%; background: #fff; width: 0%; transition: width 0.2s; }
        .msg-row.other .progress-fill { background: var(--pepe-green); }

        /* 媒体 */
        .thumb-box { position: relative; display: inline-block; max-width: 200px; border-radius: 12px; overflow: hidden; background: #000; }
        .thumb-img { max-width: 100%; height: auto; display: block; object-fit: contain; }
        .sticker-img { width: 100px !important; height: 100px !important; object-fit: contain !important; display: block; }
        
        /* 模态框 */
        .modal-overlay { z-index: 99999; background: rgba(0,0,0,0.8); }
        .numpad-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
        .id-display-screen { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: var(--primary); margin-bottom: 20px; border-bottom: 2px solid #eee; width: 80%; text-align: center; height: 50px; line-height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 260px; }
        .num-btn { width: 65px; height: 65px; border-radius: 50%; background: #fff; box-shadow: 0 3px 0 #eee; border: 1px solid #ddd; font-size: 24px; font-weight: bold; color: #333; display: flex; justify-content: center; align-items: center; cursor: pointer; user-select: none; }
        .num-btn:active { transform: translateY(3px); box-shadow: none; background: #eee; }
        .num-btn.clear { color: var(--danger); font-size: 18px; }
        .num-btn.connect { background: var(--primary); color: #fff; border: none; box-shadow: 0 4px 10px rgba(89, 188, 16, 0.3); font-size: 30px; }
        
        /* 拖拽层 */
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    // 预览层
    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:99999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:100000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px;">✕</button>
        <a id="preview-download-btn" href="#" download style="position:absolute; top:40px; right:80px; z-index:100000; background:var(--primary); color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; text-decoration:none;">⬇</a>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据初始化 ---
    const DB_KEY = 'pepe_v48_restored';
    // ★ 恢复：分片大小设置 (V46) ★
    const CHUNK_SIZE = 12 * 1024; 
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000+Math.random()*9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 核心状态 (★ 恢复：队列与下载状态 ★) ---
    let socket = null;
    let activeChatId = null;
    let isSending = false;
    let uploadQueue = []; // 发送队列
    let activeDownloads = {}; // 接收状态
    let cancelFlag = {}; // 取消标志

    // --- 3. 界面初始化 ---
    const initUI = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        const avatar = document.getElementById('my-avatar');
        avatar.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        
        renderFriends();
        setupDialpad();
        // 初始化表情
        const sGrid = document.getElementById('sticker-grid');
        sGrid.innerHTML = '';
        for(let i=1; i<=12; i++) {
            const img = document.createElement('img');
            img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}`;
            img.className = 'sticker-item';
            img.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
            img.onclick = () => { 
                if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); }
            };
            sGrid.appendChild(img);
        }
    };

    // --- 4. 网络与隧道协议 (★ 恢复：V46 隧道逻辑 ★) ---
    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] });
        socket.on('connect', () => { 
            document.getElementById('conn-status').className = "status-dot green"; 
            socket.emit('register', MY_ID); 
            isSending = false; // 重置发送锁
        });
        
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            if(!db.friends.find(f=>f.id===fid)) {
                db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
                saveDB(); renderFriends();
            }

            // ★ 恢复：隧道数据包处理 ★
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    handleTunnelPacket(p, fid);
                } catch(e) { console.error(e); }
                return; // 拦截，不作为普通消息处理
            }

            // 普通消息
            const m = { type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName };
            saveMsg(fid, m);
        });
    }

    // ★ 恢复：隧道接收逻辑 (支持分片重组) ★
    function handleTunnelPacket(p, fid) {
        if (p.subType === 'chunk') {
            if (activeDownloads[p.fileId] === 'cancelled') return;
            if (!activeDownloads[p.fileId]) {
                activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastTime:Date.now(), lastBytes:0, fileName:p.fileName, fileType:p.fileType };
                if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
            }
            const dl = activeDownloads[p.fileId];
            dl.chunks.push(p.data);
            dl.receivedSize += Math.floor(p.data.length * 0.75);
            
            // 更新进度UI
            const now = Date.now();
            if (now - dl.lastTime > 500 && activeChatId === fid) {
                const speed = ((dl.receivedSize - dl.lastBytes)/1024)/((now - dl.lastTime)/1000);
                updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, speed);
                dl.lastTime = now; dl.lastBytes = dl.receivedSize;
            }

        } else if (p.subType === 'end') {
            if (activeDownloads[p.fileId] === 'cancelled') return;
            const dl = activeDownloads[p.fileId];
            if (dl) {
                const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                const url = URL.createObjectURL(blob);
                
                let type = 'file';
                if(dl.fileType.startsWith('image')) type = 'image';
                else if(dl.fileType.startsWith('video')) type = 'video';
                else if(dl.fileType.startsWith('audio')) type = 'voice';

                const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                
                // 替换进度条为真实内容
                if(activeChatId === fid) replaceProgressWithContent(p.fileId, finalMsg);
                
                // 保存历史
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push(finalMsg); saveDB();
                delete activeDownloads[p.fileId];
                document.getElementById('success-sound').play().catch(()=>{});
            }
        }
    }

    // ★ 恢复：文件发送队列与切片 (核心功能) ★
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() { 
        if(isSending || uploadQueue.length === 0) return; 
        const file = uploadQueue.shift(); 
        sendFileChunked(file); 
    }

    function sendFileChunked(file) {
        if(!activeChatId) { alert("Connect first"); return; }
        isSending = true;
        
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        const total = file.size;
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        const readNext = () => {
            if (cancelFlag[fileId] || !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }
            
            if (offset >= total) {
                // 发送结束包
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({ subType: 'end', fileId })
                });
                
                let type = 'file';
                if(sendType.startsWith('image')) type = 'image';
                else if(sendType.startsWith('video')) type = 'video';
                else if(sendType.startsWith('audio')) type = 'voice';
                
                const finalMsg = { type, content: URL.createObjectURL(file), fileName: sendName, isSelf: true };
                replaceProgressWithContent(fileId, finalMsg);
                
                if(!db.history[activeChatId]) db.history[activeChatId] = [];
                db.history[activeChatId].push(finalMsg); saveDB();
                
                isSending = false; 
                setTimeout(processQueue, 300); // 处理下一个文件
                return;
            }

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                // 发送切片包 (包含元数据，确保接收端不丢失)
                socket.emit('send_private', {
                    targetId: activeChatId, type: 'tunnel_file_packet',
                    content: JSON.stringify({
                        subType: 'chunk', fileId, data: b64,
                        fileName: sendName, fileType: sendType, totalSize: total
                    })
                });
                offset += chunk.size;
                
                const now = Date.now();
                if(now - lastTime > 200) {
                    const spd = ((offset - lastBytes)/1024)/((now - lastTime)/1000);
                    updateProgressUI(fileId, offset, total, spd);
                    lastTime = now; lastBytes = offset;
                }
                setTimeout(readNext, 30); // 30ms 间隔
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // ★ 恢复：文件夹遍历 (支持拖拽文件夹) ★
    function traverseFileTree(item) {
        if (item.isFile) { item.file(file => addToQueue(file)); }
        else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(entries => {
                for (let i=0; i<entries.length; i++) traverseFileTree(entries[i]);
            });
        }
    }

    function saveMsg(fid, msg) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push(msg);
        saveDB();
        if(activeChatId === fid) appendMsgDOM(msg);
        else document.getElementById('msg-sound').play().catch(()=>{});
    }

    function sendData(type, content) {
        if(!activeChatId) return;
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content, type });
        }
        const m = { type, content, isSelf: true, ts: Date.now() };
        saveMsg(activeChatId, m);
    }

    // --- 6. 界面交互 ---
    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        const view = document.getElementById('view-chat');
        view.classList.remove('right-sheet');
        view.classList.add('active');
        
        // 恢复输入框状态
        document.getElementById('text-input-wrapper').classList.remove('hidden');
        document.getElementById('voice-record-btn').classList.remove('active');
        document.getElementById('mode-switch-btn').innerText = "🎤";

        const box = document.getElementById('messages-container');
        box.innerHTML = '';
        const msgs = db.history[id] || [];
        msgs.forEach(m => appendMsgDOM(m));
    }

    // ★ 修复：点击返回按钮 (强制关闭) ★
    window.goBack = () => {
        const view = document.getElementById('view-chat');
        view.classList.remove('active');
        setTimeout(() => view.classList.add('right-sheet'), 300);
        activeChatId = null;
    };
    document.getElementById('chat-back-btn').onclick = window.goBack;

    // 消息渲染
    function appendMsgDOM(msg) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${msg.isSelf ? 'self' : 'other'}`;
        let html = '';
        
        if(msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if(msg.type === 'sticker') html = `<div style="padding:5px;"><img src="${msg.content}" class="sticker-img" style="width:100px;"></div>`;
        else if(msg.type === 'image') html = `<div class="bubble" style="padding:4px;background:none;box-shadow:none;"><div class="thumb-box" onclick="previewMedia('${msg.content}','image')"><img src="${msg.content}" class="thumb-img"></div></div>`;
        else if(msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}" style="color:inherit;">Download</a></div>`;
        
        div.innerHTML = html;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    // 进度条UI
    function appendProgressBubble(cid, fid, name, isSelf) {
        if(activeChatId !== cid) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fid}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble" style="min-width:160px;"><div>${isSelf?'⬆':'⬇'} ${name}</div><div class="progress-bar"><div id="bar-${fid}" class="progress-fill"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;"><span id="spd-${fid}">0K/s</span><span id="pct-${fid}">0%</span></div></div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }
    function updateProgressUI(fid, cur, total, spd) {
        const bar = document.getElementById(`bar-${fid}`);
        if(bar) {
            const p = Math.floor((cur/total)*100);
            bar.style.width = `${p}%`;
            document.getElementById(`pct-${fid}`).innerText = `${p}%`;
            document.getElementById(`spd-${fid}`).innerText = `${spd.toFixed(1)} KB/s`;
        }
    }
    function replaceProgressWithContent(fid, msg) {
        const row = document.getElementById(`progress-row-${fid}`);
        if(row) { row.remove(); appendMsgDOM(msg); }
    }

    // --- 7. 按钮绑定 ---
    
    // 文本发送
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { sendData('text', t.value); t.value = ''; }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });
    
    // 模式切换
    document.getElementById('mode-switch-btn').onclick = () => {
        const tBox = document.getElementById('text-input-wrapper');
        const vBtn = document.getElementById('voice-record-btn');
        const btn = document.getElementById('mode-switch-btn');
        if(tBox.classList.contains('hidden')) {
            tBox.classList.remove('hidden'); vBtn.classList.remove('active'); btn.innerText = "🎤";
        } else {
            tBox.classList.add('hidden'); vBtn.classList.add('active'); btn.innerText = "⌨️";
        }
    };

    // ★ 修复：文件多选 & 拖拽 ★
    const fIn = document.getElementById('chat-file-input');
    fIn.setAttribute('multiple','');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files.length) Array.from(e.target.files).forEach(addToQueue); fIn.value=''; };

    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId && e.dataTransfer.items) {
            for(let i=0; i<e.dataTransfer.items.length; i++) traverseFileTree(e.dataTransfer.items[i].webkitGetAsEntry());
        }
    });

    // 拨号盘
    let dialInput = "";
    function setupDialpad() {
        const body = document.querySelector('#add-overlay .modal-body');
        body.innerHTML = `<div class="numpad-container"><div class="id-display-screen" id="dial-display">____</div><div class="numpad-grid"><div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div><div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div><div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div><div class="num-btn clear" onclick="dial('C')">C</div><div class="num-btn" onclick="dial(0)">0</div><div class="num-btn connect" onclick="dial('OK')">🤝</div></div></div>`;
    }
    window.dial = (k) => {
        const d = document.getElementById('dial-display');
        if(k==='C') { dialInput=""; d.innerText="____"; return; }
        if(k==='OK') { 
            if(dialInput.length===4 && dialInput!==MY_ID) {
                window.closeAllModals();
                if(!db.friends.find(f=>f.id===dialInput)) { db.friends.push({id:dialInput, addedAt:Date.now(), alias:`User ${dialInput}`}); saveDB(); renderFriends(); }
                openChat(dialInput);
            }
            return; 
        }
        if(dialInput.length<4) { dialInput+=k; d.innerText=dialInput.padEnd(4,'_'); }
    };
    document.getElementById('add-id-btn').onclick = () => { document.getElementById('add-overlay').classList.remove('hidden'); dialInput=""; document.getElementById('dial-display').innerText="____"; };

    // Utils
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal'); m.classList.remove('hidden'); m.style.display='flex';
        document.getElementById('preview-container').innerHTML = type==='image' ? `<img src="${url}" style="max-width:100%;max-height:100vh;">` : `<video src="${url}" controls autoplay style="max-width:100%;"></video>`;
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    function b64toBlob(b,t) { try{ const bin=atob(b); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:t}); }catch(e){ return new Blob([],{type:t}); } }
    function renderFriends() {
        const list = document.getElementById('friends-list-container'); list.innerHTML='';
        db.friends.forEach(f => {
            const div = document.createElement('div'); div.className='k-list-item';
            div.innerHTML = `<div style="font-weight:bold">${f.alias||f.id}</div>`;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    // Init
    initUI();
});
