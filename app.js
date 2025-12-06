document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 核心 UI 样式与修复 (Mac 风格 + 强制修正) ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root { --glass-bg: rgba(255, 255, 255, 0.95); --primary: #007AFF; --danger: #FF3B30; }
        
        /* 强制隐藏底部旧导航 */
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 20px !important; }

        /* 修复图片全屏过大问题 */
        .bubble img { max-width: 140px !important; height: auto !important; border-radius: 8px; display: block; }
        .sticker-img { width: 100px !important; height: 100px !important; object-fit: contain; }
        .thumb-box { max-width: 140px; overflow: hidden; border-radius: 8px; }
        
        /* Mac 风格列表 */
        .k-list-item {
            background: #fff; border-radius: 14px; padding: 12px; margin-bottom: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;
        }
        .k-list-item:active { transform: scale(0.98); background: #f2f2f2; }

        /* 消息气泡美化 */
        .bubble { border: none !important; box-shadow: 0 2px 6px rgba(0,0,0,0.05); padding: 10px 14px; font-size: 15px; }
        .msg-row.self .bubble { background: var(--primary); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; }

        /* 语音波纹动画 */
        @keyframes wave { 0% {height:3px;} 50% {height:12px;} 100% {height:3px;} }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; margin-left: 8px; }
        .wave-bar { width: 3px; height: 3px; background: #ccc; border-radius: 2px; }
        .voice-bubble.playing .wave-bar { animation: wave 0.6s infinite ease-in-out; background: #fff !important; }
        .voice-bubble.other.playing .wave-bar { background: var(--primary) !important; }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }

        /* 输入框修复 */
        .text-wrapper { display: flex; align-items: center; width: 100%; gap: 10px; }
        .text-wrapper.hidden { display: none !important; }
        .voice-btn-long { display: none; width: 100%; }
        .voice-btn-long.active { display: block !important; }
        
        /* 跑马灯与抖动 */
        @keyframes shake { 0%,100% {transform:translateX(0);} 25% {transform:translateX(-2px);} 75% {transform:translateX(2px);} }
        .shake-active { animation: shake 0.5s infinite; border-left: 3px solid var(--danger); }
        .marquee-box { overflow: hidden; white-space: nowrap; max-width: 120px; }
        .marquee-text { display: inline-block; animation: scroll 4s linear infinite; padding-left: 100%; color: var(--danger); font-size: 10px; font-weight: bold; }
        @keyframes scroll { 100% { transform: translateX(-100%); } }

        /* 取消按钮 */
        .cancel-btn { position: absolute; top:-6px; right:-6px; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; font-size:12px; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:5; backdrop-filter:blur(2px); }
    `;
    document.head.appendChild(styleSheet);

    // 预览模态框
    const previewHTML = `<div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95);z-index:99999;"><button onclick="closePreview()" style="position:absolute;top:40px;right:20px;color:#fff;font-size:24px;background:none;border:none;">✕</button><div id="preview-container" style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', previewHTML);

    // --- 1. 数据与全局 ---
    const DB_KEY = 'pepe_v33_stable_mac';
    const CHUNK_SIZE = 12 * 1024; // 12KB (隧道模式最佳实践)
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

    // --- 2. 核心状态管理 ---
    const activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};

    // --- 3. 初始化渲染 (加固版) ---
    const renderProfile = () => {
        try {
            document.getElementById('my-id-display').innerText = MY_ID;
            document.getElementById('my-nickname').innerText = db.profile.nickname;
            document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
            setTimeout(() => {
                const q = document.getElementById("qrcode");
                if(q && window.QRCode) { q.innerHTML=''; new QRCode(q, {text:MY_ID, width:60, height:60, colorDark:"#000", colorLight:"#fff"}); }
            }, 500);
        } catch(e) {}
    };
    renderProfile();

    // --- 4. 网络通信 (回归隧道模式) ---
    let socket = null;
    let activeChatId = null;

    if(!SERVER_URL.includes('onrender')) alert("Config URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'] }); // 强制 WS
        
        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            socket.emit('register', MY_ID);
            isSending = false;
        });
        
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            // 1. 好友处理
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) {
                friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false };
                db.friends.push(friend);
            }

            // 2. 状态更新
            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                friend.unread = true;
                saveDB();
                renderFriends();
                if(navigator.vibrate) navigator.vibrate(100);
                playNotifySound();
            }

            // 3. ★ 核心：隧道解包 (回归您认可的稳定逻辑) ★
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    
                    // A. 处理数据块
                    if(p.subType === 'chunk') {
                        if(activeDownloads[p.fileId] === 'cancelled') return;
                        if(!activeDownloads[p.fileId]) {
                            activeDownloads[p.fileId] = {
                                chunks: [], totalSize: p.totalSize, receivedSize: 0,
                                lastBytes: 0, lastTime: Date.now(), fileName: p.fileName, fileType: p.fileType
                            };
                            if(activeChatId === fid) appendProgressBubble(fid, p.fileId, p.fileName, false);
                        }
                        const dl = activeDownloads[p.fileId];
                        dl.chunks.push(p.data);
                        dl.receivedSize += Math.floor(p.data.length * 0.75); // 估算
                        
                        // UI 节流更新
                        const now = Date.now();
                        if(now - dl.lastTime > 500) {
                            const spd = ((dl.receivedSize - dl.lastBytes)/1024)/((now - dl.lastTime)/1000);
                            updateProgressUI(p.fileId, dl.receivedSize, dl.totalSize, spd);
                            dl.lastBytes = dl.receivedSize; dl.lastTime = now;
                        }
                    } 
                    // B. 处理结束
                    else if(p.subType === 'end') {
                        if(activeDownloads[p.fileId] === 'cancelled') return;
                        const dl = activeDownloads[p.fileId];
                        if(dl) {
                            const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                            const url = URL.createObjectURL(blob);
                            
                            // 类型映射
                            let type = 'file';
                            if(dl.fileType.startsWith('image')) type = 'image';
                            else if(dl.fileType.startsWith('video')) type = 'video';
                            else if(dl.fileType.startsWith('audio')) type = 'voice';

                            const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                            replaceProgressWithContent(p.fileId, finalMsg);
                            
                            if(!db.history[fid]) db.history[fid] = [];
                            db.history[fid].push({...finalMsg, content: '[File Saved]', type: 'text'});
                            saveDB();
                            delete activeDownloads[p.fileId];
                        }
                    }
                } catch(e) { console.error("Tunnel Err", e); }
                return; // ★ 拦截，不继续向下执行普通消息逻辑
            }

            // 4. 普通消息 (文本/表情/非隧道语音)
            if(msg.type !== 'tunnel_file_packet') {
                if(!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp });
                saveDB();
                if(activeChatId === fid) appendMsgDOM(msg, false);
            }
        });
    }

    // --- 5. 文件发送 (回归：隧道+递归，最稳) ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket || !socket.connected) { alert("Connect first"); return; }
        if(isSending) { alert("Sending..."); return; }
        
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0;
        let lastTime = Date.now();
        let lastBytes = 0;
        const total = file.size;

        const readNext = () => {
            if(cancelFlag[fileId] || !socket.connected) { isSending = false; return; }
            
            if(offset >= total) {
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
                db.history[activeChatId].push({...finalMsg, content: '[File Sent]', type: 'text'}); 
                saveDB();
                isSending = false; return;
            }

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
                // ★ 每次发送都带上元数据，确保接收端不丢失信息
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
                setTimeout(readNext, 30); // 30ms 间隔，稳如老狗
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- 6. 界面与交互 ---
    
    // 输入模式切换 (修复：ID对齐)
    const modeBtn = document.getElementById('mode-switch-btn');
    let isVoice = false;
    modeBtn.onclick = () => {
        isVoice = !isVoice;
        const tWrap = document.getElementById('text-input-wrapper');
        const vBtn = document.getElementById('voice-record-btn');
        if(isVoice) {
            tWrap.classList.add('hidden'); // CSS class handling
            vBtn.classList.add('active');  // Use active class for display
            modeBtn.innerText = "⌨️";
        } else {
            vBtn.classList.remove('active');
            tWrap.classList.remove('hidden');
            modeBtn.innerText = "🎤";
        }
    };

    // 渲染好友列表
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            let nameHtml = `<div style="font-weight:bold;font-size:16px;">${f.alias||f.id}</div>`;
            if(f.unread) nameHtml = `<div style="display:flex;align-items:center;gap:5px;"><div style="font-weight:bold;">${f.alias||f.id}</div><div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div></div>`;
            
            div.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px;height:45px;border-radius:50%;">
                    <div style="flex:1;">${nameHtml}<div style="font-size:12px;color:#888;">${f.unread?'<span style="color:red">● New Message</span>':'Tap to chat'}</div></div>
                </div>`;
            div.onclick = () => { f.unread=false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        document.getElementById('chat-online-dot').className = "status-dot red";
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
        else if(msg.type==='sticker') html=`<div class="bubble" style="background:transparent;box-shadow:none;"><img src="${msg.content}" class="sticker-img"></div>`;
        else if(msg.type==='voice') html=`<div id="v-${uid}" class="bubble voice-bubble ${isSelf?'':'other'}" style="cursor:pointer;display:flex;align-items:center;gap:5px;" onclick="playVoice('${msg.content}','v-${uid}')"><span>▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px;"><div class="thumb-box"><img src="${msg.content}" onclick="previewMedia('${msg.content}','image')"></div></div>`;
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
                <div style="font-weight:bold;margin-bottom:4px;">${isSelf?'⬆':'⬇'} ${fileName}</div>
                <div style="background:#eee;height:6px;border-radius:3px;overflow:hidden;"><div id="bar-${fileId}" style="width:0%;height:100%;background:${isSelf?'#007AFF':'#34C759'};transition:width 0.1s;"></div></div>
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

    // --- 7. 工具函数 ---
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal');
        const c = document.getElementById('preview-container');
        c.innerHTML = '';
        let el;
        if(type==='image') { el=document.createElement('img'); el.src=url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; }
        else { el=document.createElement('video'); el.src=url; el.controls=true; el.autoplay=true; el.style.maxWidth='100%'; }
        if(el) { c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; window.history.pushState({p:1},""); }
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); };
    window.addEventListener('popstate', () => window.closePreview());

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

    function playNotifySound() {
        if('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance("Message coming");
            const v = window.speechSynthesis.getVoices().find(x=>x.name.includes('Female'));
            if(v) u.voice = v;
            window.speechSynthesis.speak(u);
        } else document.getElementById('msg-sound').play().catch(()=>{});
    }

    function b64toBlob(b64, type) {
        try {
            const bin = atob(b64); const arr = new Uint8Array(bin.length);
            for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], {type: type});
        } catch(e) { return new Blob([], {type}); }
    }

    // --- 8. 事件绑定 (最后执行) ---
    document.getElementById('chat-send-btn').onclick = () => { const t = document.getElementById('chat-input'); if(t.value) { sendData('text', t.value); t.value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    
    // 扫码与添加
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const s = new Html5Qrcode("qr-reader"); window.scanner = s;
            s.start({facingMode:"environment"}, {fps:10, qrbox:200}, t => {
                s.stop().then(()=>{ window.closeAllModals(); handleAddFriend(t); });
            });
        }, 300);
    };
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const v = document.getElementById('manual-id-input').value;
        if(v.length===4) { window.closeAllModals(); handleAddFriend(v); }
    };
    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };

    // 录音
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
                const f = new File([b], "v.wav", {type:mime});
                sendFileChunked(f); // 走隧道
                s.getTracks().forEach(t=>t.stop());
            };
            rec.start();
            vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){ alert("Mic Error"); }
    };
    const stopR = (e) => { e.preventDefault(); if(rec && rec.state!=='inactive') { rec.stop(); vBtn.innerText="HOLD TO SPEAK"; vBtn.classList.remove('recording'); } };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 文件上传
    const fIn = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files[0]) sendFileChunked(e.target.files[0]); fIn.value=''; };

    // 表情
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<10; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        img.className='sticker-item'; img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.toggle('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 拖拽
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
