document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 紧急 UI 修复 (最优先执行) ---
    try {
        // 1. 强制隐藏底部导航栏 (小房子和卡片)
        const nav = document.querySelector('.defi-nav');
        if(nav) nav.style.display = 'none';
        
        // 2. 调整容器底部间距，回收空间
        const content = document.querySelector('.scroll-content');
        if(content) content.style.paddingBottom = '20px';

        // 3. 注入 Mac 风格样式 & 修复遮挡问题
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            :root {
                --glass-bg: rgba(255, 255, 255, 0.9);
                --primary-mac: #007AFF;
                --danger-mac: #FF3B30;
                --shadow-mac: 0 4px 12px rgba(0,0,0,0.08);
            }
            body { background: #F2F2F7; font-family: -apple-system, sans-serif; }
            
            /* 强制隐藏底部导航 */
            .defi-nav { display: none !important; }
            
            /* 按钮区域修复：提高层级，防止无法点击 */
            .action-row { position: relative; z-index: 50; }
            .action-btn { 
                background: #fff; box-shadow: var(--shadow-mac); border-radius: 16px; 
                transition: transform 0.1s; cursor: pointer; border: none;
            }
            .action-btn:active { transform: scale(0.96); background: #f0f0f0; }

            /* 列表 Mac 风格 */
            .k-list-item {
                background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: none;
            }
            
            /* 消息提醒动画 */
            @keyframes shake { 0%, 100% {transform:translateX(0);} 25% {transform:translateX(-3px);} 75% {transform:translateX(3px);} }
            .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger-mac); }
            
            .marquee-box { overflow: hidden; max-width: 120px; white-space: nowrap; }
            .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 4s linear infinite; color: var(--danger-mac); font-size: 10px; font-weight: bold; }
            @keyframes scroll { 0% {transform:translateX(0);} 100% {transform:translateX(-100%);} }

            /* 气泡与预览 */
            .bubble { background: #fff; border-radius: 18px !important; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: none !important; }
            .msg-row.self .bubble { background: var(--primary-mac); color: #fff; }
            
            /* 拖拽层默认隐藏 */
            .drag-overlay { display: none; }
            .drag-overlay.active { display: flex; }
            
            /* 取消按钮 */
            .cancel-btn { position: absolute; top:-8px; right:-8px; background:rgba(0,0,0,0.6); color:#fff; width:20px; height:20px; border-radius:50%; text-align:center; line-height:20px; font-size:12px; cursor:pointer; z-index:10; backdrop-filter: blur(4px); }
        `;
        document.head.appendChild(styleSheet);
    } catch(e) { console.error("UI Init Error", e); }

    // --- 1. 数据层初始化 ---
    const DB_KEY = 'pepe_v33_final_pro';
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

    // --- 2. 按钮事件绑定 (优先执行，防止被阻塞) ---
    // 手动添加
    const addBtn = document.getElementById('add-id-btn');
    if(addBtn) addBtn.onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirm-add-btn');
    if(confirmBtn) confirmBtn.onclick = () => {
        const input = document.getElementById('manual-id-input');
        if(input && input.value.length === 4) {
            window.closeAllModals();
            handleAddFriend(input.value);
            input.value = '';
        } else alert("Need 4 digits");
    };

    // 扫码
    const scanBtn = document.getElementById('scan-btn');
    if(scanBtn) scanBtn.onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const scanner = new Html5Qrcode("qr-reader");
                window.scanner = scanner;
                scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                    document.getElementById('success-sound').play().catch(()=>{});
                    if(navigator.vibrate) navigator.vibrate(200);
                    scanner.stop().then(() => {
                        window.closeAllModals();
                        if(txt.length === 4) handleAddFriend(txt);
                    }).catch(()=>{ window.closeAllModals(); });
                }).catch(()=>{ alert("Camera Error"); window.closeAllModals(); });
            } else { alert("Scanner lib loading..."); window.closeAllModals(); }
        }, 300);
    };

    // --- 3. 渲染个人信息 (防崩溃版) ---
    const renderProfile = () => {
        try {
            document.getElementById('my-id-display').innerText = MY_ID;
            document.getElementById('my-nickname').innerText = db.profile.nickname;
            document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
            
            // 延时渲染二维码，防止库未加载导致崩溃
            setTimeout(() => {
                const qrEl = document.getElementById("qrcode");
                if(qrEl && window.QRCode) {
                    qrEl.innerHTML = '';
                    new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#000000", colorLight: "#FFFFFF" });
                }
            }, 500);
        } catch(e) { console.error("Profile Render Error", e); }
    };
    renderProfile();

    // --- 4. 核心逻辑与网络 ---
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};

    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
        // 强制 Websocket
        socket = io(SERVER_URL, { reconnection: true, transports: ['websocket'], upgrade: false });
        
        const registerSocket = () => { if(socket.connected) socket.emit('register', MY_ID); };

        socket.on('connect', () => {
            document.getElementById('conn-status').className = "status-dot green";
            registerSocket();
            isSending = false;
        });
        
        socket.on('disconnect', () => { 
            document.getElementById('conn-status').className = "status-dot red"; 
            isSending = false; 
        });

        // 接收消息
        socket.on('receive_msg', (msg) => {
            const fid = msg.from;
            let friend = db.friends.find(f => f.id === fid);
            if(!friend) {
                friend = { id: fid, addedAt: Date.now(), alias: `User ${fid}`, unread: false };
                db.friends.push(friend);
            }

            if(activeChatId === fid) {
                document.getElementById('chat-online-dot').className = "status-dot green";
            } else {
                friend.unread = true;
                saveDB();
                renderFriends();
                // 提示音
                if('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance("New message");
                    const v = window.speechSynthesis.getVoices().find(v=>v.name.includes('Female'));
                    if(v) u.voice = v;
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(100);
            }

            // 隧道文件接收
            if(msg.type === 'tunnel_file_packet') {
                try {
                    const packet = JSON.parse(msg.content);
                    if(packet.subType === 'chunk') {
                        if(activeDownloads[packet.fileId] === 'cancelled') return;
                        if(!activeDownloads[packet.fileId]) {
                            activeDownloads[packet.fileId] = {
                                chunks:[], totalSize:packet.totalSize||0, receivedSize:0,
                                lastBytes:0, lastTime:Date.now(), fileName:packet.fileName, fileType:packet.fileType
                            };
                            if(activeChatId === fid) appendProgressBubble(fid, packet.fileId, packet.fileName, packet.fileType, false);
                        }
                        const dl = activeDownloads[packet.fileId];
                        dl.chunks.push(packet.data);
                        dl.receivedSize += Math.floor(packet.data.length * 0.75);
                        
                        const now = Date.now();
                        if(now - dl.lastTime > 500) {
                            const speed = ((dl.receivedSize - dl.lastBytes)/1024)/((now-dl.lastTime)/1000);
                            updateProgressUI(packet.fileId, dl.receivedSize, dl.totalSize, speed);
                            dl.lastBytes = dl.receivedSize; dl.lastTime = now;
                        }
                    } else if(packet.subType === 'end') {
                        if(activeDownloads[packet.fileId] === 'cancelled') return;
                        const dl = activeDownloads[packet.fileId];
                        if(dl) {
                            const blob = b64toBlob(dl.chunks.join(''), dl.fileType);
                            const url = URL.createObjectURL(blob);
                            
                            let type = 'file';
                            if(dl.fileType.startsWith('image')) type = 'image';
                            else if(dl.fileType.startsWith('video')) type = 'video';
                            else if(dl.fileType.startsWith('audio')) type = 'voice';
                            
                            const finalMsg = { type, content: url, fileName: dl.fileName, isSelf: false, ts: Date.now() };
                            replaceProgressWithContent(packet.fileId, finalMsg);
                            if(!db.history[fid]) db.history[fid] = [];
                            db.history[fid].push({...finalMsg, content: '[File Saved]', type: 'text'}); saveDB();
                            delete activeDownloads[packet.fileId];
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

    // --- 5. 文件发送 (隧道+取消) ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket || !socket.connected) { alert("Connect first"); return; }
        if(isSending) { alert("Busy"); return; }
        
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, sendType, true);
        
        let offset = 0;
        let lastTime = Date.now();
        let lastBytes = 0;
        const total = file.size;

        const readNext = () => {
            if(cancelFlag[fileId] || !socket.connected) { isSending = false; return; }
            
            if(offset >= total) {
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
                db.history[activeChatId].push({...finalMsg, content: '[File Sent]', type: 'text'}); saveDB();
                isSending = false; return;
            }

            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const r = new FileReader();
            r.onload = e => {
                const b64 = e.target.result.split(',')[1];
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
                setTimeout(readNext, 30);
            };
            r.readAsDataURL(chunk);
        };
        readNext();
    }

    // --- 6. 辅助 UI ---
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `k-list-item ${f.unread ? 'shake-active' : ''}`;
            let namePart = `<div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>`;
            if(f.unread) {
                namePart = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>
                    <div class="marquee-box"><div class="marquee-text">📢 MESSAGE COMING...</div></div>
                </div>`;
            }
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="flex:1; margin-left:10px;">${namePart}<div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● New Message</span>' : 'Click to chat'}</div></div>
            `;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
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
        if(msg.type==='text') html=`<div class="bubble">${msg.content}</div>`;
        else if(msg.type==='sticker') html=`<div class="bubble" style="background:transparent;box-shadow:none;"><img src="${msg.content}" style="width:100px;"></div>`;
        else if(msg.type==='voice') html=`<div class="bubble voice-bubble" style="cursor:pointer; display:flex; align-items:center; gap:5px;" onclick="playVoice('${msg.content}', this.id)"><span style="font-weight:bold;">▶ Voice</span><div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>`;
        else if(msg.type==='image') html=`<div class="bubble" style="padding:4px;"><div class="thumb-box"><img src="${msg.content}" class="thumb-img" onclick="previewMedia('${msg.content}','image')"></div></div>`;
        else if(msg.type==='video') html=`<div class="bubble" style="padding:4px;"><div class="thumb-box" style="background:#000; display:flex; justify-content:center; align-items:center; width:120px; height:80px;" onclick="previewMedia('${msg.content}','video')"><span style="color:#fff; font-size:24px;">▶</span></div></div>`;
        else if(msg.type==='file') html=`<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}">Download</a></div>`;
        
        div.innerHTML = html; box.appendChild(div); box.scrollTop = box.scrollHeight;
        if(msg.type === 'voice') div.querySelector('.voice-bubble').id = `voice-${Date.now()}`;
    }

    function appendProgressBubble(chatId, fileId, fileName, type, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; max-width:140px; overflow:hidden;">${isSelf?'⬆':'⬇'} ${fileName||'File'}</div>
                <div style="background:#eee; height:6px; border-radius:3px; overflow:hidden;"><div id="bar-${fileId}" style="width:0%; height:100%; background:${isSelf?'#007AFF':'#34C759'}; transition:width 0.1s;"></div></div>
                <div style="display:flex; justify-content:space-between; margin-top:2px; opacity:0.6;"><span id="spd-${fileId}">0 KB/s</span><span id="pct-${fileId}">0%</span></div>
            </div>`;
        box.appendChild(div); box.scrollTop = box.scrollHeight;
    }

    function updateProgressUI(id, cur, total, spd) {
        const bar = document.getElementById(`bar-${id}`);
        const spdEl = document.getElementById(`spd-${id}`);
        const pctEl = document.getElementById(`pct-${id}`);
        if(bar) {
            const p = total>0 ? Math.floor((cur/total)*100) : 0;
            bar.style.width = `${p}%`;
            pctEl.innerText = `${p}%`;
            spdEl.innerText = `${spd.toFixed(1)} KB/s`;
        }
    }

    function replaceProgressWithContent(id, msg) {
        const row = document.getElementById(`progress-row-${id}`);
        if(row) { row.remove(); appendMsgDOM(msg, msg.isSelf); }
    }

    // --- Utils & Global ---
    window.handleAddFriend = handleAddFriend; // 暴露给全局
    window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(e => {
        if(e.id !== 'media-preview-modal') e.classList.add('hidden');
        if(window.scanner) window.scanner.stop().catch(()=>{});
    });
    
    window.previewMedia = (url, type) => {
        const modal = document.getElementById('media-preview-modal');
        const con = document.getElementById('preview-container');
        con.innerHTML = '';
        let el;
        if(type==='image') { el=document.createElement('img'); el.src=url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; }
        else { el=document.createElement('video'); el.src=url; el.controls=true; el.autoplay=true; el.style.maxWidth='100%'; }
        if(el) { con.appendChild(el); modal.classList.remove('hidden'); modal.style.display='flex'; }
    };
    window.closePreview = () => {
        const m = document.getElementById('media-preview-modal');
        m.classList.add('hidden'); m.style.display='none'; document.getElementById('preview-container').innerHTML='';
    };
    
    window.cancelTransfer = (id, isSelf) => {
        if(isSelf) cancelFlag[id] = true; else activeDownloads[id] = 'cancelled';
        const row = document.getElementById(`progress-row-${id}`);
        if(row) row.innerHTML = `<div class="bubble" style="color:red; font-size:12px;">🚫 Cancelled</div>`;
    };

    window.switchTab = (id) => {
        if(id==='tab-identity') return;
        document.querySelectorAll('.page').forEach(p => {
            if(p.id === id) { p.classList.add('active'); p.classList.remove('right-sheet'); }
            else if(p.id !== 'view-main') p.classList.remove('active');
        });
    };
    window.goBack = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
        renderFriends();
    };
    
    // Tools
    window.editMyName = () => { const n = prompt("New Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); renderProfile(); } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); drag.classList.add('active'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) { drag.classList.add('hidden'); drag.classList.remove('active'); } });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden'); drag.classList.remove('active');
        if(activeChatId && e.dataTransfer.files[0]) {
            const f = e.dataTransfer.files[0];
            if(!f.type && f.size%4096===0) alert("No folders"); else sendFileChunked(f);
        }
    });

    // Chat UI Events
    document.getElementById('chat-send-btn').onclick = () => { const t = document.getElementById('chat-input'); if(t.value) { sendData('text', t.value); t.value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    const modeBtn = document.getElementById('mode-switch-btn');
    let voiceMode = true;
    modeBtn.onclick = () => {
        voiceMode = !voiceMode;
        const vBtn = document.getElementById('voice-record-btn');
        const tBox = document.getElementById('text-input-wrapper');
        if(voiceMode) { tBox.classList.add('hidden'); tBox.style.display='none'; vBtn.classList.remove('hidden'); vBtn.style.display='block'; modeBtn.innerText="⌨️"; }
        else { vBtn.classList.add('hidden'); vBtn.style.display='none'; tBox.classList.remove('hidden'); tBox.style.display='flex'; modeBtn.innerText="🎤"; }
    };
    
    // Rec
    let mediaRecorder, chunks;
    const startRec = async(e) => {
        if(e) e.preventDefault();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            let mime = 'audio/webm';
            if(MediaRecorder.isTypeSupported('audio/mp4')) mime='audio/mp4';
            mediaRecorder = new MediaRecorder(stream, {mimeType:mime});
            chunks=[];
            mediaRecorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, {type:mime});
                const f = new File([blob], "voice.wav", {type:mime});
                sendFileChunked(f);
                stream.getTracks().forEach(t=>t.stop());
            };
            mediaRecorder.start();
            document.getElementById('voice-record-btn').classList.add('recording');
            document.getElementById('voice-record-btn').innerText="RECORDING...";
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = (e) => {
        if(e) e.preventDefault();
        if(mediaRecorder && mediaRecorder.state!=='inactive') {
            mediaRecorder.stop();
            document.getElementById('voice-record-btn').classList.remove('recording');
            document.getElementById('voice-record-btn').innerText="HOLD TO SPEAK";
        }
    };
    const vBtn = document.getElementById('voice-record-btn');
    vBtn.addEventListener('mousedown', startRec); vBtn.addEventListener('mouseup', stopRec);
    vBtn.addEventListener('touchstart', startRec); vBtn.addEventListener('touchend', stopRec);

    // File Btn
    const fIn = document.getElementById('chat-file-input');
    document.getElementById('file-btn').onclick = () => fIn.click();
    fIn.onchange = e => { if(e.target.files[0]) sendFileChunked(e.target.files[0]); fIn.value=''; };

    // Sticker
    const sPanel = document.getElementById('sticker-panel');
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = ''; // 清空旧的
    for(let i=0; i<12; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*11}&backgroundColor=transparent`;
        img.className = 'sticker-item'; img.style.width='60px'; img.style.cursor='pointer';
        img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); sPanel.classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => sPanel.classList.toggle('hidden');
    
    // Init rendering
    renderFriends();
    
    // 注入预览模态框HTML (防止缺失)
    if(!document.getElementById('media-preview-modal')) {
        const div = document.createElement('div');
        div.innerHTML = previewModalHTML;
        document.body.appendChild(div.firstElementChild);
    }
});
