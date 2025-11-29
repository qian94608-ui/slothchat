document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ID系统 (4位数字) & 持久化
    // ==========================================
    const DB_KEY = 'wojak_v9_db';
    let db = JSON.parse(localStorage.getItem(DB_KEY));

    // 如果ID不是4位数字，强制重置 (解决老用户ID过长的问题)
    if (!db || !db.profile || !/^\d{4}$/.test(db.profile.id)) {
        db = {
            profile: { 
                id: String(Math.floor(1000 + Math.random() * 9000)), // 4位数字
                avatarSeed: Math.random() 
            },
            friends: [],
            history: {}
        };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    
    const saveDB = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const MY_ID = db.profile.id;
    
    let activeChatId = null;
    let connections = {};
    let peer = null;

    // UI渲染
    document.getElementById('my-id-display').innerText = MY_ID;
    document.getElementById('card-id-text').innerText = MY_ID;
    document.getElementById('my-avatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${db.profile.avatarSeed}`;
    if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 150, height: 150 });


    // ==========================================
    // 2. 扫码与添加 (Instant Action)
    // ==========================================
    const showModal = (id) => { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).style.display='flex'; };
    const hideModal = (id) => { document.getElementById(id).classList.add('hidden'); document.getElementById(id).style.display='none'; };
    
    window.hideAllModals = () => {
        hideModal('qr-overlay'); hideModal('add-overlay');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    // 扫码逻辑 - 扫到直接添加，不犹豫
    document.getElementById('scan-btn').onclick = () => {
        showModal('qr-overlay');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:15, qrbox:200}, (txt)=>{
                // 成功回调
                document.getElementById('scan-sound').play().catch(()=>{});
                hideAllModals();
                
                // 执行添加
                initiateFriendship(txt);
            });
        }, 300);
    };

    // 手动添加
    document.getElementById('add-id-btn').onclick = () => {
        showModal('add-overlay');
        setTimeout(() => document.getElementById('manual-id-input').focus(), 100);
    };
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id.length === 4) { 
            hideAllModals();
            initiateFriendship(id);
            document.getElementById('manual-id-input').value = '';
        } else {
            alert("ID MUST BE 4 DIGITS");
        }
    };

    // 统一添加好友入口
    function initiateFriendship(id) {
        if(id === MY_ID) return;
        addFriendLocal(id);
        connectTo(id); // 立即发起连接
        setTimeout(() => openChat(id), 100); // 立即跳转UI
    }


    // ==========================================
    // 3. 网络层 (强制握手与重连)
    // ==========================================
    const statusEl = document.getElementById('server-status');

    try {
        // 初始化PeerJS
        peer = new Peer(MY_ID);
        
        peer.on('open', () => {
            statusEl.innerText = "SERVER OK";
            statusEl.style.background = "green";
            // 上线后，立即向所有好友发起重连
            reconnectAll();
        });

        peer.on('connection', (conn) => {
            handleConnection(conn);
        });

        peer.on('error', err => {
            console.log(err);
            statusEl.innerText = "ERR: " + err.type;
            statusEl.style.background = "red";
            if(err.type === 'peer-unavailable') {
                // 对方不在线，不做处理，等待重连轮询
            }
        });

    } catch(e) { console.error(e); }

    function connectTo(id) {
        if(!peer || peer.destroyed) return;
        const conn = peer.connect(id);
        handleConnection(conn);
    }

    function handleConnection(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            
            // ★ 关键：握手协议 ★
            // 连接建立后，立即发送一个 handshake 包
            // 告诉对方 "我是谁，请把我加为好友"
            conn.send({ type: 'handshake', from: MY_ID });

            // 如果此时我还没有加他（被动连接），现在加
            addFriendLocal(conn.peer);
            
            renderFriends();
            updateChatStatus(conn.peer);
        });

        conn.on('data', (d) => {
            if(d.type === 'handshake') {
                // 收到握手包，确保对方在我的好友列表里
                addFriendLocal(d.from);
                renderFriends();
                // 回复一个 ACK (可选，保持心跳即可)
            }
            else if(d.type === 'text') {
                saveMessage(conn.peer, d.content, 'text', false);
                if(activeChatId === conn.peer) {
                    appendMsgDOM(d.content, false, 'text');
                } else {
                    document.getElementById('msg-sound').play().catch(()=>{});
                }
            } 
            else if (d.type === 'voice') {
                const blob = new Blob([d.file], {type: d.fileType});
                const url = URL.createObjectURL(blob);
                if(activeChatId === conn.peer) appendMsgDOM(url, false, 'voice');
            }
        });

        conn.on('close', () => {
            // 连接断开
            renderFriends();
            updateChatStatus(conn.peer);
        });
    }

    // ★ 暴力重连轮询 ★
    // 每3秒检查一次离线好友并尝试重连
    setInterval(reconnectAll, 3000);

    function reconnectAll() {
        if(!peer || peer.destroyed) return;
        db.friends.forEach(f => {
            if(!connections[f.id] || !connections[f.id].open) {
                connectTo(f.id);
            }
        });
    }


    // ==========================================
    // 4. 数据与UI (左滑删除 & 语音)
    // ==========================================
    function addFriendLocal(id) {
        if(!db.friends.find(f => f.id === id)) {
            db.friends.push({ id: id, alias: '', addedAt: Date.now() });
            saveDB();
        }
    }

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        list.innerHTML = '';
        db.friends.forEach(f => {
            const isOnline = connections[f.id] && connections[f.id].open;
            const displayName = f.alias || f.id;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'list-item-wrapper';
            
            const content = document.createElement('div');
            content.className = 'k-list-item';
            content.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.id}" class="avatar-img"></div>
                <div style="pointer-events:none;">
                    <div style="font-weight:bold">${displayName}</div>
                    <div style="font-size:12px; color:${isOnline?'green':'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;
            
            const delBtn = document.createElement('div');
            delBtn.className = 'delete-action';
            delBtn.innerText = 'DEL';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm('Delete?')) {
                    db.friends = db.friends.filter(x => x.id !== f.id);
                    saveDB();
                    renderFriends();
                }
            };

            // Touch Swipe Logic
            let startX;
            content.addEventListener('touchstart', e => startX = e.touches[0].clientX);
            content.addEventListener('touchmove', e => {
                let diff = e.touches[0].clientX - startX;
                if(diff < 0 && diff > -100) content.style.transform = `translateX(${diff}px)`;
            });
            content.addEventListener('touchend', e => {
                let diff = e.changedTouches[0].clientX - startX;
                content.style.transform = diff < -50 ? `translateX(-80px)` : `translateX(0px)`;
            });
            content.addEventListener('click', () => {
                if(content.style.transform==='translateX(-80px)') content.style.transform='translateX(0)';
                else openChat(f.id);
            });

            wrapper.appendChild(delBtn);
            wrapper.appendChild(content);
            list.appendChild(wrapper);
        });
    }

    function openChat(id) {
        activeChatId = id;
        const f = db.friends.find(x => x.id === id);
        document.getElementById('chat-partner-name').innerText = f && f.alias ? f.alias : id;
        document.getElementById('view-chat').classList.add('active');
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        const history = db.history[id] || [];
        history.forEach(msg => appendMsgDOM(msg.content, msg.isSelf, msg.type));
        
        updateChatStatus(id);
        window.history.pushState({view:'chat'}, '', '#chat');
    }

    function updateChatStatus(id) {
        if(activeChatId !== id) return;
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }

    // 消息发送与语音
    function saveMessage(fid, content, type, isSelf) {
        if(!db.history[fid]) db.history[fid] = [];
        db.history[fid].push({ type, content, isSelf, ts: Date.now() });
        saveDB();
    }

    function appendMsgDOM(content, isSelf, type) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        if(type === 'text') div.innerHTML = `<div class="bubble">${content}</div>`;
        else if (type === 'voice') div.innerHTML = `<div class="audio-msg" onclick="this.children[1].play()"><span>▶️</span><audio src="${content}"></audio><span>Voice</span></div>`;
        document.getElementById('messages-container').appendChild(div);
        document.getElementById('messages-container').scrollTop = 99999;
    }

    // 语音/文本切换
    let isVoice = true;
    const switchBtn = document.getElementById('mode-switch-btn');
    switchBtn.onclick = () => {
        isVoice = !isVoice;
        if(isVoice) {
            document.getElementById('input-mode-text').classList.add('hidden');
            document.getElementById('input-mode-voice').classList.remove('hidden');
            switchBtn.innerText = '⌨️';
        } else {
            document.getElementById('input-mode-voice').classList.add('hidden');
            document.getElementById('input-mode-text').classList.remove('hidden');
            switchBtn.innerText = '🎤';
        }
    };

    // 发送文本
    document.getElementById('chat-send-btn').onclick = () => {
        const val = document.getElementById('chat-input').value;
        if(val && activeChatId) {
            if(connections[activeChatId]) connections[activeChatId].send({type:'text', content:val});
            saveMessage(activeChatId, val, 'text', true);
            appendMsgDOM(val, true, 'text');
            document.getElementById('chat-input').value = '';
        }
    };

    // 录音逻辑
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
                if(activeChatId && connections[activeChatId]) {
                    connections[activeChatId].send({type:'voice', file:blob, fileType:'audio/webm'});
                }
                appendMsgDOM(URL.createObjectURL(blob), true, 'voice');
            };
            mediaRecorder.start();
            voiceBtn.style.background = 'red'; voiceBtn.style.color='white'; voiceBtn.innerText="RECORDING...";
        } catch(e){ alert("Mic Error"); }
    };
    const stopRec = () => {
        if(mediaRecorder) {
            mediaRecorder.stop();
            voiceBtn.style.background = 'white'; voiceBtn.style.color='black'; voiceBtn.innerText="HOLD TO SPEAK";
        }
    };
    
    // 兼容触摸与鼠标
    voiceBtn.addEventListener('mousedown', startRec);
    voiceBtn.addEventListener('mouseup', stopRec);
    voiceBtn.addEventListener('touchstart', (e)=>{e.preventDefault();startRec()});
    voiceBtn.addEventListener('touchend', (e)=>{e.preventDefault();stopRec()});

    // 页面逻辑
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        }
    });
    
    window.addEventListener('popstate', () => {
        document.getElementById('view-chat').classList.remove('active');
        activeChatId = null;
    });
    
    // 修改备注
    document.getElementById('rename-btn').onclick = () => {
        if(!activeChatId) return;
        const f = db.friends.find(x => x.id === activeChatId);
        const name = prompt("Rename:", f.alias || "");
        if(name !== null) { f.alias = name; saveDB(); document.getElementById('chat-partner-name').innerText = name; renderFriends(); }
    }

    // 音频解锁
    document.body.onclick = () => document.getElementById('msg-sound').load();
});
