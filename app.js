document.addEventListener('DOMContentLoaded', () => {

    // ★★★ 替换为你的 Render 地址 ★★★
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 

    // --- 1. ID 与 数据 ---
    const DB_KEY = 'wojak_v17_db';
    let db = JSON.parse(localStorage.getItem(DB_KEY));
    if (!db || !db.profile) {
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), 
                avatarSeed: Math.random(),
                nickname: 'ME (ANON)' // 默认昵称
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // UI Init
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    document.getElementById('card-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60 });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 60, height: 60 });
    }

    // --- 2. Socket.io ---
    let socket = null;
    let activeChatId = null;

    if (!SERVER_URL.includes('onrender')) alert("Please set SERVER_URL in app.js");

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

    socket.on('receive_msg', (msg) => {
        handleIncomingMsg(msg);
    });

    function handleIncomingMsg(msg) {
        const fid = msg.from;
        if (!db.friends.find(f => f.id === fid)) {
            db.friends.push({ id: fid, addedAt: Date.now(), alias: `User ${fid}` });
        }
        
        if (!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
        saveDB();
        renderFriends();

        if (activeChatId === fid) {
            appendMsgDOM(msg, false);
        } else {
            // 收到消息提示音
            document.getElementById('msg-sound').play().catch(()=>{});
            // 列表高亮
            const item = document.getElementById(`friend-item-${fid}`);
            if(item) {
                item.style.background = "#fff";
                setTimeout(()=>item.style.background="#E6D3B3", 500);
            }
        }
    }

    // --- 3. UI 逻辑 ---
    
    // 修改自己的昵称
    window.editMyName = () => {
        const newName = prompt("Enter new nickname:", db.profile.nickname);
        if(newName) {
            db.profile.nickname = newName;
            saveDB();
            document.getElementById('my-nickname').innerText = newName;
        }
    }

    // 修改好友昵称
    window.editFriendName = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        if(f) {
            const newAlias = prompt("Rename Friend:", f.alias || f.id);
            if(newAlias) {
                f.alias = newAlias;
                saveDB();
                document.getElementById('chat-partner-name').innerText = newAlias;
                renderFriends();
            }
        }
    }

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
                    <div style="font-size:12px; color:green">CONNECTED</div>
                </div>
            `;
            div.onclick = () => openChat(f.id);
            list.appendChild(div);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        const name = f ? (f.alias || f.id) : id;
        
        document.getElementById('chat-partner-name').innerText = name;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('view-chat').classList.remove('right-sheet');
        document.getElementById('chat-online-dot').className = "status-dot online";
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    // 发送数据
    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
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
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // --- 交互事件 ---
    document.getElementById('chat-send-btn').onclick = () => {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    };
    
    document.getElementById('chat-back-btn').onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 修复：手动添加好友 (弹窗样式已修)
    document.getElementById('add-id-btn').onclick = () => document.getElementById('add-overlay').classList.remove('hidden');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) {
            window.hideAllModals();
            if(!db.friends.find(f=>f.id===id)) { 
                db.friends.push({id:id, addedAt:Date.now()}); 
                saveDB(); renderFriends(); 
            }
            openChat(id);
        }
    };

    // 修复：扫码逻辑 (增加反馈与跳转)
    window.hideAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e=>e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };
    
    document.getElementById('scan-btn').onclick = () => {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(()=>{
            try {
                const scanner = new Html5Qrcode("qr-reader");
                window.scanner = scanner;
                scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, txt => {
                    // 扫码成功：停止相机 -> 关闭弹窗 -> 震动 -> 播放音效 -> 加好友 -> 跳转
                    scanner.stop().catch(()=>{}); 
                    window.hideAllModals();
                    
                    if(navigator.vibrate) navigator.vibrate(200);
                    document.getElementById('scan-sound').play().catch(()=>{});
                    
                    if(txt.length === 4) {
                        if(!db.friends.find(f=>f.id===txt)) { 
                            db.friends.push({id:txt, addedAt:Date.now()}); 
                            saveDB(); renderFriends(); 
                        }
                        // 强制跳转
                        setTimeout(() => openChat(txt), 300);
                    } else {
                        alert("Invalid ID (Not 4 digits)");
                    }
                });
            } catch(e) { alert("Camera Error"); window.hideAllModals(); }
        }, 300);
    };

    // FM 电台
    const fm = document.getElementById('fm-radio');
    const fmBtn = document.getElementById('fm-btn');
    fmBtn.onclick = () => {
        if(fm.paused) { 
            fm.play(); fmBtn.innerText="📻 FM: ON"; fmBtn.style.color="#0f0"; 
        } else { 
            fm.pause(); fmBtn.innerText="📻 FM: OFF"; fmBtn.style.color="#fff"; 
        }
    };

    // 语音录制
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
        } catch(e) { alert("Mic Error (Check HTTPS)"); }
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

    // 表情
    const stickerUrls = [];
    for(let i=1; i<=30; i++) stickerUrls.push(`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*99}&backgroundColor=transparent`);
    const sGrid = document.getElementById('sticker-grid');
    stickerUrls.forEach(url => {
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    });
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');

    // 导航
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
