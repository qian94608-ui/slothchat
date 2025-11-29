document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 务必填入你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. 安全初始化 (防止LS数据损坏导致JS报错) ---
    const DB_KEY = 'wojak_v18_db';
    let db;
    
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        // 简单的数据结构校验
        if (!db || !db.profile || !db.friends) throw new Error("Data corruption");
    } catch (e) {
        console.log("Resetting DB...");
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), 
                avatarSeed: Math.random(),
                nickname: 'ME (ANON)' 
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // --- 2. 绑定 UI ---
    try {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('card-id-text').innerText = MY_ID;
        document.getElementById('my-nickname').innerText = db.profile.nickname;
        document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
        document.getElementById('card-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
        
        if(window.QRCode) {
            new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60 });
            new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 50, height: 50 });
        }
    } catch(e) { console.error("UI Render Error", e); }

    // --- 3. Socket.io 连接 ---
    let socket = null;
    let activeChatId = null;

    if (SERVER_URL.includes('onrender')) {
        socket = io(SERVER_URL);
        socket.on('connect', () => {
            document.getElementById('conn-status').innerText = "ONLINE";
            document.getElementById('conn-status').className = "status-badge green";
            socket.emit('register', MY_ID);
        });
        socket.on('disconnect', () => {
            document.getElementById('conn-status').innerText = "OFFLINE";
            document.getElementById('conn-status').className = "status-badge red";
        });
        socket.on('receive_msg', (msg) => handleIncomingMsg(msg));
    } else {
        alert("Wojak Error: Backend URL not set in app.js!");
    }

    // --- 4. 核心逻辑：加好友、扫码、聊天 ---

    // 显示/隐藏 弹窗
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    // 手动添加
    document.getElementById('add-id-btn').onclick = () => {
        document.getElementById('add-overlay').classList.remove('hidden');
    };

    document.getElementById('confirm-add-btn').onclick = () => {
        const input = document.getElementById('manual-id-input');
        const id = input.value.trim();
        
        if (id.length === 4) {
            window.closeAllModals();
            addFriendLogic(id);
            // 立即反馈
            alert("✅ ADDED: " + id);
            openChat(id);
            input.value = '';
        } else {
            alert("❌ ID must be 4 numbers");
        }
    };

    // 扫码添加 (完全重写)
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        
        // 延时启动，防止DOM未渲染
        setTimeout(() => {
            if(window.scanner) window.scanner.clear();
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            
            const config = { fps: 10, qrbox: 200 };
            
            scanner.start({ facingMode: "environment" }, config, (decodedText) => {
                // 扫码成功回调
                document.getElementById('scan-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(200);
                
                window.closeAllModals(); // 立即关闭扫码框
                
                if(decodedText.length === 4) {
                    addFriendLogic(decodedText);
                    alert("✅ FOUND FREN: " + decodedText);
                    openChat(decodedText);
                } else {
                    alert("❌ Invalid QR Code");
                }
            }).catch(err => {
                console.error(err);
                alert("Camera Error. Check Permissions.");
                window.closeAllModals();
            });
        }, 300);
    };

    function addFriendLogic(id) {
        if (!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, addedAt: Date.now(), alias: `User ${id}` });
            saveDB();
            renderFriends();
        }
    }

    // 渲染好友列表
    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.id = `friend-item-${f.id}`;
            const displayName = f.alias || f.id;
            
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${displayName}</div>
                    <div style="font-size:12px; color:green">SAVED</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    // 打开聊天
    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        const name = f ? (f.alias || f.id) : id;
        
        document.getElementById('chat-partner-name').innerText = name;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        document.getElementById('chat-online-dot').className = "status-dot online";
        
        // 渲染历史
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    // 消息处理
    function handleIncomingMsg(msg) {
        const fid = msg.from;
        addFriendLogic(fid); // 自动加好友
        
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            document.getElementById('msg-sound').play().catch(()=>{});
            // 列表闪烁
            const item = document.getElementById(`friend-item-${fid}`);
            if(item) { item.style.background = "#fff"; setTimeout(()=>item.style.background="#E6D3B3", 500); }
        }
    }

    function sendData(type, content, fileName = null) {
        if(!activeChatId || !socket) return;
        socket.emit('send_private', { targetId: activeChatId, content: content, type: type, fileName: fileName });
        
        const msgObj = { type: type, content: content, isSelf: true, ts: Date.now(), fileName: fileName };
        if (!db.history[activeChatId]) db.history[activeChatId] = [];
        db.history[activeChatId].push(msgObj);
        saveDB();
        appendMsgDOM(msgObj, true);
    }

    function appendMsgDOM(msg, isSelf) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        let html = '';
        
        if (msg.type === 'text') html = `<div class="bubble">${msg.content}</div>`;
        else if (msg.type === 'sticker') html = `<img src="${msg.content}" class="sticker-img">`;
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#bdfcc9':'#fff'}" onclick="new Audio('${msg.content}').play()">🎤 Voice Clip ▶</div>`;
        else if (msg.type === 'image') html = `<div class="bubble"><img src="${msg.content}" style="max-width:150px; border-radius:5px;"><br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Save</button></div>`;
        else if (msg.type === 'file') html = `<div class="bubble">📂 ${msg.fileName}<br><button onclick="downloadBase64('${msg.content}', '${msg.fileName}')">⬇ Download</button></div>`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // --- 5. 交互绑定 ---
    
    // 发送
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    
    // 返回
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 录音
    let mediaRecorder, audioChunks;
    const voiceBtn = document.getElementById('voice-record-btn');
    
    const startRec = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, {type:'audio/webm'});
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => sendData('voice', reader.result);
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
            voiceBtn.innerText = "RECORDING...";
        } catch(e) { alert("Mic Error (Needs HTTPS)"); }
    };
    const stopRec = () => {
        if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; }
    };
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // 模式切换
    let isVoice = true;
    const switchBtn = document.getElementById('mode-switch-btn');
    switchBtn.onclick = () => {
        isVoice = !isVoice;
        if(isVoice) {
            document.getElementById('input-mode-text').classList.add('hidden');
            document.getElementById('input-mode-voice').classList.remove('hidden');
        } else {
            document.getElementById('input-mode-voice').classList.add('hidden');
            document.getElementById('input-mode-text').classList.remove('hidden');
        }
    };

    // 重置 APP
    window.resetApp = () => {
        if(confirm("Reset ID and all data?")) {
            localStorage.clear();
            location.reload();
        }
    };

    // 其他
    window.editMyName = () => {
        const n = prompt("New Name:", db.profile.nickname);
        if(n) { db.profile.nickname=n; saveDB(); document.getElementById('my-nickname').innerText=n; }
    };
    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x=>x.id===activeChatId);
        const n = prompt("Rename:", f.alias||f.id);
        if(n) { f.alias=n; saveDB(); document.getElementById('chat-partner-name').innerText=n; renderFriends(); }
    };
    
    // 表情与FM
    const stickerUrls = [];
    for(let i=1; i<=30; i++) stickerUrls.push(`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*99}&backgroundColor=transparent`);
    const sGrid = document.getElementById('sticker-grid');
    stickerUrls.forEach(url => {
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    const fmAudio = document.getElementById('fm-radio');
    const fmBtn = document.getElementById('fm-btn');
    fmBtn.onclick = () => {
        if(fmAudio.paused) { fmAudio.play(); fmBtn.innerText="📻 ON"; fmBtn.style.color="#0f0"; }
        else { fmAudio.pause(); fmBtn.innerText="📻 OFF"; fmBtn.style.color="#fff"; }
    };

    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    renderFriends();
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
