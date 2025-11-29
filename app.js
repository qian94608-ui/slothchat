document.addEventListener('DOMContentLoaded', () => {

    // --- PWA 安装逻辑 ---
    let deferredPrompt;
    const installBtn = document.getElementById('pwa-install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
        installBtn.style.display = 'inline-block';
    });
    installBtn.addEventListener('click', () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
    });

    // --- 工具函数 ---
    const showModal = (id) => { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).style.display='flex'; };
    const hideModal = (id) => { document.getElementById(id).classList.add('hidden'); document.getElementById(id).style.display='none'; };
    window.hideAllModals = () => {
        hideModal('qr-overlay'); hideModal('add-overlay'); hideModal('sticker-panel');
        if(window.scannerObj) window.scannerObj.stop().catch(()=>{});
    };

    // --- 摄像头/扫码逻辑 (增加反馈) ---
    document.getElementById('scan-btn').onclick = () => {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            alert("HTTPS Required for Camera"); return;
        }
        showModal('qr-overlay');
        setTimeout(() => {
            const scanner = new Html5Qrcode("qr-reader");
            window.scannerObj = scanner;
            scanner.start({facingMode:"environment"}, {fps:10, qrbox:200}, (txt)=>{
                // 成功扫码
                document.getElementById('scan-sound').play().catch(()=>{});
                hideAllModals();
                addFriend(txt);
                connectTo(txt); // 立即连接
                openChat(txt);  // 跳转聊天
            });
        }, 300);
    };

    document.getElementById('add-id-btn').onclick = () => showModal('add-overlay');
    document.getElementById('confirm-add-btn').onclick = () => {
        const id = document.getElementById('manual-id-input').value.trim();
        if(id) { 
            addFriend(id); 
            connectTo(id); // 立即尝试连接 
            hideAllModals(); 
            openChat(id); 
            document.getElementById('manual-id-input').value = '';
        }
    };

    // --- 导航与历史记录 (修复手势返回) ---
    const tabBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-tab'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-tab');
        };
    });

    // 处理聊天页面打开与返回
    function openChat(id) {
        activeChatId = id;
        document.getElementById('chat-partner-name').innerText = id;
        document.getElementById('view-chat').classList.add('active');
        document.getElementById('messages-container').innerHTML = ''; // 清空旧消息
        
        // 关键：推入历史记录，拦截返回手势
        window.history.pushState({view: 'chat'}, '', '#chat');
        
        // 更新在线状态UI
        updateStatusDot(id);
    }

    // 监听返回事件 (手势或物理按键)
    window.addEventListener('popstate', (event) => {
        document.getElementById('view-chat').classList.remove('active');
        activeChatId = null;
    });

    // 按钮返回也调用 history.back()
    document.getElementById('chat-back-btn').onclick = () => {
        window.history.back();
    };


    // --- 业务数据 ---
    const MY_ID = localStorage.getItem('wojak_id') || 'Anon-' + Math.floor(Math.random() * 90000);
    localStorage.setItem('wojak_id', MY_ID);
    let friends = JSON.parse(localStorage.getItem('wojak_frens')) || [];
    let activeChatId = null;
    let connections = {}; // { friendId: conn }
    let peer = null;

    try {
        document.getElementById('my-id-display').innerText = MY_ID;
        document.getElementById('card-id-text').innerText = MY_ID;
        // 使用一个更怪诞的头像种子
        document.getElementById('my-avatar-small').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${MY_ID}`;
        if(window.QRCode) new QRCode(document.getElementById("qrcode"), { text: MY_ID, width: 80, height: 80 });
    } catch(e){}

    function renderFriends() {
        const list = document.getElementById('friends-list-container');
        if(!list) return;
        list.innerHTML = '';
        friends.forEach(id => {
            const isOnline = connections[id] && connections[id].open;
            const div = document.createElement('div');
            div.className = 'k-list-item';
            div.innerHTML = `
                <div class="avatar-frame"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${id}" class="avatar-img"></div>
                <div>
                    <div style="font-weight:bold">${id}</div>
                    <div style="font-size:12px; color:${isOnline?'green':'red'}">${isOnline ? '>> ONLINE' : '>> OFFLINE'}</div>
                </div>
            `;
            div.onclick = () => openChat(id);
            list.appendChild(div);
        });
    }

    function addFriend(id) {
        if(!friends.includes(id)) {
            friends.push(id);
            localStorage.setItem('wojak_frens', JSON.stringify(friends));
        }
        renderFriends();
    }

    function updateStatusDot(id) {
        const isOnline = connections[id] && connections[id].open;
        document.getElementById('chat-status-dot').className = isOnline ? 'status-square online' : 'status-square';
    }

    // --- 网络逻辑 (PeerJS) ---
    // 自动回连
    function autoReconnect() {
        if(peer && !peer.destroyed) {
            friends.forEach(fid => {
                if(!connections[fid] || !connections[fid].open) connectTo(fid);
            });
        }
    }
    setInterval(autoReconnect, 5000); // 每5秒检查连接

    try {
        peer = new Peer(MY_ID);
        peer.on('open', () => {
            console.log('Peer Open');
            document.getElementById('my-id-display').innerText = MY_ID; // 只有连上服务器才显示ID
            autoReconnect();
        });
        
        peer.on('connection', (conn) => {
            handleConnection(conn);
        });
        
        peer.on('error', err => console.log(err));
    } catch(e) { console.log("Peer Init Error", e); }

    function connectTo(id) {
        if(id === MY_ID) return;
        const conn = peer.connect(id);
        handleConnection(conn);
    }

    function handleConnection(conn) {
        conn.on('open', () => {
            connections[conn.peer] = conn;
            addFriend(conn.peer); // 自动加好友
            
            // 发送握手包 (解决状态显示问题)
            conn.send({type: 'ping'});
            renderFriends();
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
        
        conn.on('data', d => {
            // 处理握手
            if(d.type === 'ping') {
                // 收到 ping，不需要做UI显示，只确认连接存活
                // 可以在这里回一个 pong，但 peerjs 的 open 事件通常足够
                // 关键：收到任何数据都意味着在线
                renderFriends(); 
                if(activeChatId === conn.peer) updateStatusDot(conn.peer);
            }
            // 处理消息
            else if(d.type === 'text') handleIncoming(conn.peer, d.content, 'text');
            else if(d.type === 'sticker') handleIncoming(conn.peer, d.url, 'sticker');
        });

        conn.on('close', () => {
            renderFriends(); // 变红
            if(activeChatId === conn.peer) updateStatusDot(conn.peer);
        });
    }

    // --- 消息处理 ---
    const msgContainer = document.getElementById('messages-container');
    const chatInput = document.getElementById('chat-input');
    const sound = document.getElementById('msg-sound');

    document.getElementById('chat-send-btn').onclick = sendText;
    chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendText(); };

    function sendText() {
        const txt = chatInput.value.trim();
        if(txt && activeChatId) {
            if(connections[activeChatId] && connections[activeChatId].open) {
                connections[activeChatId].send({type:'text', content:txt});
                appendMsg(txt, true);
                chatInput.value = '';
            } else {
                alert("Fren is OFFLINE. Message lost in void.");
            }
        }
    }

    function handleIncoming(id, content, type) {
        if(activeChatId !== id) {
            sound.play().catch(()=>{});
            // 简单的 Toast 提示
            alert(`New ${type} from ${id}`);
        } else {
            if(type === 'text') appendMsg(content, false);
            if(type === 'sticker') appendSticker(content, false);
        }
    }

    function appendMsg(txt, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<div class="bubble">${txt}</div>`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // --- 表情包 (使用 Base64 或 SVG 确保不挂图) ---
    // 为了防止 Imgur 挂图，这里使用 Dicebear 的特定 Avatar 作为 Sticker，或者使用 SVG
    // 这里演示使用 Dicebear 不同的 Seed 生成怪异表情
    const stickerSeeds = ['crying', 'angry', 'happy', 'clown', 'chad', 'soy', 'doomer', 'cope'];
    const stickerGrid = document.getElementById('sticker-grid');
    
    document.getElementById('sticker-btn').onclick = () => {
        const panel = document.getElementById('sticker-panel');
        if(panel.style.display==='none' || panel.classList.contains('hidden')) {
            panel.classList.remove('hidden'); panel.style.display='block';
        } else {
            panel.classList.add('hidden'); panel.style.display='none';
        }
    };

    stickerSeeds.forEach(seed => {
        // 使用 DiceBear Fun Emoji 风格
        const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}&backgroundColor=transparent`;
        const img = document.createElement('img');
        img.src = url;
        img.className = 'sticker-item sticker-img';
        img.onclick = () => {
            if(activeChatId && connections[activeChatId]) {
                connections[activeChatId].send({type:'sticker', url:url});
                appendSticker(url, true);
                document.getElementById('sticker-panel').style.display='none';
            }
        };
        stickerGrid.appendChild(img);
    });

    function appendSticker(url, isSelf) {
        const div = document.createElement('div');
        div.className = `msg-row ${isSelf?'self':'other'}`;
        div.innerHTML = `<img src="${url}" class="sticker-img">`;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // 全局点击解锁音频
    document.body.onclick = () => sound.load();
});
