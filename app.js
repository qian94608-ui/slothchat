document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.95);
            --primary: #59BC10; 
            --danger: #FF3B30;
            --shadow-sm: 0 2px 8px rgba(0,0,0,0.08);
        }
        body { background: #F2F2F7; font-family: -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; }
        .defi-nav { display: none !important; }
        .scroll-content { padding-bottom: 30px !important; }
        .k-list-item { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow-sm); transition: transform 0.1s; }
        .k-list-item:active { transform: scale(0.98); background: #f2f2f2; }
        
        /* 拨号盘修正 */
        .numpad-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
        .id-display-screen { font-size: 36px; font-weight: 800; letter-spacing: 6px; color: var(--primary); margin-bottom: 20px; border-bottom: 2px solid #eee; width: 80%; text-align: center; height: 50px; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 260px; }
        .num-btn { width: 60px; height: 60px; border-radius: 50%; background: #fff; box-shadow: 0 3px 0 #eee; border: 1px solid #ddd; font-size: 24px; font-weight: bold; color: #333; display: flex; justify-content: center; align-items: center; cursor: pointer; user-select: none; }
        .num-btn:active { transform: translateY(3px); box-shadow: none; background: #eee; }
        
        /* 特殊按钮样式 */
        .num-btn.clear { color: var(--danger); font-size: 18px; }
        .num-btn.connect { background: var(--primary); color: #fff; font-size: 28px; border: none; box-shadow: 0 4px 10px rgba(89, 188, 16, 0.3); }
        .num-btn.connect:active { background: #46960C; }

        /* 气泡 */
        .bubble { border: none !important; border-radius: 18px !important; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 80%; }
        .msg-row.self .bubble { background: var(--primary); color: #fff; }
        .msg-row.other .bubble { background: #fff; color: #000; }
        .thumb-box { position: relative; display: inline-block; max-width: 200px; border-radius: 12px; overflow: hidden; }
        .thumb-img { max-width: 100%; height: auto; display: block; object-fit: contain; }
        .sticker-img { width: 80px !important; height: 80px !important; object-fit: contain !important; }

        /* 语音 */
        .voice-bubble { display: flex; align-items: center; gap: 8px; min-width: 100px; }
        .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; }
        .wave-bar { width: 3px; height: 30%; background: #ccc; border-radius: 2px; }
        .voice-bubble.playing .wave-bar { animation: wave 0.5s infinite ease-in-out; background: #fff !important; }
        .voice-bubble.other.playing .wave-bar { background: var(--primary) !important; }
        @keyframes wave { 0%,100%{height:30%;} 50%{height:100%;} }
        .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }

        .cancel-btn { position: absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-size:12px; cursor:pointer; z-index:10; }
        .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(5px); }
        .modal-box { border-radius: 20px; overflow: hidden; }
        .drag-overlay { display: none; z-index: 99999; }
        .drag-overlay.active { display: flex; }
    `;
    document.head.appendChild(styleSheet);

    const previewModalHTML = `
    <div id="media-preview-modal" class="modal-overlay hidden" style="background:rgba(0,0,0,0.95); z-index:99999; display:none;">
        <button onclick="closePreview()" style="position:absolute; top:40px; right:20px; z-index:100000; background:rgba(255,255,255,0.2); color:#fff; border:none; width:44px; height:44px; border-radius:50%; font-size:24px;">✕</button>
        <a id="preview-download-btn" href="#" download style="position:absolute; top:40px; right:80px; z-index:100000; background:var(--primary); color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; text-decoration:none;">⬇</a>
        <div id="preview-container" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', previewModalHTML);

    // --- 1. 数据 ---
    const DB_KEY = 'pepe_v36_final_numpad';
    const CHUNK_SIZE = 12 * 1024;
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if(!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = { profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' }, friends: [], history: {} };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 拨号盘逻辑 (含握手按钮) ---
    let dialInput = "";
    
    // 生成拨号盘
    const setupDialpad = () => {
        const modalBody = document.querySelector('#add-overlay .modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="numpad-container">
                    <div id="dial-display" class="id-display-screen">____</div>
                    <div class="numpad-grid">
                        <div class="num-btn" onclick="dial(1)">1</div><div class="num-btn" onclick="dial(2)">2</div><div class="num-btn" onclick="dial(3)">3</div>
                        <div class="num-btn" onclick="dial(4)">4</div><div class="num-btn" onclick="dial(5)">5</div><div class="num-btn" onclick="dial(6)">6</div>
                        <div class="num-btn" onclick="dial(7)">7</div><div class="num-btn" onclick="dial(8)">8</div><div class="num-btn" onclick="dial(9)">9</div>
                        <div class="num-btn clear" onclick="dial('C')">C</div>
                        <div class="num-btn" onclick="dial(0)">0</div>
                        <div class="num-btn connect" onclick="dial('OK')">🤝</div>
                    </div>
                </div>`;
        }
    };
    
    window.dial = (key) => {
        const display = document.getElementById('dial-display');
        
        // 清除
        if (key === 'C') { 
            dialInput = ""; 
            display.innerText = "____"; 
            return; 
        }
        
        // 确认连接
        if (key === 'OK') {
            if (dialInput.length === 4) {
                if (dialInput === MY_ID) {
                    alert("Cannot add yourself!");
                    return;
                }
                window.closeAllModals();
                handleAddFriend(dialInput); // 触发添加和跳转
                dialInput = "";
                display.innerText = "____";
            } else {
                alert("Please enter 4 digits ID");
            }
            return;
        }
        
        // 输入数字
        if (dialInput.length < 4 && typeof key === 'number') {
            dialInput += key;
            display.innerText = dialInput.padEnd(4, '_');
            // 震动反馈
            if(navigator.vibrate) navigator.vibrate(30);
        }
    };

    const renderProfile = () => {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
        setTimeout(() => {
            const qrEl = document.getElementById("qrcode");
            if(qrEl && window.QRCode) { qrEl.innerHTML = ''; new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#59BC10", colorLight: "#FFFFFF" }); }
        }, 500);
    };
    renderProfile();
    setupDialpad();

    function handleAddFriend(id) {
        if(id === MY_ID) return;
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB(); renderFriends();
        }
        openChat(id);
    }

    // --- 3. 网络与传输 (队列版) ---
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};
    let uploadQueue = [];

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'], upgrade: false });
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };
        socket.on('connect', () => { document.getElementById('conn-status').className = "status-dot green"; registerSocket(); isSending = false; processQueue(); });
        socket.on('disconnect', () => { document.getElementById('conn-status').className = "status-dot red"; isSending = false; });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (socket.disconnected) socket.connect(); else registerSocket(); } });

        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) { friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false }; db.friends.push(friend); }

            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                friend.unread = true; saveDB(); renderFriends();
                if('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(100);
            }

            if(msg.type === 'tunnel_file_packet') {
                try {
                    const p = JSON.parse(msg.content);
                    if(p.subType === 'chunk') {
                        if(activeDownloads[p.fileId] === 'cancelled') return;
                        if(!activeDownloads[p.fileId]) {
                            activeDownloads[p.fileId] = { chunks:[], totalSize:p.totalSize, receivedSize:0, lastBytes:0, lastTime:Date.now(), fileName:p.fileName, fileType:p.fileType };
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

    // --- 队列发送 ---
    function addToQueue(file) { uploadQueue.push(file); processQueue(); }
    function processQueue() {
        if(isSending || uploadQueue.length === 0) return;
        const file = uploadQueue.shift();
        sendFileChunked(file);
    }

    function sendFileChunked(file) {
        if(!activeChatId || !socket || !socket.connected) { alert("Connect first"); return; }
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, true);
        
        let offset = 0; let lastTime = Date.now(); let lastBytes = 0; const total = file.size;
        const readNext = () => {
            if(cancelFlag[fileId] || !socket.connected) { isSending = false; setTimeout(processQueue, 500); return; }
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

    // --- 文件夹遍历 ---
    function traverseFileTree(item, path) {
        path = path || "";
        if (item.isFile) { item.file(function(file) { addToQueue(file); }); } 
        else if (item.isDirectory) {
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
                for (var i = 0; i < entries.length; i++) traverseFileTree(entries[i], path + item.name + "/");
            });
        }
    }

    // --- UI Helpers ---
    function b64toBlob(b64, type) {
        try {
            const bin = atob(b64); const arr = new Uint8Array(bin.length);
            for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], {type});
        } catch(e) { return new Blob([], {type}); }
    }

    // 录音
    const vBtn = document.getElementById('voice-record-btn');
    let rec, chunks;
    const reqPerms = async () => { try { await navigator.mediaDevices.getUserMedia({audio:true}); } catch(e){} };
    document.body.addEventListener('click', reqPerms, {once:true});

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
        } catch(e){ alert("Mic Required!"); }
    };
    const stopR = (e) => {
        e.preventDefault();
        if(rec && rec.state!=='inactive') { rec.stop(); vBtn.classList.remove('recording'); vBtn.innerText="HOLD TO SPEAK"; }
    };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // 文本发送
    const handleSend = () => {
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { sendData('text', t.value); t.value=''; }
    };
    document.getElementById('chat-send-btn').onclick = handleSend;
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });

    // 历史返回
    window.goBack = () => { if (activeChatId) window.history.back(); };
    window.addEventListener('popstate', () => {
        const preview = document.getElementById('media-preview-modal');
        if(!preview.classList.contains('hidden')) { window.closePreview(); return; }
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(() => document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null; renderFriends();
    });

    // 拖拽
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(!activeChatId) return;
        const items = e.dataTransfer.items;
        if(items) {
            for(let i=0; i<items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if(item) traverseFileTree(item);
            }
        } else if(e.dataTransfer.files[0]) addToQueue(e.dataTransfer.files[0]);
    });

    document.getElementById('add-id-btn').onclick = () => { 
        document.getElementById('add-overlay').classList.remove('hidden'); 
        dialInput=""; document.getElementById('dial-display').innerText="____"; 
    };
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const s = new Html5Qrcode("qr-reader"); window.scanner = s;
                s.start({facingMode:"environment"}, {fps:10, qrbox:200}, t => {
                    s.stop().then(()=>{ window.closeAllModals(); if(t.length===4) handleAddFriend(t); });
                });
            } else alert("Scanner Loading...");
        }, 300);
    };

    document.getElementById('mode-switch-btn').onclick = () => {
        const v = document.getElementById('voice-record-btn'); const t = document.getElementById('text-input-wrapper'); const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); t.style.display='flex'; v.classList.add('hidden'); v.style.display='none'; b.innerText='🎤'; } 
        else { t.classList.add('hidden'); t.style.display='none'; v.classList.remove('hidden'); v.style.display='block'; b.innerText='⌨️'; }
    };

    document.getElementById('file-btn').onclick = () => document.getElementById('chat-file-input').click();
    document.getElementById('chat-file-input').onchange = e => { if(e.target.files[0]) addToQueue(e.target.files[0]); };
    
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<12; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        img.className='sticker-item'; 
        img.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
        img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };
    window.cancelTransfer = (id, isSelf) => { if(isSelf) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>'; };
    
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        const dlBtn = document.getElementById('preview-download-btn');
        if(dlBtn) { dlBtn.href = url; dlBtn.download = `file_${Date.now()}`; }
        let el = type==='image' ? document.createElement('img') : document.createElement('video');
        el.src = url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; if(type==='video') { el.controls=true; el.autoplay=true; }
        c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; 
        window.history.pushState({p:1},"");
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    window.playVoice = (url, id) => { const a = new Audio(url); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    
    window.editFriendName = () => { 
        if(activeChatId) { 
            const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Set Alias:", f.alias||f.id); 
            if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } 
        } 
    };
    document.querySelector('.chat-user-info').onclick = window.editFriendName;

    renderFriends(); 
    document.body.addEventListener('click', () => { document.getElementById('msg-sound').load(); }, {once:true});
});
