document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 动态样式 (修复图片适配、表情大小、按钮层级) ---
    try {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            :root {
                --glass-bg: rgba(255, 255, 255, 0.95);
                --primary: #59BC10; 
                --danger: #FF3B30;
                --shadow-sm: 0 2px 8px rgba(0,0,0,0.08);
            }
            body { background: #F2F2F7; font-family: -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
            
            /* 强制隐藏旧导航 */
            .defi-nav { display: none !important; }
            .scroll-content { padding-bottom: 30px !important; }

            /* ★ 修复4：图片/视频 自适应底框，去除黑边 ★ */
            .thumb-box { 
                position: relative; 
                max-width: 200px; /* 限制最大宽 */
                height: auto;     /* 高度自适应 */
                border-radius: 12px; 
                overflow: hidden; 
                background: transparent; /* 去除黑色背景 */
                display: inline-block;
                line-height: 0; /* 防止底部留白 */
            }
            .thumb-img { 
                max-width: 100%; 
                height: auto; 
                object-fit: contain; 
                display: block; 
            }
            
            /* 视频特殊处理：给个最小高度方便点击 */
            .video-box {
                background: #000;
                min-width: 120px;
                min-height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* ★ 修复1：表情包强制大小 ★ */
            .sticker-img { 
                width: 80px !important; 
                height: 80px !important; 
                object-fit: contain !important; 
                display: block;
            }

            /* 气泡样式 */
            .bubble { 
                border: none !important; 
                border-radius: 18px !important; 
                padding: 10px 14px; 
                box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
                background: #fff;
                max-width: 80%;
                word-wrap: break-word;
            }
            .msg-row.self .bubble { background: var(--primary); color: #fff; }
            .msg-row.other .bubble { background: #fff; color: #000; }

            /* 语音波纹 */
            .voice-bubble { display: flex; align-items: center; gap: 8px; min-width: 100px; }
            .wave-visual { display: flex; align-items: center; gap: 3px; height: 16px; }
            .wave-bar { width: 3px; height: 30%; background: #ccc; border-radius: 2px; }
            .voice-bubble.playing .wave-bar { animation: wave 0.5s infinite ease-in-out; background: #fff !important; }
            .voice-bubble.other.playing .wave-bar { background: var(--primary) !important; }
            @keyframes wave { 0%,100%{height:30%;} 50%{height:100%;} }
            .voice-bubble.playing .wave-bar:nth-child(2) { animation-delay: 0.1s; }
            .voice-bubble.playing .wave-bar:nth-child(3) { animation-delay: 0.2s; }

            /* 列表与提醒 */
            .k-list-item { background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow-sm); border: none; }
            .shake-active { animation: shake 0.5s infinite; border-left: 4px solid var(--danger); }
            @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-3px);} 75%{transform:translateX(3px);} }
            .marquee-box { overflow: hidden; max-width: 120px; white-space: nowrap; }
            .marquee-text { display: inline-block; padding-left: 100%; animation: scroll 4s linear infinite; color: var(--danger); font-size: 10px; font-weight: bold; }
            @keyframes scroll { 100% { transform: translateX(-100%); } }

            /* 模态框与按钮 */
            .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(5px); }
            .cancel-btn { position: absolute; top: 5px; right: 5px; background:rgba(0,0,0,0.6); color:#fff; width:22px; height:22px; border-radius:50%; text-align:center; line-height:22px; font-size:14px; cursor:pointer; z-index:10; }
            
            /* 拖拽层 */
            .drag-overlay { display: none; z-index: 99999; }
            .drag-overlay.active { display: flex; }

            /* ★ 修复3：发送按钮层级 ★ */
            .send-arrow { position: relative; z-index: 50; cursor: pointer; }
        `;
        document.head.appendChild(styleSheet);
    } catch(e) { console.error("UI Init Error", e); }

    // --- 1. 数据层 ---
    const DB_KEY = 'pepe_v33_fix_v4';
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

    // --- 2. 状态管理 ---
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};

    // --- 3. 核心功能函数 ---
    
    // 渲染个人信息
    const renderProfile = () => {
        try {
            document.getElementById('my-id-display').innerText = MY_ID;
            document.getElementById('my-nickname').innerText = db.profile.nickname;
            document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
            setTimeout(() => {
                const qrEl = document.getElementById("qrcode");
                if(qrEl && window.QRCode) {
                    qrEl.innerHTML = '';
                    new QRCode(qrEl, { text: MY_ID, width: 60, height: 60, colorDark: "#000000", colorLight: "#FFFFFF" });
                }
            }, 500);
        } catch(e) {}
    };
    renderProfile();

    // 渲染好友列表
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
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; height:45px; border-radius:50%; background:#eee;">
                    <div style="flex:1;">${namePart}<div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● New Message</span>' : 'Tap to chat'}</div></div>
                </div>
            `;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }

    // 打开聊天
    function openChat(id) {
        if('speechSynthesis' in window) window.speechSynthesis.cancel(); // 停止语音播报

        activeChatId = id; 
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
        
        document.getElementById('chat-online-dot').className = "status-dot red";
        
        const chatView = document.getElementById('view-chat');
        chatView.classList.remove('right-sheet');
        chatView.classList.add('active');
        
        window.history.pushState({ chatOpen: true, id: id }, "");

        const container = document.getElementById('messages-container'); 
        container.innerHTML = '';
        const msgs = db.history[id] || []; 
        msgs.forEach(m => appendMsgDOM(m, m.isSelf));
    }

    // 返回处理
    window.addEventListener('popstate', (event) => {
        const previewModal = document.getElementById('media-preview-modal');
        if (!previewModal.classList.contains('hidden')) {
            window.closePreview();
            return;
        }
        const chatView = document.getElementById('view-chat');
        if (chatView.classList.contains('active')) {
            chatView.classList.remove('active');
            setTimeout(() => chatView.classList.add('right-sheet'), 300);
            activeChatId = null;
            renderFriends();
        }
    });
    window.goBack = () => window.history.back();

    // --- 4. 消息渲染 (★ 修复：图片适配 & 表情大小) ---
    function appendMsgDOM(msg, isSelf) {
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); 
        div.className = `msg-row ${isSelf?'self':'other'}`;
        const uid = Date.now() + Math.random().toString().substr(2,5); 
        let html = '';

        if(msg.type==='text') {
            html=`<div class="bubble">${msg.content}</div>`;
        } 
        else if(msg.type==='sticker') {
            // ★ 修复：表情包不加 bubble 背景，直接显示图片，且限制大小
            html=`<div style="padding:5px;"><img src="${msg.content}" class="sticker-img" style="width:80px; height:80px; object-fit:contain;"></div>`;
        }
        else if(msg.type==='voice') {
            html=`<div id="voice-${uid}" class="bubble voice-bubble ${isSelf?'self':'other'}" style="cursor:pointer;" onclick="playVoice('${msg.content}', 'voice-${uid}')">
                    <span>▶ Voice</span>
                    <div class="wave-visual"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div>
                  </div>`;
        } 
        else if(msg.type==='image') {
            // ★ 修复：thumb-box 宽高自适应，不再全屏
            html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;">
                    <div class="thumb-box" onclick="previewMedia('${msg.content}','image')">
                        <img src="${msg.content}" class="thumb-img">
                    </div>
                  </div>`;
        } 
        else if(msg.type==='video') {
            html=`<div class="bubble" style="padding:4px; background:transparent; box-shadow:none;">
                    <div class="thumb-box video-box" onclick="previewMedia('${msg.content}','video')">
                        <span style="color:#fff; font-size:24px;">▶</span>
                    </div>
                  </div>`;
        } 
        else if(msg.type==='file') {
            html=`<div class="bubble">📂 ${msg.fileName}<br><a href="${msg.content}" download="${msg.fileName}" style="text-decoration:underline;">Download</a></div>`;
        }
        
        div.innerHTML = html; 
        box.appendChild(div); 
        box.scrollTop = box.scrollHeight;
    }

    function appendProgressBubble(chatId, fileId, fileName, type, isSelf) {
        if(activeChatId !== chatId) return;
        const box = document.getElementById('messages-container');
        const div = document.createElement('div'); div.id = `progress-row-${fileId}`; div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `
            <div class="bubble" style="min-width:160px; font-size:12px; position:relative;">
                <div class="cancel-btn" onclick="cancelTransfer('${fileId}', ${isSelf})">✕</div>
                <div style="font-weight:bold; margin-bottom:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis;">${isSelf?'⬆':'⬇'} ${fileName||'File'}</div>
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

    // --- 5. 网络层 (隧道协议) ---
    if(!SERVER_URL.includes('onrender')) alert("Configure SERVER_URL!");
    else {
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
                if('speechSynthesis' in window && !window.speechSynthesis.speaking) {
                    const u = new SpeechSynthesisUtterance("Message coming");
                    const v = window.speechSynthesis.getVoices().find(x=>x.name.includes('Female'));
                    if(v) u.voice = v;
                    window.speechSynthesis.speak(u);
                } else document.getElementById('msg-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(100);
            }

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

    // --- 6. 发送逻辑 (隧道) ---
    function sendFileChunked(file) {
        if(!activeChatId || !socket || !socket.connected) { alert("Connect first"); return; }
        if(isSending) { alert("Busy"); return; }
        
        isSending = true;
        const fileId = Date.now() + '-' + Math.random().toString(36).substr(2,9);
        const sendName = file.name || `file_${Date.now()}`;
        const sendType = file.type || 'application/octet-stream';
        
        cancelFlag[fileId] = false;
        appendProgressBubble(activeChatId, fileId, sendName, sendType, true);
        
        let offset = 0; let lastTime = Date.now(); let lastBytes = 0; const total = file.size;

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

    // --- 7. 工具与绑定 ---
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
    
    // 修复权限：通过点击请求
    const reqPerms = async () => {
        try { await navigator.mediaDevices.getUserMedia({audio:true}); } catch(e){}
    };
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
                sendFileChunked(f); 
                s.getTracks().forEach(t=>t.stop());
            };
            rec.start();
            vBtn.innerText="RECORDING..."; vBtn.classList.add('recording');
        } catch(e){ alert("Mic Required!"); }
    };
    const stopR = (e) => {
        e.preventDefault();
        if(rec && rec.state!=='inactive') {
            rec.stop();
            vBtn.classList.remove('recording');
            vBtn.innerText="HOLD TO SPEAK";
        }
    };
    vBtn.addEventListener('mousedown', startR); vBtn.addEventListener('mouseup', stopR);
    vBtn.addEventListener('touchstart', startR); vBtn.addEventListener('touchend', stopR);

    // ★ 修复3：文本发送绑定 ★
    const sendBtn = document.getElementById('chat-send-btn');
    const handleSend = (e) => {
        e.preventDefault();
        const t = document.getElementById('chat-input');
        if(t.value.trim()) { 
            sendData('text', t.value); 
            t.value=''; 
        }
    };
    sendBtn.onclick = handleSend;
    sendBtn.ontouchstart = handleSend;

    // 拖拽修复 (★ 修复2：文件夹判定 ★)
    const drag = document.getElementById('drag-overlay');
    window.addEventListener('dragenter', () => { if(activeChatId) drag.classList.remove('hidden'); });
    drag.addEventListener('dragleave', (e) => { if(e.target===drag) drag.classList.add('hidden'); });
    window.addEventListener('dragover', e=>e.preventDefault());
    window.addEventListener('drop', e => { 
        e.preventDefault(); drag.classList.add('hidden');
        if(activeChatId && e.dataTransfer.files[0]) {
            const f = e.dataTransfer.files[0];
            // 只有当 size 为 0 时才断定为文件夹（更宽松的判定）
            if(!f.type && f.size===0) {
                alert("Folder not supported"); 
            } else {
                sendFileChunked(f);
            }
        }
    });

    // 绑定 Scan & Add
    const bindBtn = (id, fn) => { const el=document.getElementById(id); if(el) { el.onclick=fn; el.ontouchstart=fn; }};
    
    // Add ID
    bindBtn('add-id-btn', () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        document.getElementById('manual-id-input').focus();
    });
    bindBtn('confirm-add-btn', () => {
        const v = document.getElementById('manual-id-input').value;
        if(v.length===4) { 
            window.closeAllModals(); 
            if(v !== MY_ID) {
                if(!db.friends.find(f => f.id === v)) {
                    db.friends.push({ id: v, addedAt: Date.now(), alias: `User ${v}`, unread: false });
                    saveDB();
                    renderFriends();
                }
                openChat(v);
            }
            document.getElementById('manual-id-input').value='';
        }
    });

    // Scan
    bindBtn('scan-btn', () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const s = new Html5Qrcode("qr-reader"); window.scanner = s;
                s.start({facingMode:"environment"}, {fps:10, qrbox:200}, t => {
                    s.stop().then(()=>{ 
                        window.closeAllModals(); 
                        if(t.length===4 && t!==MY_ID) {
                            if(!db.friends.find(f => f.id === t)) {
                                db.friends.push({ id: t, addedAt: Date.now(), alias: `User ${t}`, unread: false });
                                saveDB(); renderFriends();
                            }
                            openChat(t);
                        }
                    });
                });
            } else alert("Scanner Loading...");
        }, 300);
    });

    // 其他事件
    document.getElementById('chat-back-btn').onclick = window.goBack;
    
    // 切换输入模式
    document.getElementById('mode-switch-btn').onclick = () => {
        const v = document.getElementById('voice-record-btn');
        const t = document.getElementById('text-input-wrapper');
        const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { 
            t.classList.remove('hidden'); t.style.display='flex'; 
            v.classList.add('hidden'); v.style.display='none'; 
            b.innerText='🎤'; 
        } else { 
            t.classList.add('hidden'); t.style.display='none'; 
            v.classList.remove('hidden'); v.style.display='block'; 
            b.innerText='⌨️'; 
        }
    };

    // 文件与表情
    document.getElementById('file-btn').onclick = () => document.getElementById('chat-file-input').click();
    document.getElementById('chat-file-input').onchange = e => { if(e.target.files[0]) sendFileChunked(e.target.files[0]); };
    
    // ★ 修复1：表情包修复 ★
    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<12; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*13}&backgroundColor=transparent`;
        img.className='sticker-item'; 
        // 强制 JS 内联样式，确保大小
        img.style.cssText = "width:60px; height:60px; object-fit:contain; cursor:pointer;";
        img.onclick = () => { 
            if(activeChatId) { 
                sendData('sticker', img.src); 
                document.getElementById('sticker-panel').classList.add('hidden'); 
            } else {
                alert("Open a chat first");
            }
        };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // Global
    window.closeAllModals = () => { document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden')); if(window.scanner) window.scanner.stop().catch(()=>{}); };
    window.cancelTransfer = (id, isSelf) => { if(isSelf) cancelFlag[id]=true; else activeDownloads[id]='cancelled'; document.getElementById(`progress-row-${id}`).innerHTML='<div class="bubble" style="color:red;font-size:12px;">🚫 Cancelled</div>'; };
    window.previewMedia = (url, type) => {
        const m = document.getElementById('media-preview-modal'); const c = document.getElementById('preview-container'); c.innerHTML='';
        let el = type==='image' ? document.createElement('img') : document.createElement('video');
        el.src = url; el.style.maxWidth='100%'; el.style.maxHeight='100vh'; if(type==='video') { el.controls=true; el.autoplay=true; }
        c.appendChild(el); m.classList.remove('hidden'); m.style.display='flex'; window.history.pushState({p:1},"");
    };
    window.closePreview = () => { document.getElementById('media-preview-modal').classList.add('hidden'); document.getElementById('media-preview-modal').style.display='none'; };
    window.playVoice = (url, id) => { const a = new Audio(url); a.play(); const b = document.getElementById(id); if(b) { b.classList.add('playing'); a.onended=()=>b.classList.remove('playing'); } };
    
    // ID 卡渲染
    renderFriends(); 
    
    // 初始化点击音效权限
    document.body.addEventListener('click', () => {
        document.getElementById('msg-sound').load();
    }, {once:true});
});
