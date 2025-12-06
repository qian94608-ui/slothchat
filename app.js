document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 请填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com';

    // --- 0. 紧急 UI 修复 (最优先执行) ---
    try {
        // 1. 强制隐藏底部导航栏
        const nav = document.querySelector('.defi-nav');
        if(nav) nav.style.display = 'none';
        
        // 2. 注入样式 (修复层级遮挡 + Mac风格)
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            :root { --glass-bg: rgba(255, 255, 255, 0.95); --primary-mac: #007AFF; --danger-mac: #FF3B30; }
            body { background: #F2F2F7; font-family: -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; }
            
            /* 强制隐藏 */
            .defi-nav { display: none !important; }
            
            /* 模态框层级修复 - 确保在最顶层 */
            .modal-overlay { z-index: 100000 !important; background: rgba(0,0,0,0.6) !important; backdrop-filter: blur(5px); }
            .modal-box { z-index: 100001 !important; position: relative; background: #fff; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
            
            /* 按钮修复 */
            .defi-btn-primary { 
                background: #34C759 !important; /* 绿色 */
                color: #fff; font-weight: 800; border: none; border-radius: 12px;
                padding: 15px; width: 100%; font-size: 16px; margin-top: 10px;
                touch-action: manipulation; /* 优化点击 */
            }
            .defi-btn-primary:active { transform: scale(0.96); opacity: 0.9; }

            /* 输入框修复 */
            .defi-input {
                font-size: 24px !important; letter-spacing: 2px; font-weight: bold;
                border: 1px solid #ddd !important; background: #f9f9f9;
                border-radius: 12px !important; color: #333;
            }

            /* 消息列表样式 */
            .k-list-item {
                background: #fff; border-radius: 14px; padding: 14px; margin-bottom: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: transform 0.1s;
            }
            .k-list-item:active { background: #f0f0f0; }
            
            /* 气泡 */
            .bubble { border: none !important; border-radius: 18px !important; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 80%; }
            .msg-row.self .bubble { background: var(--primary-mac); color: #fff; }
            .msg-row.other .bubble { background: #fff; color: #000; }

            /* 拖拽层默认隐藏 */
            .drag-overlay { display: none; }
            .drag-overlay.active { display: flex; }
            
            /* 取消按钮 */
            .cancel-btn { position: absolute; top:-8px; right:-8px; background:rgba(0,0,0,0.6); color:#fff; width:20px; height:20px; border-radius:50%; text-align:center; line-height:20px; font-size:12px; cursor:pointer; z-index:10; }
        `;
        document.head.appendChild(styleSheet);
    } catch(e) { console.error("UI Init Error", e); }

    // --- 1. 数据层 ---
    const DB_KEY = 'pepe_v33_final_pro_v2';
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

    // --- 2. 核心功能函数 (提前定义) ---
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    function handleAddFriend(id) {
        if(id === MY_ID) return; // 不能加自己
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}`, unread: false });
            saveDB();
            renderFriends();
        }
        openChat(id);
    }

    // --- 3. 按钮事件绑定 (防御性绑定) ---
    const bindBtn = (id, handler) => {
        const el = document.getElementById(id);
        if(el) {
            el.onclick = (e) => { e.preventDefault(); handler(e); };
            el.ontouchstart = (e) => { e.preventDefault(); handler(e); }; // 兼容移动端
        }
    };

    // 打开添加框
    bindBtn('add-id-btn', () => {
        document.getElementById('add-overlay').classList.remove('hidden');
        setTimeout(() => document.getElementById('manual-id-input').focus(), 100);
    });

    // 确认添加 (Connect 按钮)
    bindBtn('confirm-add-btn', () => {
        const input = document.getElementById('manual-id-input');
        const val = input.value.trim();
        if(val.length === 4) {
            window.closeAllModals();
            handleAddFriend(val);
            input.value = '';
        } else {
            alert("ID must be 4 digits");
        }
    });

    // 扫码
    bindBtn('scan-btn', () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            if(window.Html5Qrcode) {
                const scanner = new Html5Qrcode("qr-reader");
                window.scanner = scanner;
                scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                    if(navigator.vibrate) navigator.vibrate(200);
                    scanner.stop().then(() => {
                        window.closeAllModals();
                        if(txt.length === 4) handleAddFriend(txt);
                    }).catch(()=>{ window.closeAllModals(); });
                }).catch(()=>{ alert("Camera Error"); window.closeAllModals(); });
            } else { alert("Scanner loading..."); window.closeAllModals(); }
        }, 300);
    });

    // --- 4. 渲染 UI ---
    const renderProfile = () => {
        try {
            document.getElementById('my-id-display').innerText = MY_ID;
            document.getElementById('my-nickname').innerText = db.profile.nickname;
            document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/notionists/svg?seed=${db.profile.avatarSeed}`;
            // 延时渲染二维码防止卡死
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

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=${f.id}" style="width:45px; height:45px; border-radius:50%; background:#f0f0f0;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:16px;">${f.alias || f.id}</div>
                        <div style="font-size:12px; color:#888;">${f.unread ? '<span style="color:red">● Message Coming...</span>' : 'Tap to chat'}</div>
                    </div>
                </div>
            `;
            div.onclick = () => { f.unread = false; saveDB(); renderFriends(); openChat(f.id); };
            list.appendChild(div);
        });
    }

    // --- 5. 网络与聊天 (独立运行) ---
    let socket = null;
    let activeChatId = null;
    let activeDownloads = {};
    let isSending = false;
    let cancelFlag = {};

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

    // --- 文件发送 ---
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

    // --- 辅助 UI ---
    function openChat(id) {
        activeChatId = id; const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f ? (f.alias || f.id) : id;
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

    // --- Utils ---
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
    
    window.editMyName = () => { const n = prompt("New Name:", db.profile.nickname); if(n) { db.profile.nickname=n; saveDB(); renderProfile(); } };
    window.editFriendName = () => { if(activeChatId) { const f=db.friends.find(x=>x.id===activeChatId); const n=prompt("Alias:", f.alias||f.id); if(n){ f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); } } };
    
    window.playVoice = (url, id) => {
        const a = new Audio(url); a.play();
        const b = document.getElementById(id);
        if(b) { b.classList.add('playing'); a.onended = () => b.classList.remove('playing'); }
    };

    // Chat UI Events
    document.getElementById('chat-send-btn').onclick = () => { const t = document.getElementById('chat-input'); if(t.value) { sendData('text', t.value); t.value=''; } };
    document.getElementById('chat-back-btn').onclick = window.goBack;
    
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

    const sGrid = document.getElementById('sticker-grid');
    sGrid.innerHTML = '';
    for(let i=0; i<12; i++) {
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*11}&backgroundColor=transparent`;
        img.className = 'sticker-item'; img.style.width='60px'; img.style.cursor='pointer';
        img.onclick = () => { if(activeChatId) { sendData('sticker', img.src); document.getElementById('sticker-panel').classList.add('hidden'); } };
        sGrid.appendChild(img);
    }
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');
    document.getElementById('file-btn').onclick = () => document.getElementById('chat-file-input').click();
    document.getElementById('chat-file-input').onchange = e => { if(e.target.files[0]) sendFileChunked(e.target.files[0]); };
    document.getElementById('mode-switch-btn').onclick = () => {
        const v = document.getElementById('voice-record-btn');
        const t = document.getElementById('text-input-wrapper');
        const b = document.getElementById('mode-switch-btn');
        if(t.classList.contains('hidden')) { t.classList.remove('hidden'); t.style.display='flex'; v.classList.add('hidden'); v.style.display='none'; b.innerText='🎤'; }
        else { t.classList.add('hidden'); t.style.display='none'; v.classList.remove('hidden'); v.style.display='block'; b.innerText='⌨️'; }
    };

    // Inject Preview HTML if missing
    if(!document.getElementById('media-preview-modal')) {
        const div = document.createElement('div'); div.innerHTML = previewModalHTML; document.body.appendChild(div.firstElementChild);
    }
});
