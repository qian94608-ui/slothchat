document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // ★★★ 第一步：必须修改这里 ★★★
    // 如果你没有后端，请去 Render 部署一个，或者暂时留空体验 UI
    // 格式如：'https://wojak-backend-xxxx.onrender.com'
    const SERVER_URL = 'https://wojak-backend.onrender.com'; 
    // =========================================================

    // --- 1. 优先绑定 UI (确保按钮可点击) ---
    console.log("Initializing UI...");

    // 导航切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        }
    });

    // 弹窗关闭逻辑
    window.closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(e => e.classList.add('hidden'));
        if(window.scanner) window.scanner.stop().catch(()=>{});
    };

    // 扫码按钮
    const scanBtn = document.getElementById('scan-btn');
    if(scanBtn) scanBtn.onclick = () => startScanner();

    // 添加好友按钮
    const addIdBtn = document.getElementById('add-id-btn');
    if(addIdBtn) addIdBtn.onclick = () => document.getElementById('add-overlay').classList.remove('hidden');

    // 确认添加按钮
    const confirmBtn = document.getElementById('confirm-add-btn');
    if(confirmBtn) confirmBtn.onclick = () => manualAddFriend();

    // 聊天返回
    const backBtn = document.getElementById('chat-back-btn');
    if(backBtn) backBtn.onclick = () => {
        document.getElementById('view-chat').classList.remove('active');
        setTimeout(()=>document.getElementById('view-chat').classList.add('right-sheet'), 300);
        activeChatId = null;
    };

    // 发送按钮
    const sendBtn = document.getElementById('chat-send-btn');
    if(sendBtn) sendBtn.onclick = () => sendTextMsg();

    // 强制重置数据 (救砖用)
    window.resetApp = () => {
        if(confirm("Fix Stuck App? (Clears Data)")) {
            localStorage.clear();
            location.reload();
        }
    };

    // 修改昵称
    window.editMyName = () => {
        const n = prompt("New Nickname:", db.profile.nickname);
        if(n) { db.profile.nickname = n; saveDB(); document.getElementById('my-nickname').innerText = n; }
    };

    // 切换输入模式
    document.getElementById('mode-switch-btn').onclick = () => {
        document.getElementById('input-mode-text').classList.toggle('hidden');
        document.getElementById('input-mode-voice').classList.toggle('hidden');
    };

    // FM 开关
    const fmAudio = document.getElementById('fm-radio');
    document.getElementById('fm-btn').onclick = () => {
        if(fmAudio.paused) { fmAudio.play(); alert("Radio ON"); }
        else { fmAudio.pause(); alert("Radio OFF"); }
    };

    // 贴纸面板
    document.getElementById('sticker-btn').onclick = () => document.getElementById('sticker-panel').classList.toggle('hidden');


    // --- 2. 数据初始化 ---
    const DB_KEY = 'pepe_v21_db';
    let db;
    try {
        db = JSON.parse(localStorage.getItem(DB_KEY));
        if (!db || !db.profile) throw new Error("Reset");
    } catch(e) {
        db = {
            profile: { id: String(Math.floor(1000 + Math.random() * 9000)), avatarSeed: Math.random(), nickname: 'Anon' },
            friends: [], history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;

    // 渲染个人信息
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-nickname').innerText = db.profile.nickname;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${db.profile.avatarSeed}`;
    
    // 生成二维码
    if(window.QRCode) {
        new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 60, height: 60, colorDark: "#388E3C", colorLight: "#FFFFFF" });
        new QRCode(document.querySelector(".qr-img"), { text: MY_ID, width: 60, height: 60 });
    }

    // --- 3. 网络连接 (放在最后，防止阻塞 UI) ---
    let socket = null;
    let activeChatId = null;

    function initNetwork() {
        const statusEl = document.getElementById('conn-status');
        
        if (SERVER_URL === 'CHANGE_THIS_TO_YOUR_RENDER_URL' || !SERVER_URL.startsWith('http')) {
            statusEl.innerText = "NO SERVER";
            alert("⚠️ 严重错误：\n你没有配置后端地址！\n请打开 app.js 修改 SERVER_URL。");
            return;
        }

        try {
            socket = io(SERVER_URL);

            socket.on('connect', () => {
                statusEl.innerText = "ONLINE";
                statusEl.className = "status-pill green";
                socket.emit('register', MY_ID);
            });

            socket.on('disconnect', () => {
                statusEl.innerText = "OFFLINE";
                statusEl.className = "status-pill red";
            });

            socket.on('receive_msg', (msg) => {
                const fid = msg.from;
                if (!db.friends.find(f => f.id === fid)) db.friends.push({ id: fid, addedAt: Date.now(), alias: `Fren ${fid}` });
                if (!db.history[fid]) db.history[fid] = [];
                db.history[fid].push({ type: msg.type, content: msg.content, isSelf: false, ts: msg.timestamp, fileName: msg.fileName });
                saveDB();
                renderFriends();

                if (activeChatId === fid) {
                    appendMsgDOM(msg, false);
                } else {
                    document.getElementById('success-sound').play().catch(()=>{});
                    if(navigator.vibrate) navigator.vibrate(200);
                }
            });
        } catch(e) {
            console.error("Socket Error:", e);
            statusEl.innerText = "ERROR";
        }
    }

    // --- 4. 业务逻辑实现 ---

    function startScanner() {
        document.getElementById('qr-overlay').classList.remove('hidden');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scanner = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:250}, txt => {
                document.getElementById('success-sound').play().catch(()=>{});
                if(navigator.vibrate) navigator.vibrate(500);
                scanner.stop().catch(()=>{});
                window.closeAllModals();
                
                if(txt.length === 4) {
                    addFriendLogic(txt);
                    // 强制跳转
                    setTimeout(() => openChat(txt), 300);
                } else {
                    alert("Invalid QR Code");
                }
            }).catch(e=>{ console.log("Cam Error", e); });
        }, 300);
    }

    function manualAddFriend() {
        const id = document.getElementById('manual-id-input').value;
        if(id.length===4) {
            window.closeAllModals();
            addFriendLogic(id);
            openChat(id);
        } else { alert("Must be 4 digits"); }
    }

    function addFriendLogic(id) {
        if(!db.friends.find(f=>f.id===id)) { 
            db.friends.push({id:id, addedAt:Date.now()}); 
            saveDB(); renderFriends(); 
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'k-list-item';
            const name = f.alias || f.id;
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/open-peeps/svg?seed=${f.id}" class="avatar-img"></div>
                <div><div style="font-weight:bold">${name}</div><div style="font-size:12px; color:green">FREN</div></div>
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
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg, msg.isSelf));
    }

    function sendTextMsg() {
        const txt = document.getElementById('chat-input').value;
        if(txt) { sendData('text', txt); document.getElementById('chat-input').value=''; }
    }

    function sendData(type, content, fileName = null) {
        if(!activeChatId) return;
        if(socket && socket.connected) {
            socket.emit('send_private', { targetId: activeChatId, content: content, type: type, fileName: fileName });
        } else {
            alert("Offline! Message saved locally.");
        }
        
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
        else if (msg.type === 'voice') html = `<div class="bubble" style="cursor:pointer; background:${isSelf?'#bdfcc9':'#fff'}" onclick="new Audio('${msg.content}').play()">🎤 Voice ▶</div>`;
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // 初始化运行
    renderFriends();
    initNetwork(); // 启动网络 (放在最后)

    // 语音录制
    const voiceBtn = document.getElementById('voice-record-btn');
    let mediaRecorder, audioChunks;
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
            voiceBtn.classList.add('recording'); voiceBtn.innerText = "RECORDING...";
        } catch(e) { alert("Mic Error"); }
    };
    const stopRec = () => { if(mediaRecorder) { mediaRecorder.stop(); voiceBtn.classList.remove('recording'); voiceBtn.innerText="HOLD TO SPEAK"; } };
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);

    // 表情
    const stickerUrls = [];
    for(let i=1; i<=20; i++) stickerUrls.push(`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${i*11}&backgroundColor=transparent`);
    const sGrid = document.getElementById('sticker-grid');
    stickerUrls.forEach(url => {
        const img = document.createElement('img'); img.src=url; img.className='sticker-item';
        img.onclick = () => { sendData('sticker', url); document.getElementById('sticker-panel').classList.add('hidden'); };
        sGrid.appendChild(img);
    });
});
